const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Session = require("../models/Session");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
  tokenExpireDate,
} = require("../config/jwt");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Parse "7d" -> ms for cookie maxAge
const parseDuration = (str) => {
  const unit = str.slice(-1);
  const val = parseInt(str, 10);
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * (map[unit] || 1000);
};

const REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || "7d";

// Set httpOnly cookie for access token
const setAccessCookie = (res, token) => {
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: parseDuration(process.env.JWT_ACCESS_EXPIRE || "15m"),
    path: "/",
  });
};

// Set httpOnly cookie for refresh token
const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: parseDuration(REFRESH_EXPIRE),
    path: "/api/auth", // Refresh token only sent to auth routes
  });
};

// Save a session to DB
const createSession = async (userId, refreshToken, req) => {
  const ua = req.headers["user-agent"] || "";
  const ip = req.ip || req.connection?.remoteAddress || "";
  const expiresAt = new Date(Date.now() + parseDuration(REFRESH_EXPIRE));

  await Session.create({
    userId,
    refreshToken,
    userAgent: ua,
    ipAddress: ip,
    deviceName: ua.includes("Mobile") ? "Mobile Device" : "Desktop / Browser",
    expiresAt,
  });
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────
// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    // Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please log in.",
        field: "email",
      });
    }

    // Password strength: min 8 chars, at least one number
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters.", field: "password" });
    }

    // Create user (password hashed in pre-save hook)
    const emailToken = generateRandomToken();
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      provider: "local",
      isVerified: false,                              // Require email verification
      emailVerificationToken: emailToken,
      emailVerificationExpire: tokenExpireDate(1440), // 24 hours
    });

    // TODO: Send verification email with emailToken
    // await sendVerificationEmail(user.email, emailToken);

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save session
    await createSession(user._id, refreshToken, req);

    // Update last login
    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
    });

    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please verify your email.",
      data: {
        user: user.toPublic(),
        accessToken,           // Also send in body for JS clients (e.g. React)
      },
    });

  } catch (err) {
    console.error("Register error:", err);

    // MongoDB duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }

    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Find user and include password field
    const user = await User.findByEmailWithPassword(email);

    if (!user) {
      // Generic message to prevent email enumeration
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // Check if account is Google OAuth (no local password)
    if (user.provider === "google" && !user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in. Please continue with Google.",
        provider: "google",
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated. Contact support." });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save session & update last login
    await createSession(user._id, refreshToken, req);
    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
      "stats.lastActiveAt": new Date(),
    });

    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      data: {
        user: user.toPublic(),
        accessToken,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

// ─── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
// POST /api/auth/google
// Expects: { credential: "<Google ID Token from frontend>" }
const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential token is required." });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ success: false, message: "Google account email is not verified." });
    }

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      // Link Google to existing local account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = "google";
        user.avatar = picture;
        user.isVerified = true;
        await user.save();
      }
    } else {
      // Create new user from Google profile
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        avatar: picture,
        provider: "google",
        isVerified: true,       // Google already verified the email
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    await createSession(user._id, refreshToken, req);
    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip,
      "stats.lastActiveAt": new Date(),
    });

    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful.",
      data: {
        user: user.toPublic(),
        accessToken,
        isNewUser: !user.createdAt || (Date.now() - user.createdAt) < 5000,
      },
    });

  } catch (err) {
    console.error("Google auth error:", err);
    if (err.message?.includes("Token used too late") || err.message?.includes("Invalid token")) {
      return res.status(401).json({ success: false, message: "Google token is invalid or expired. Please try again." });
    }
    return res.status(500).json({ success: false, message: "Google authentication failed." });
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
// POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: "Refresh token not found." });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token.", code: "REFRESH_EXPIRED" });
    }

    // Check session exists in DB
    const session = await Session.findOne({ refreshToken: token, isValid: true });
    if (!session) {
      return res.status(401).json({ success: false, message: "Session not found or revoked." });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      await Session.findByIdAndDelete(session._id);
      return res.status(401).json({ success: false, message: "User not found or deactivated." });
    }

    // Rotate refresh token (invalidate old, issue new)
    await Session.findByIdAndUpdate(session._id, { isValid: false });

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await createSession(user._id, newRefreshToken, req);

    setAccessCookie(res, newAccessToken);
    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken },
    });

  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};


const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

   
    if (token) {
      await Session.findOneAndUpdate({ refreshToken: token }, { isValid: false });
    }

    // Clear cookies
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api/auth" });

    return res.status(200).json({ success: true, message: "Logged out successfully." });

  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ success: false, message: "Server error during logout." });
  }
};


const logoutAll = async (req, res) => {
  try {
    await Session.updateMany({ userId: req.user._id }, { isValid: false });

    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api/auth" });

    return res.status(200).json({ success: true, message: "Logged out from all devices." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};


const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: { user: req.user.toPublic() },
  });
};

module.exports = { register, login, googleAuth, refreshToken, logout, logoutAll, getMe };
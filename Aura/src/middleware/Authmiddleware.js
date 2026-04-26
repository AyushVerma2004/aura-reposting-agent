const { verifyAccessToken } = require("../config/jwt");
const User = require("../models/User");


const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check Authorization header
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    // 2. Fallback: check httpOnly cookie
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated. Please log in." });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user to request (without password)
    const user = await User.findById(decoded.id).select("-password -refreshTokens -resetPasswordToken -emailVerificationToken");

    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    }

    req.user = user;
    next();

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Access token expired.", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
};


const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized to access this route.`,
      });
    }
    next();
  };
};


const optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(" ")[1] || req.cookies?.accessToken;
    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = await User.findById(decoded.id).select("-password");
    }
  } catch (_) {
    
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
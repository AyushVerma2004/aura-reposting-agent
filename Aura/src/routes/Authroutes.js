const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const {
  register,
  login,
  googleAuth,
  refreshToken,
  logout,
  logoutAll,
  getMe,
} = require("../controllers/authController");

const { protect } = require("../middleware/auth");


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: "Too many requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: "Too many failed attempts. Please wait 1 hour." },
  skipSuccessfulRequests: true,
});


const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

const registerRules = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 60 }).withMessage("Name must be 2-60 characters"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/\d/).withMessage("Password must contain at least one number"),
];

const loginRules = [
  body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required"),
];




router.post("/register", authLimiter, registerRules, validate, register);


router.post("/login", strictLimiter, loginRules, validate, login);


router.post("/google", authLimiter, [
  body("credential").notEmpty().withMessage("Google credential is required"),
], validate, googleAuth);


router.post("/refresh", refreshToken);


router.post("/logout", protect, logout);


router.post("/logout-all", protect, logoutAll);


router.get("/me", protect, getMe);

module.exports = router;
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const userSchema = new mongoose.Schema(
  {
   
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

   
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      // Not required: Google OAuth users won't have a password
      select: false, // Never return password in queries by default
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values (non-Google users)
    },

    avatar: {
      type: String,
      default: null,
    },


    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    
    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpire: {
      type: Date,
      select: false,
    },

  
    profile: {
      bio: { type: String, maxlength: 200, default: "" },
      website: { type: String, default: "" },
      preferredPlatforms: {
        type: [String],
        enum: ["instagram", "x", "youtube", "facebook", "linkedin", "tiktok"],
        default: [],
      },
      defaultNiche: { type: String, default: "lifestyle" },
      defaultLanguage: { type: String, default: "english" },
    },

    
    stats: {
      totalGenerated: { type: Number, default: 0 },
      totalHashtags: { type: Number, default: 0 },
      totalCaptions: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: Date.now },
    },

   
    refreshTokens: {
      type: [String],
      select: false,
      default: [],
    },

    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ "stats.lastActiveAt": -1 });


userSchema.virtual("avatarUrl").get(function () {
  if (this.avatar) return this.avatar;
  // Generate initials-based avatar via UI Avatars API
  const initials = this.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0abdd8&color=05080f&bold=true`;
});


userSchema.pre("save", async function (next) {
  // Only hash if password was modified (or is new)
  if (!this.isModified("password") || !this.password) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};


userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    provider: this.provider,
    role: this.role,
    isVerified: this.isVerified,
    avatar: this.avatarUrl,
    profile: this.profile,
    stats: this.stats,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select("+password");
};

module.exports = mongoose.model("User", userSchema);
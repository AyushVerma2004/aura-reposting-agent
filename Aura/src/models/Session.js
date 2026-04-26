const mongoose = require("mongoose");


const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    refreshToken: {
      type: String,
      required: true,
      unique: true,
    },

    
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    deviceName: { type: String, default: "Unknown Device" },

    isValid: {
      type: Boolean,
      default: true,
    },

    
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ refreshToken: 1 });

module.exports = mongoose.model("Session", sessionSchema);
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
    },
    otpCode: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      required: true,
      enum: ["host", "vendor", "signup"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Not required for signup scenarios
    },
    expiresAt: {
      type: Date,
      default: Date.now,
      expires: 300, // OTP expires in 5 minutes (300 seconds)
    },
  },
  {
    timestamps: true,
  }
);

const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const whiteLabelSchema = new mongoose.Schema(
  {
    // Basic authentication fields
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Please provide a phone number"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords are not the same",
      },
    },

    // Identity section
    identity: {
      arabic_name: {
        type: String,
        required: [true, "Arabic name is required"],
        minlength: [2, "Arabic name must be at least 2 characters"],
        maxlength: [50, "Arabic name cannot exceed 50 characters"],
        trim: true,
      },
      english_name: {
        type: String,
        required: [true, "English name is required"],
        minlength: [2, "English name must be at least 2 characters"],
        maxlength: [50, "English name cannot exceed 50 characters"],
        trim: true,
      },
      logo: {
        type: String, // Will store file path or URL
        required: [true, "Logo is required"],
      },
      primaryColor: {
        type: String,
        required: [true, "Primary color is required"],
        validate: {
          validator: function (v) {
            return /^#[0-9A-F]{6}$/i.test(v);
          },
          message: "Primary color must be a valid hex color code",
        },
      },
      secondaryColor: {
        type: String,
        required: [true, "Secondary color is required"],
        validate: {
          validator: function (v) {
            return /^#[0-9A-F]{6}$/i.test(v);
          },
          message: "Secondary color must be a valid hex color code",
        },
      },
      fontFamily: {
        type: String,
        trim: true,
      },
    },

    // Login data section
    loginData: {
      email: {
        type: String,
        required: [true, "Login email is required"],
        lowercase: true,
        validate: {
          validator: function (v) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
          },
          message: "Please provide a valid email address",
        },
      },
      domain: {
        type: String,
        required: [true, "Domain is required"],
        trim: true,
      },
    },

    // System requirements section
    systemRequirements: {
      numberOfEvents: {
        type: String,
        required: [true, "Number of events is required"],
        validate: {
          validator: function (v) {
            return /^\d+$/.test(v) && parseInt(v) > 0;
          },
          message: "Number of events must be a positive number",
        },
      },
      numberOfGuestsPerEvent: {
        type: String,
        required: [true, "Number of guests per event is required"],
        validate: {
          validator: function (v) {
            return /^\d+$/.test(v) && parseInt(v) > 0;
          },
          message: "Number of guests per event must be a positive number",
        },
      },
      eventsTypes: {
        type: [String],
        required: [true, "At least one event type is required"],
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length > 0;
          },
          message: "At least one event type must be selected",
        },
      },
      services: {
        type: [String],
        required: [true, "At least one service is required"],
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length > 0;
          },
          message: "At least one service must be selected",
        },
      },
    },

    // Additional services
    additionalServices: {
      type: [String],
      default: [],
    },

    // Payment data section
    paymentData: {
      companyName: {
        type: String,
        required: [true, "Company name is required"],
        trim: true,
      },
      licenseNumber: {
        type: String,
        required: [true, "License number is required"],
        trim: true,
      },
      TaxNumber: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
      },
      neighborhood: {
        type: String,
        required: [true, "Neighborhood is required"],
        trim: true,
      },
      street: {
        type: String,
        required: [true, "Street is required"],
        trim: true,
      },
      buildingNumber: {
        type: String,
        required: [true, "Building number is required"],
        trim: true,
      },
      additionalNumber: {
        type: String,
        required: [true, "Additional number is required"],
        trim: true,
      },
      placeType: {
        type: String,
        trim: true,
      },
      placeNumber: {
        type: String,
        trim: true,
      },
      paymentMethod: {
        type: [String],
        required: [true, "At least one payment method is required"],
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length > 0;
          },
          message: "At least one payment method must be selected",
        },
      },
    },

    // Authentication related fields
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware for password hashing
whiteLabelSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Pre-save middleware for password change timestamp
whiteLabelSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance method for password comparison
whiteLabelSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password was changed after JWT was issued
whiteLabelSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method to create password reset token
whiteLabelSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

const WhiteLabel = mongoose.model("WhiteLabel", whiteLabelSchema);

module.exports = WhiteLabel;

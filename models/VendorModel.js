const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const vendorSchema = new mongoose.Schema(
  {
    identity: {
      brandName: {
        type: String,
        required: [true, "Brand name is required"],
        minlength: [2, "Brand name must be at least 2 characters"],
        maxlength: [50, "Brand name must be less than 50 characters"],
        trim: true,
      },
      ownerFullName: {
        type: String,
        required: [true, "Owner full name is required"],
        minlength: [2, "Owner full name must be at least 2 characters"],
        maxlength: [100, "Owner full name must be less than 100 characters"],
        trim: true,
      },
      serviceType: {
        type: [String],
        required: [true, "Service type is required"],
        validate: {
          validator: function (arr) {
            return arr && arr.length > 0;
          },
          message: "At least one service type is required",
        },
      },
      phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        minlength: [10, "Phone number is invalid"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        validate: {
          validator: function (email) {
            return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
          },
          message: "Please enter a valid email",
        },
      },
    },

    serviceData: {
      serviceDescription: {
        type: String,
        required: [true, "Service description is required"],
        minlength: [10, "Service description must be at least 10 characters"],
        maxlength: [
          500,
          "Service description must be less than 500 characters",
        ],
        trim: true,
      },
      eventPlanning: {
        type: [String],
        default: [],
      },
      mediaProduction: {
        type: [String],
        default: [],
      },
      giftsAndGiveaways: {
        type: [String],
        default: [],
      },
      foodAndBeverages: {
        type: [String],
        default: [],
      },
      beautyAndFashion: {
        type: [String],
        default: [],
      },
      logisticsAndDelivery: {
        type: [String],
        default: [],
      },
      corporateServices: {
        type: [String],
        default: [],
      },
      city: {
        type: String,
        required: [true, "City is required"],
        minlength: [2, "City must be at least 2 characters"],
        trim: true,
      },
      coverageArea: {
        type: String,
        required: [true, "Coverage area is required"],
        trim: true,
      },
      otherData: {
        type: String,
        trim: true,
      },
    },

    samplesAndPackages: {
      portfolioImages: {
        type: [String], // Array of file paths
        required: [true, "Portfolio images are required"],
        validate: {
          validator: function (arr) {
            return arr && arr.length > 0;
          },
          message: "At least one portfolio image is required",
        },
      },
      businessLogo: {
        type: String, // File path
      },
      pricePackages: {
        type: [String], // Array of file paths
        required: [true, "Price packages are required"],
        validate: {
          validator: function (arr) {
            return arr && arr.length > 0;
          },
          message: "At least one price package is required",
        },
      },
    },

    commercialVerification: {
      commercialRecord: {
        type: String, // File path
      },
      nationalId: {
        type: String,
        required: [true, "National ID is required"],
        trim: true,
      },
    },

    paymentData: {
      termsForRefund: {
        type: String,
        trim: true,
      },
      paymentOptions: {
        type: [String],
        default: [],
      },
    },

    otherLinksAndData: {
      instagramLink: {
        type: String,
        trim: true,
      },
      linkedinLink: {
        type: String,
        trim: true,
      },
      websiteLink: {
        type: String,
        trim: true,
      },
      additionalServices: {
        type: String,
        trim: true,
      },
      cv: {
        type: String, // File path
      },
      profileFile: {
        type: String, // File path
      },
    },

    // Authentication fields
    password: {
      type: String,
      required: [true, "Password is required"],
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
        message: "Passwords are not the same!",
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better performance
vendorSchema.index({ "identity.email": 1 });
vendorSchema.index({ "identity.phoneNumber": 1 });

// Hash password before saving
vendorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Set passwordChangedAt field
vendorSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Query middleware to exclude inactive users
vendorSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// Instance method to check password
vendorSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password changed after JWT was issued
vendorSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
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
vendorSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

const Vendor = mongoose.model("Vendor", vendorSchema);

module.exports = Vendor;

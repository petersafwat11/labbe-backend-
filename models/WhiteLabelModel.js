const mongoose = require("mongoose");
const whiteLabelSchema = new mongoose.Schema(
  {
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

    // Login data section - matches whiteLabelSchema.js
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

    // System requirements section - matches whiteLabelSchema.js
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

    // Additional services - matches whiteLabelSchema.js
    additionalServices: {
      type: [String],
      default: [],
    },

    // Payment data section - matches whiteLabelSchema.js
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
  },
  {
    timestamps: true,
  }
);

const WhiteLabel = mongoose.model("WhiteLabel", whiteLabelSchema);

module.exports = WhiteLabel;

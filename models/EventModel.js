const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    // Basic Event Information
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Event title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Event description cannot exceed 1000 characters"],
    },

    // Event Dates
    startDate: {
      type: Date,
      required: [true, "Event start date is required"],
    },

    endDate: {
      type: Date,
      required: [true, "Event end date is required"],
      validate: {
        validator: function (value) {
          return value >= this.startDate;
        },
        message: "End date must be after or equal to start date",
      },
    },

    // Event Location
    location: {
      address: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Event Host
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      required: [true, "Event must belong to a host"],
    },

    // Event Settings
    maxGuests: {
      type: Number,
      min: [1, "Maximum guests must be at least 1"],
    },

    isPublic: {
      type: Boolean,
      default: false,
    },

    // Event Status
    status: {
      type: String,
      enum: ["draft", "published", "ongoing", "completed", "cancelled"],
      default: "draft",
    },

    // Event Type/Category
    category: {
      type: String,
      enum: [
        "wedding",
        "birthday",
        "corporate",
        "conference",
        "party",
        "other",
      ],
      required: [true, "Event category is required"],
    },

    // Event Images
    images: [
      {
        url: String,
        alt: String,
      },
    ],

    // Guest Statistics
    guestStats: {
      totalInvited: {
        type: Number,
        default: 0,
      },
      totalConfirmed: {
        type: Number,
        default: 0,
      },
      totalAttended: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    collection: "events",
  }
);

// Indexes for better performance
eventSchema.index({ host: 1 });
eventSchema.index({ startDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ createdAt: -1 });

// Virtual for event duration in hours
eventSchema.virtual("duration").get(function () {
  if (this.startDate && this.endDate) {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60));
  }
  return 0;
});

// Virtual for checking if event is upcoming
eventSchema.virtual("isUpcoming").get(function () {
  return this.startDate > new Date();
});

// Virtual for checking if event is past
eventSchema.virtual("isPast").get(function () {
  return this.endDate < new Date();
});

// Static method to find events by host
eventSchema.statics.findByHost = function (hostId) {
  return this.find({ host: hostId }).sort({ startDate: -1 });
};

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function (hostId = null) {
  const query = { startDate: { $gt: new Date() } };
  if (hostId) query.host = hostId;
  return this.find(query).sort({ startDate: 1 });
};

// Instance method to update guest statistics
eventSchema.methods.updateGuestStats = function () {
  // This would typically involve aggregating from the Guest collection
  // Implementation depends on your guest management logic
  return this.save();
};

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;

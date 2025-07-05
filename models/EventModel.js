const mongoose = require("mongoose");

// Supervisor sub-schema (specific to events, not a separate model)
const supervisorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Supervisor name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Supervisor phone number is required"],
      trim: true,
      validate: {
        validator: function (value) {
          return value && value.length >= 10;
        },
        message: "Phone number must be at least 10 digits",
      },
    },
  },
  { _id: false }
);

// Location sub-schema (specific to events)
const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: [-90, "Latitude must be between -90 and 90"],
      max: [90, "Latitude must be between -90 and 90"],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: [-180, "Longitude must be between -180 and 180"],
      max: [180, "Longitude must be between -180 and 180"],
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Template sub-schema (specific to events)
const templateSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    image: String,
    colors: {
      primary: String,
      secondary: String,
      accent: String,
    },
  },
  { _id: false }
);

// Event Details sub-schema
const eventDetailsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      // required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Event title cannot exceed 200 characters"],
    },
    type: {
      type: String,
      enum: [
        "wedding",
        "birthday",
        "graduation",
        "meeting",
        "conference",
        "other",
      ],
      // required: [true, "Event type is required"],
    },
    date: {
      type: Date,
      // required: [true, "Event date is required"],
    },
    time: {
      type: String,
      // required: [true, "Event time is required"],
      trim: true,
    },
    location: {
      type: locationSchema,
      // required: [true, "Event location is required"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Event description cannot exceed 1000 characters"],
    },
  },
  { _id: false }
);

// Invitation Settings sub-schema
const invitationSettingsSchema = new mongoose.Schema(
  {
    selectedTemplate: templateSchema,
    invitationMessage: String,
    attendanceAutoReply: String,
    absenceAutoReply: String,
    expectedAttendanceAutoReply: String,
    templateImage: String, // Store file path or URL
    note: String,
  },
  { _id: false }
);

// Launch Settings sub-schema
const launchSettingsSchema = new mongoose.Schema(
  {
    sendSchedule: {
      type: String,
      enum: ["now", "later"],
      default: "now",
    },
    scheduledDate: Date,
    scheduledTime: String,
  },
  { _id: false }
);

// Main Event Schema
const eventSchema = new mongoose.Schema(
  {
    // Event Details
    eventDetails: {
      type: eventDetailsSchema,
      required: [true, "Event details are required"],
    },

    // Guest List - Reference to existing Guest model
    guestList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Guest",
      },
    ],

    // Supervisors List (event-specific, not a separate model)
    supervisorsList: [supervisorSchema],

    // Invitation Settings
    invitationSettings: invitationSettingsSchema,

    // Launch Settings
    launchSettings: launchSettingsSchema,

    // Event Host - Reference to existing Host model
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      required: [true, "Event must belong to a host"],
    },

    // Event Status
    status: {
      type: String,
      enum: ["draft", "published", "ongoing", "completed", "cancelled"],
      default: "draft",
    },

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
eventSchema.index({ "eventDetails.date": 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ "eventDetails.type": 1 });
eventSchema.index({ createdAt: -1 });

// Virtual for checking if event is upcoming
eventSchema.virtual("isUpcoming").get(function () {
  return this.eventDetails.date > new Date();
});

// Virtual for checking if event is past
eventSchema.virtual("isPast").get(function () {
  return this.eventDetails.date < new Date();
});

// Static method to find events by host
eventSchema.statics.findByHost = function (hostId) {
  return this.find({ host: hostId })
    .populate("host", "username email phoneNumber")
    .populate("guestList", "name email phone status")
    .sort({ "eventDetails.date": -1 });
};

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function (hostId = null) {
  const query = { "eventDetails.date": { $gt: new Date() } };
  if (hostId) query.host = hostId;
  return this.find(query)
    .populate("host", "username email phoneNumber")
    .populate("guestList", "name email phone status")
    .sort({ "eventDetails.date": 1 });
};

// Instance method to update guest statistics
eventSchema.methods.updateGuestStats = async function () {
  if (this.guestList && this.guestList.length > 0) {
    // If guestList contains ObjectIds, we need to populate to get the actual guest data
    await this.populate("guestList", "status");

    this.guestStats.totalInvited = this.guestList.length;
    this.guestStats.totalConfirmed = this.guestList.filter(
      (guest) => guest.status === "confirmed"
    ).length;
    this.guestStats.totalAttended = this.guestList.filter(
      (guest) => guest.status === "attended"
    ).length;
  }
  return this.save();
};

// Pre-save middleware to update guest statistics
eventSchema.pre("save", async function (next) {
  if (this.isModified("guestList")) {
    this.guestStats.totalInvited = this.guestList.length;
    // For detailed stats, we'd need to populate the guests
    // This is handled in the updateGuestStats method
  }
  next();
});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;

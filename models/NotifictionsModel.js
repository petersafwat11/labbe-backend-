const mongoose = require("mongoose");

const notificationsSchema = new mongoose.Schema(
  {
    // Reference to Host
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Host",
      required: [true, "Notification preferences must belong to a host"],
      unique: true, // Each host can have only one notification preference record
    },

    // App Notifications
    appNotifications: {
      eventUpdates: {
        type: Boolean,
        default: true,
        required: true,
      },
      eventDates: {
        type: Boolean,
        default: true,
        required: true,
      },
      packageRenewal: {
        type: Boolean,
        default: true,
        required: true,
      },
      systemInteractions: {
        type: Boolean,
        default: true,
        required: true,
      },
    },

    // Email Notifications
    emailNotifications: {
      eventUpdates: {
        type: Boolean,
        default: false,
        required: true,
      },
      eventDates: {
        type: Boolean,
        default: false,
        required: true,
      },
      packageRenewal: {
        type: Boolean,
        default: false,
        required: true,
      },
      beforeSendingInvitations: {
        type: Boolean,
        default: false,
        required: true,
      },
      afterSendingInvitations: {
        type: Boolean,
        default: false,
        required: true,
      },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    collection: "notifications",
  }
);

// Create indexes for better performance
notificationsSchema.index({ createdAt: 1 });
notificationsSchema.index({ host: 1 }); // Index on host reference for faster queries

// Instance method to get notification preferences
notificationsSchema.methods.getNotificationPreferences = function () {
  return {
    appNotifications: this.appNotifications,
    emailNotifications: this.emailNotifications,
  };
};

// Static method to update notification preferences
notificationsSchema.statics.updateNotificationPreferences = function (
  id,
  preferences
) {
  return this.findByIdAndUpdate(
    id,
    { $set: preferences },
    { new: true, runValidators: true }
  );
};

// Static method to find notification preferences by host ID
notificationsSchema.statics.findByHost = function (hostId) {
  return this.findOne({ host: hostId }).populate(
    "host",
    "username email phoneNumber"
  );
};

// Static method to create notification preferences for a host
notificationsSchema.statics.createForHost = function (
  hostId,
  preferences = {}
) {
  const defaultPreferences = {
    host: hostId,
    appNotifications: {
      eventUpdates: true,
      eventDates: true,
      packageRenewal: true,
      systemInteractions: true,
    },
    emailNotifications: {
      eventUpdates: false,
      eventDates: false,
      packageRenewal: false,
      beforeSendingInvitations: false,
      afterSendingInvitations: false,
    },
    ...preferences,
  };

  return new this(defaultPreferences);
};

const Notifications = mongoose.model("Notifications", notificationsSchema);

module.exports = Notifications;

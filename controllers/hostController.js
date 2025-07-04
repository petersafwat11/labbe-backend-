const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Notifications = require("../models/NotifictionsModel");

// Get notification preferences for a host
exports.getNotificationPreferences = catchAsync(async (req, res, next) => {
  const hostId = req.user.id;

  // Try to find existing notification preferences
  let notifications = await Notifications.findByHost(hostId);

  // If no preferences exist, create default ones
  if (!notifications) {
    notifications = Notifications.createForHost(hostId);
    await notifications.save();
  }

  res.status(200).json({
    status: "success",
    data: {
      notifications: notifications.getNotificationPreferences(),
    },
  });
});

// Update notification preferences for a host
exports.updateNotificationPreferences = catchAsync(async (req, res, next) => {
  const hostId = req.user.id;
  const { appNotifications, emailNotifications } = req.body;

  // Validate request body
  if (!appNotifications && !emailNotifications) {
    return next(
      new AppError("Please provide notification preferences to update", 400)
    );
  }

  // Find existing notification preferences
  let notifications = await Notifications.findByHost(hostId);

  // If no preferences exist, create new ones
  if (!notifications) {
    notifications = Notifications.createForHost(hostId, {
      appNotifications,
      emailNotifications,
    });
    await notifications.save();
  } else {
    // Update existing preferences
    const updateData = {};

    if (appNotifications) {
      updateData.appNotifications = {
        ...notifications.appNotifications,
        ...appNotifications,
      };
    }

    if (emailNotifications) {
      updateData.emailNotifications = {
        ...notifications.emailNotifications,
        ...emailNotifications,
      };
    }

    notifications = await Notifications.updateNotificationPreferences(
      notifications._id,
      updateData
    );
  }

  res.status(200).json({
    status: "success",
    message: "Notification preferences updated successfully",
    data: {
      notifications: notifications.getNotificationPreferences(),
    },
  });
});

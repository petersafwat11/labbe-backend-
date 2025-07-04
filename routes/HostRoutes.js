const express = require("express");
const hostController = require("../controllers/hostController");
const authController = require("../controllers/authController");

const router = express.Router();

// Protect all routes - user must be logged in
router.use(authController.protect);

// Notification routes
router
  .route("/notifications")
  .get(hostController.getNotificationPreferences)
  .patch(hostController.updateNotificationPreferences);

module.exports = router;

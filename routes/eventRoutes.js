const express = require("express");
const eventController = require("../controllers/eventController");
const authController = require("../controllers/authController");
const { uploadTemplateImage } = require("../utils/fileUpload");

const router = express.Router();

// Protect all routes - user must be logged in
router.use(authController.protect);

// Get upcoming events (can be filtered by host)
router.get("/upcoming", eventController.getUpcomingEvents);

// Get events by host (current user's events)
router.get("/my-events", eventController.getEventsByHost);

// Get events by specific host ID
router.get("/host/:hostId", eventController.getEventsByHost);

// Get event statistics
router.get("/:id/stats", eventController.getEventStats);

// Update event status
router.patch("/:id/status", eventController.updateEventStatus);

// Main CRUD routes for events
router
  .route("/")
  .get(eventController.getAllEvents)
  .post(uploadTemplateImage, eventController.createEvent);

router
  .route("/:id")
  .get(eventController.getEvent)
  .patch(uploadTemplateImage, eventController.updateEvent)
  .delete(eventController.deleteEvent);

// Admin route to delete all events (if needed)
router.delete("/admin/delete-all", eventController.deleteAllEvents);

module.exports = router;

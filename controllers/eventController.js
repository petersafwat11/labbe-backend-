const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const Event = require("../models/EventModel");
const Guest = require("../models/GuestModel");
const factory = require("./handlerFactory");
const { getRelativeFilePath } = require("../utils/fileUpload");

// Helper function to create and save guests
const createGuestsFromList = async (guestData, eventId) => {
  const guestIds = [];

  for (const guest of guestData) {
    // Create guest object with event reference
    const guestObj = {
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      event: eventId,
      status: "invited",
      invitedBy: guest.invitedBy || null,
    };

    // Save guest to database
    const savedGuest = await Guest.create(guestObj);
    guestIds.push(savedGuest._id);
  }

  return guestIds;
};

// Helper function to update guests
const updateGuestsFromList = async (
  guestData,
  eventId,
  existingGuestIds = []
) => {
  const guestIds = [];

  // Delete existing guests that are not in the new list
  await Guest.deleteMany({
    event: eventId,
    _id: { $nin: guestData.map((g) => g.id).filter((id) => id) },
  });

  for (const guest of guestData) {
    if (guest.id && existingGuestIds.includes(guest.id)) {
      // Update existing guest
      const updatedGuest = await Guest.findByIdAndUpdate(
        guest.id,
        {
          name: guest.name,
          phone: guest.phone,
          email: guest.email,
        },
        { new: true, runValidators: true }
      );
      guestIds.push(updatedGuest._id);
    } else {
      // Create new guest
      const guestObj = {
        name: guest.name,
        phone: guest.phone,
        email: guest.email,
        event: eventId,
        status: "invited",
        invitedBy: guest.invitedBy || null,
      };

      const savedGuest = await Guest.create(guestObj);
      guestIds.push(savedGuest._id);
    }
  }

  return guestIds;
};

// Create Event
exports.createEvent = catchAsync(async (req, res, next) => {
  // Parse form-data JSON strings
  let guestList, eventData;

  // Debug: Log the raw request body
  console.log("Raw req.body:", req.body);
  console.log("Raw req.body keys:", Object.keys(req.body));

  try {
    // Parse JSON strings from form-data
    guestList = req.body.guestList ? JSON.parse(req.body.guestList) : [];

    // Parse other event data - assign directly to eventData object
    eventData = {};

    if (req.body.eventDetails) {
      console.log("Parsing eventDetails:", req.body.eventDetails);
      const parsedEventDetails = JSON.parse(req.body.eventDetails);
      eventData.eventDetails = parsedEventDetails;
      console.log("Parsed eventDetails:", eventData.eventDetails);
    }

    if (req.body.supervisorsList) {
      console.log("Parsing supervisorsList:", req.body.supervisorsList);
      const parsedSupervisors = JSON.parse(req.body.supervisorsList);
      eventData.supervisorsList = parsedSupervisors;
    }

    if (req.body.invitationSettings) {
      console.log("Parsing invitationSettings:", req.body.invitationSettings);
      const parsedInvitationSettings = JSON.parse(req.body.invitationSettings);
      eventData.invitationSettings = parsedInvitationSettings;
    }

    if (req.body.launchSettings) {
      console.log("Parsing launchSettings:", req.body.launchSettings);
      const parsedLaunchSettings = JSON.parse(req.body.launchSettings);
      eventData.launchSettings = parsedLaunchSettings;
    }

    // Debug logging
    console.log(
      "Final eventData before validation:",
      JSON.stringify(eventData, null, 2)
    );
  } catch (error) {
    console.error("JSON parsing error:", error);
    return next(
      new AppError(`Invalid JSON data in form fields: ${error.message}`, 400)
    );
  }

  // Validate required fields
  if (!eventData.eventDetails) {
    return next(new AppError("Event details are required", 400));
  }

  if (!guestList || guestList.length === 0) {
    return next(new AppError("At least one guest is required", 400));
  }

  // Handle template image upload
  if (req.file) {
    const templateImagePath = getRelativeFilePath(req.file);
    if (eventData.invitationSettings) {
      eventData.invitationSettings.templateImage = templateImagePath;
    } else {
      eventData.invitationSettings = { templateImage: templateImagePath };
    }
  }

  // Set host from authenticated user
  eventData.host = req.user.id;

  // Final debug log before creating event
  console.log(
    "Final eventData before Event.create:",
    JSON.stringify(eventData, null, 2)
  );

  // Create event first (without guestList)
  const event = await Event.create(eventData);

  // Create guests and get their IDs
  const guestIds = await createGuestsFromList(guestList, event._id);

  // Update event with guest references
  event.guestList = guestIds;
  await event.save();

  // Update guest statistics
  await event.updateGuestStats();

  // Populate and return the complete event
  const populatedEvent = await Event.findById(event._id)
    .populate("host", "username email phoneNumber")
    .populate("guestList", "name email phone status");

  res.status(201).json({
    status: "success",
    data: {
      event: populatedEvent,
    },
  });
});

// Get All Events
exports.getAllEvents = catchAsync(async (req, res, next) => {
  // Filter by host if user is authenticated
  let filter = {};
  if (req.user) {
    filter.host = req.user.id;
  }

  const features = new APIFeatures(Event.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const countFeatures = new APIFeatures(Event.find(filter), req.query)
    .filter()
    .countDocs();

  // Populate related data
  features.query = features.query
    .populate("host", "username email phoneNumber")
    .populate("guestList", "name email phone status");

  const events = await features.query;
  const totalResults = await countFeatures.query;

  res.status(200).json({
    status: "success",
    results: totalResults,
    data: {
      events,
    },
  });
});

// Get Event by ID
exports.getEvent = catchAsync(async (req, res, next) => {
  const event = await Event.findById(req.params.id)
    .populate("host", "username email phoneNumber")
    .populate("guestList", "name email phone status rsvp checkIn invitation");

  if (!event) {
    return next(new AppError("No event found with that ID", 404));
  }

  // Check if user is authorized to view this event
  if (req.user && event.host._id.toString() !== req.user.id) {
    return next(new AppError("You are not authorized to view this event", 403));
  }

  res.status(200).json({
    status: "success",
    data: {
      event,
    },
  });
});

// Update Event
exports.updateEvent = catchAsync(async (req, res, next) => {
  // Parse form-data JSON strings
  let guestList, eventData;

  try {
    // Parse JSON strings from form-data
    guestList = req.body.guestList ? JSON.parse(req.body.guestList) : null;

    // Parse other event data - assign directly to eventData object
    eventData = {};

    if (req.body.eventDetails) {
      const parsedEventDetails = JSON.parse(req.body.eventDetails);
      eventData.eventDetails = parsedEventDetails;
    }

    if (req.body.supervisorsList) {
      const parsedSupervisors = JSON.parse(req.body.supervisorsList);
      eventData.supervisorsList = parsedSupervisors;
    }

    if (req.body.invitationSettings) {
      const parsedInvitationSettings = JSON.parse(req.body.invitationSettings);
      eventData.invitationSettings = parsedInvitationSettings;
    }

    if (req.body.launchSettings) {
      const parsedLaunchSettings = JSON.parse(req.body.launchSettings);
      eventData.launchSettings = parsedLaunchSettings;
    }

    // Debug logging
    console.log(
      "Parsed eventData for update:",
      JSON.stringify(eventData, null, 2)
    );
  } catch (error) {
    console.error("JSON parsing error:", error);
    return next(
      new AppError(`Invalid JSON data in form fields: ${error.message}`, 400)
    );
  }

  // Find existing event
  const existingEvent = await Event.findById(req.params.id);

  if (!existingEvent) {
    return next(new AppError("No event found with that ID", 404));
  }

  // Check if user is authorized to update this event
  if (existingEvent.host.toString() !== req.user.id) {
    return next(
      new AppError("You are not authorized to update this event", 403)
    );
  }

  // Handle template image upload
  if (req.file) {
    const templateImagePath = getRelativeFilePath(req.file);
    if (eventData.invitationSettings) {
      eventData.invitationSettings.templateImage = templateImagePath;
    } else {
      eventData.invitationSettings = { templateImage: templateImagePath };
    }
  }

  // Update event data (excluding guestList)
  const updatedEvent = await Event.findByIdAndUpdate(req.params.id, eventData, {
    new: true,
    runValidators: true,
  });

  // Update guests if guestList is provided
  if (guestList && Array.isArray(guestList)) {
    const guestIds = await updateGuestsFromList(
      guestList,
      updatedEvent._id,
      existingEvent.guestList
    );

    // Update event with new guest references
    updatedEvent.guestList = guestIds;
    await updatedEvent.save();

    // Update guest statistics
    await updatedEvent.updateGuestStats();
  }

  // Populate and return the complete event
  const populatedEvent = await Event.findById(updatedEvent._id)
    .populate("host", "username email phoneNumber")
    .populate("guestList", "name email phone status rsvp checkIn invitation");

  res.status(200).json({
    status: "success",
    data: {
      event: populatedEvent,
    },
  });
});

// Delete Event
exports.deleteEvent = catchAsync(async (req, res, next) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(new AppError("No event found with that ID", 404));
  }

  // Check if user is authorized to delete this event
  if (event.host.toString() !== req.user.id) {
    return next(
      new AppError("You are not authorized to delete this event", 403)
    );
  }

  // Delete all guests associated with this event
  await Guest.deleteMany({ event: req.params.id });

  // Delete the event
  await Event.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// Get Events by Host
exports.getEventsByHost = catchAsync(async (req, res, next) => {
  const hostId = req.params.hostId || req.user.id;

  // Check if user is authorized to view events for this host
  if (req.user.id !== hostId) {
    return next(
      new AppError("You are not authorized to view events for this host", 403)
    );
  }

  const events = await Event.findByHost(hostId);

  res.status(200).json({
    status: "success",
    results: events.length,
    data: {
      events,
    },
  });
});

// Get Upcoming Events
exports.getUpcomingEvents = catchAsync(async (req, res, next) => {
  const hostId = req.user ? req.user.id : null;

  const events = await Event.findUpcoming(hostId);

  res.status(200).json({
    status: "success",
    results: events.length,
    data: {
      events,
    },
  });
});

// Update Event Status
exports.updateEventStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new AppError("Status is required", 400));
  }

  const validStatuses = [
    "draft",
    "published",
    "ongoing",
    "completed",
    "cancelled",
  ];
  if (!validStatuses.includes(status)) {
    return next(new AppError("Invalid status value", 400));
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(new AppError("No event found with that ID", 404));
  }

  // Check if user is authorized to update this event
  if (event.host.toString() !== req.user.id) {
    return next(
      new AppError("You are not authorized to update this event", 403)
    );
  }

  event.status = status;
  await event.save();

  res.status(200).json({
    status: "success",
    data: {
      event,
    },
  });
});

// Get Event Statistics
exports.getEventStats = catchAsync(async (req, res, next) => {
  const event = await Event.findById(req.params.id).populate(
    "guestList",
    "status"
  );

  if (!event) {
    return next(new AppError("No event found with that ID", 404));
  }

  // Check if user is authorized to view this event
  if (event.host.toString() !== req.user.id) {
    return next(new AppError("You are not authorized to view this event", 403));
  }

  // Update guest statistics
  await event.updateGuestStats();

  res.status(200).json({
    status: "success",
    data: {
      stats: event.guestStats,
      guestStatusBreakdown: {
        invited: event.guestList.filter((g) => g.status === "invited").length,
        confirmed: event.guestList.filter((g) => g.status === "confirmed")
          .length,
        declined: event.guestList.filter((g) => g.status === "declined").length,
        attended: event.guestList.filter((g) => g.status === "attended").length,
        noResponse: event.guestList.filter((g) => g.status === "no-response")
          .length,
      },
    },
  });
});

// Using factory functions for additional operations
exports.deleteAllEvents = factory.deleteMany(Event);

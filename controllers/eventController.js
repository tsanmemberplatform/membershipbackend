const fs = require("fs");
const { Parser } = require("json2csv");
const sendMail = require("../utils/email");
const eventModel = require("../models/eventModel");
const cloudinary = require('../config/cloudinary');
const { auditTrailModel } = require("../models/auditTrailModel");
const { login } = require("./userController");
const ADMIN_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];
const handleError = (res, err, status = 500) => res.status(status).json({ status: false, message: err.message || "Internal Server Error" });


exports.createEvent = async (req, res) => {
  try {
    const { title, description, date, location, time } = req.body;

    if (!title || !description) {
      return res.status(400).json({ status: false, message: "Title and description are required" });
    }
    if (date) {
      const eventDate = new Date(date);
      const today = new Date();
      // Set time to 00:00:00 for comparison (ignore time zone)
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);

      if (eventDate < today) {
        return res.status(400).json({
          status: false,
          message: "You cannot create an event for a past date",
        });
      }
    }

    let photoUrl = null;

    if (req.file) {
      // Upload to cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "events",
      });
      photoUrl = result.secure_url;

      // Remove file from server
      fs.unlink(req.file.path, (err) => {
        if (err) console.error( "Error removing file:", err);
      });
    }

    const event = await eventModel.create({
      title,
      description,
      date,
      time,
      location,
      photoUrl,
      createdBy: req.user._id,
      approved: false,
    });
    

    res.status(201).json({
      status: true,
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};


exports.approveEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id).populate("createdBy", "fullName email stateScoutCouncil");
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });
    if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ status: false, message: "Not authorized" });
    if (req.user.role === "ssAdmin" && req.user.stateScoutCouncil !== event.stateScoutCouncil)
      return res.status(403).json({ status: false, message: "Cannot approve events outside your state" });

    const oldValue = event.approved ? "Approved" : "Pending";
    event.approved = true;
    await event.save();
    
    // ✅ Save to Audit Trail
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Event Approval",
      oldValue,
      newValue: "Approved",
      changedBy: req.user.fullName,
    });
    res.json({ status: true, message: "Event approved & published", event });
  } catch (err) { handleError(res, err); }
};


exports.rejectEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id).populate("createdBy", "fullName email stateScoutCouncil");
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });
    if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ status: false, message: "Not authorized" });
    if (req.user.role === "ssAdmin" && req.user.stateScoutCouncil !== event.stateScoutCouncil)
      return res.status(403).json({ status: false, message: "Cannot reject events outside your state" });

    const oldValue = event.title;
    await eventModel.findByIdAndDelete(req.params.id);
    
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Event Rejection",
      oldValue,
      newValue: "Rejected & Deleted",
      changedBy: req.user.fullName,
    });

    if (event.createdBy.email) {
      await sendMail({
        email: event.createdBy.email,
        subject: "Your Event Has Been Rejected",
        text: `Hello ${event.createdBy.fullName},\n\nYour event titled "${event.title}" has been rejected by the admin.`,
        html: `<p>Hello ${event.createdBy.fullName},</p><p>Your event titled "<strong>${event.title}</strong>" has been rejected by the admin.</p>`
      });
    }

    res.json({ status: true, message: "Event rejected, removed & organiser notified via email" });
  } catch (err) { handleError(res, err); }
};


exports.getEvents = async (req, res) => {
  try {
     const ADMIN_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];

    const query = ADMIN_ROLES.includes(req.user.role) ? {} : { approved: true };
     if (req.query.title){
      query.title = { $regex: req.query.title, $options: "i"};
     }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalEvents = await eventModel.countDocuments(query);

  
    const events = await eventModel.find(query)
      .populate("createdBy", "fullName email")
      .sort({ date: -1 }) // most recent first
      .skip(skip)
      .limit(limit);
      
    if (!events.length) {
      return res.status(404).json({
        status: false,
        message: "No events found matching your query",
      });
    }

    res.json({
      status: true,
      message: "Events Fetched Successfully",
      totalEvents,
      currentPage: page,
      totalPages: Math.ceil(totalEvents / limit),
      pageSize: events.length,
      events,
    });
  } catch (err) {
    handleError(res, err);
  }
};


exports.getEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id).populate("createdBy", "fullName email");
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });

    if (!event.approved && !ADMIN_ROLES.includes(req.user.role) &&
        event.createdBy._id.toString() !== req.user._id.toString())
      return res.status(403).json({ status: false, message: "Event not published yet" });
    if (ADMIN_ROLES.includes(req.user.role)) {
      await event.populate({
        path: "attendees.scout",
        select: "fullName section scoutingRole",
      });
    }

    res.json({ status: true, event });
  } catch (err) { handleError(res, err); }
};


// exports.updateEvent = async (req, res) => {
//   try {
//     let event = await eventModel.findById(req.params.id);
//     if (!event) return res.status(404).json({ status: false, message: "Event not found" });
//     if (event.createdBy.toString() !== req.user._id.toString() && !ADMIN_ROLES.includes(req.user.role))
//       return res.status(403).json({ status: false, message: "Not authorized" });

//     event = await eventModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
//     res.json({ status: true, message: "Event updated", event });
//   } catch (err) { handleError(res, err); }
// };


exports.updateEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }

    // 🔐 Allow only owner or admin
    if (
      event.createdBy.toString() !== req.user._id.toString() &&
      !ADMIN_ROLES.includes(req.user.role)
    ) {
      return res.status(403).json({
        status: false,
        message: "Not authorized to update this event",
      });
    }

    //  Handle image upload (if provided)
    if (req.file) {
      try {
        // If existing photo, remove it from Cloudinary first
        if (event.photoUrl) {
          const oldPublicId = event.photoUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(`tsan/events/${oldPublicId}`);
        }

        // Upload new image
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "tsan/events",
        });

        req.body.photoUrl = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload error:", uploadErr);
        return res.status(500).json({
          status: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    //  Update event data
    const updatedEvent = await eventModel.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.status(200).json({
      status: true,
      message: "Event updated successfully",
      event: updatedEvent,
    });
  } catch (err) {
    console.error("UPDATE EVENT ERROR:", err);
    res.status(500).json({
      status: false,
      message: "Server error: " + err.message,
    });
  }
};


exports.deleteEvent = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id);
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });
    if (event.createdBy.toString() !== req.user._id.toString() && !ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ status: false, message: "Not authorized" });

    const oldValue = event.title;
    await event.deleteOne();
    
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Event Deletion",
      oldValue,
      newValue: "Deleted",
      changedBy: req.user.fullName,
    });

    res.json({ status: true, message: "Event deleted" });
  } catch (err) { handleError(res, err); }
};

exports.registerForEvent = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Going", "Not Going", "Maybe"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ status: false, message: "Invalid RSVP status" });

    const event = await eventModel.findById(req.params.id);
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });
    if (!event.approved) return res.status(403).json({ status: false, message: "Event not published yet" });

    event.attendees = event.attendees.filter(a => a.scout.toString() !== req.user._id.toString());
    event.attendees.push({ scout: req.user._id, status });
    await event.save();

    await sendMail({
      email: req.user.email,
      subject: `Event Registration: ${event.title}`,
      text: `Hi ${req.user.fullName},\nYou have successfully registered for "${event.title}" with status: ${status}.`,
      html: `<p>Hi ${req.user.fullName},</p><p>You have successfully registered for "<strong>${event.title}</strong>" with status: <strong>${status}</strong>.</p>`
    });

    res.json({ status: true, message: `RSVP recorded as '${status}'`, eventId: event._id, rsvpStatus: status });
  } catch (err) { handleError(res, err); }
};

exports.cancelRegistration = async (req, res) => {  
  try {
    const event = await eventModel.findById(req.params.id);
    if (!event) return res.status(404).json({ status: false, message: "Event not found " });

    event.attendees = event.attendees.filter(a => a.scout.toString() !== req.user._id.toString());
    await event.save();

    await sendMail({
      email: req.user.email,
      subject: `Event Registration Cancelled: ${event.title}`,
      text: `Hi ${req.user.fullName},\nYou have successfully cancelled your registration for "${event.title}".`,
      html: `<p>Hi ${req.user.fullName},</p><p>You have successfully cancelled your registration for "<strong>${event.title}</strong>".</p>`
    });

    res.json({ status: true, message: "Registration cancelled" });
  } catch (err) { handleError(res, err); }
};

exports.getAttendees = async (req, res) => {
  try {
    const event = await eventModel.findById(req.params.id).populate("attendees.scout", "fullName email scoutingRole section stateScoutCouncil ");
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });

    const isAdmin = ["superAdmin", "nsAdmin", "ssAdmin"].includes(req.user.role);

    const attendees = event.attendees.map(a => ({
      ...(isAdmin ? { name: a.scout.fullName, email: a.scout.email } : {}),
      scoutingRole: a.scout.scoutingRole,
      section: a.scout.section,
      stateScoutCouncil: a.scout.stateScoutCouncil,
      status: a.status
    }));

    if (isAdmin) return res.json({ status: true, count: attendees.length, attendees });

    const summary = {
      going: attendees.filter(a => a.status === "Going").length,
      notGoing: attendees.filter(a => a.status === "Not Going").length,
      maybe: attendees.filter(a => a.status === "Maybe").length,
      total: attendees.length
    };

    res.json({ status: true, summary, attendees });
  } catch (err) { handleError(res, err); }
};

exports.exportAttendees = async (req, res) => {
  try {
    if (!["superAdmin", "nsAdmin", "ssAdmin"].includes(req.user.role))
      return res.status(403).json({ status: false, message: "Not authorized to export attendees" });

    const event = await eventModel.findById(req.params.id).populate("attendees.scout", "fullName email scoutingRole section stateScoutCouncil");
    if (!event) return res.status(404).json({ status: false, message: "Event not found" });

    const data = event.attendees.map((a, index) => ({
      No: index + 1,
      name: a.scout.fullName,
      email: a.scout.email,
      scoutingRole: a.scout.scoutingRole,
      section: a.scout.section,
      stateScoutCouncil: a.scout.stateScoutCouncil,
      status: a.status
    }));

    const csv = new Parser().parse(data);
    res.header("Content-Type", "text/csv");
    res.attachment(`event_${event._id}_attendees.csv`);
    res.send(csv);
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Export Attendees",
      oldValue: event.title,
      newValue: "Attendee CSV Exported",
      changedBy: req.user.fullName,
    });
  } catch (err) { handleError(res, err); }
};

exports.getMyEvents = async (req, res) => {
  try {
    const userId = req.user._id; // Logged-in user ID

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch events created by this user
    const [events, totalEvents] = await Promise.all([
      eventModel.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "fullName email"), // only expose safe fields
      eventModel.countDocuments({ createdBy: userId }),
    ]);

    if (!events || events.length === 0) {
      return res.status(404).json({
        status: true,
        message: "You haven't created any events yet",
      });
    }
    return res.status(200).json({
      status: true,
      message: "My events fetched successfully",
      totalEvents,
      currentPage: page,
      totalPages: Math.ceil(totalEvents / limit),
      pageSize: limit,
      events,
    });
  } catch (error) {
    console.error("Error fetching my events:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.getUpcomingEvents = async (req, res) => {
  try {
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));

  const query = {
  date: { $gte: startOfToday },
  approved: true,
};
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const totalEvents = await eventModel.countDocuments(query);
    
    const events = await eventModel.find(query)
      .populate("createdBy", "fullName email")
      .sort({ date: 1 }) 
      .skip(skip)
      .limit(limit);
    
    if (!events || events.length === 0) {
      return res.status(404).json({
        status: true,
        message: "No upcoming events found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Upcoming events fetched successfully",
      totalEvents,
      currentPage: page,
      totalPages: Math.ceil(totalEvents / limit),
      pageSize: events.length,
      events,
    });
  } catch (err) {
    console.error("Error fetching upcoming events:", err);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + err.message,
    });
  }
};


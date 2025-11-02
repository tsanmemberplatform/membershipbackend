const ActivityLog = require("../models/logModel");
const fs = require("fs").promises;
const cloudinary = require("../config/cloudinary");

exports.createLog = async (req, res) => {
  try {
    const { title, description, date, location } = req.body;

    if (!title) {
      return res.status(400).json({ status: false, message: "Title is required" });
    }

    let fileUrl = null;

    // If a file is uploaded, send it to Cloudinary
    if (req.file) {
      const upload = await cloudinary.uploader.upload(req.file.path, {
        folder: "activity_logs",
        resource_type: "auto", 
      });

      fileUrl = upload.secure_url;
      await fs.unlink(req.file.path);
    }

    const log = await ActivityLog.create({
      scout: req.user._id,
      title,
      location,
      description,
      date,
      fileUrl,
    });

    res.status(201).json({ status: true, message: "Activity log created", log });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

  // Get all logs for logged-in scout
exports.getMyLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // default page = 1
    const limit = 4; // fixed page size
    const skip = (page - 1) * limit;

    // Fetch logs and total count simultaneously
    const [logs, totalLogs] = await Promise.all([
      ActivityLog.find({ scout: req.user._id })
        .sort({ date: -1 }) // latest first
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments({ scout: req.user._id })
    ]);

    if (!logs.length) {
      return res.status(404).json({
        status: false,
        message: "No logs found for this user"
      });
    }

    res.status(200).json({
      status: true,
      message: "Logs fetched successfully",
      totalLogs,
      currentPage: page,
      totalPages: Math.ceil(totalLogs / limit),
      pageSize: limit,
      logs
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message
    });
  }
};

 
exports.getAllLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const totalLogs = await ActivityLog.countDocuments();

    const logs = await ActivityLog.find()
      .populate("scout", "fullName membershipId email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      status: true,
      totalLogs,
      currentPage: page,
      totalPages: Math.ceil(totalLogs / limit),
      pageSize: logs.length,
      logs,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

  // Get a single log
exports.getLogById = async (req, res) => {
    try {
      const log = await ActivityLog.findById(req.params.id)
        .populate("scout", "fullName membershipId email");
      if (!log) return res.status(404).json({ status: false, message: "Activity log not found" });

      // Only owner or admin/leader can view
      if (req.user._id.toString() !== log.scout._id.toString() &&
          !["admin", "nsAdmin", "ssAdmin", "leader"].includes(req.user.role)) {
        return res.status(403).json({ status: false, message: "Not authorized" });
      }

      res.json({ status: true, log });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
  };

  // Update log (only owner)
exports.updateLog = async (req, res) => {
    try {
      const log = await ActivityLog.findById(req.params.id);
      if (!log) return res.status(404).json({ status: false, message: "Activity log not found" });

      if (log.scout.toString() !== req.user._id.toString()) {
        return res.status(403).json({ status: false, message: "Not authorized to update this log" });
      }

      Object.assign(log, req.body);
      await log.save();

      res.json({ status: true, message: "Activity log updated", log });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
  };

  // Delete log (owner or admin)
exports.deleteLog = async (req, res) => {
    try {
      const log = await ActivityLog.findById(req.params.id);
      if (!log) return res.status(404).json({ status: false, message: "Activity log not found" });

      if (log.scout.toString() !== req.user._id.toString() &&
          !["admin", "nsAdmin", "ssAdmin"].includes(req.user.role)) {
        return res.status(403).json({ status: false, message: "Not authorized to delete this log" });
      }

    const oldValue = log.activityType || "N/A";
    await log.deleteOne();
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Activity Log Deletion",
      oldValue,
      newValue: "Deleted",
      changedBy: req.user.fullName,
    });

      res.json({ status: true, message: "Activity log deleted" });
    } catch (error) {
      res.status(500).json({ status: false, message: error.message });
    }
};

const { userModel } = require("../models/userModel");
const { auditTrailModel } = require("../models/auditTrailModel");
const trainingModel = require("../models/trainingModel");
const cloudinary = require("../config/cloudinary");
const messageModel = require("../models/messageModel");
const crypto = require("crypto");
const { Parser } = require("json2csv");
const invitationModel = require("../models/invitationModel");
const { inviteUserMail, rejectionMailTemplate, approvalMailTemplate } = require("../utils/mailTemplates");
const sendMail = require("../utils/email");
const awardProgressModel = require("../models/awardProgressModel");
const eventModel = require("../models/eventModel");
const ActivityLog = require("../models/logModel");

// Promote User Role
exports.promoteRole = async (req, res) => {
  try {
    const { email, newRole, stateScoutCouncil } = req.body;

    if (!email || !newRole) {
      return res
        .status(400)
        .json({ status: false, message: "Email and newRole are required" });
    }

    const validRoles = ["member", "ssAdmin", "nsAdmin", "superAdmin"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ status: false, message: "Invalid role" });
    }

    const user = await userModel
      .findOne({ email: email.toLowerCase() })
      .select("-password");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (user.role === newRole) {
      return res.status(400).json({
        status: false,
        message: `User already has the role ${newRole}`,
      });
    }
    // 🔒 Permission Logic
    const currentUserRole = req.user.role;

    if (currentUserRole === "nsAdmin") {
      // nsAdmin cannot promote anyone to superAdmin
      if (newRole === "superAdmin") {
        return res.status(403).json({
          status: false,
          message: "nsAdmin cannot promote a user to superAdmin role",
        });
      }

      // nsAdmin can only promote members
      if (user.role !== "member") {
        return res.status(403).json({
          status: false,
          message: "nsAdmin can only promote members",
        });
      }
    }
    // superAdmin can promote anyone (no restriction)

    // Map for readable role names
    const roleDisplayMap = {
      member: "Member",
      ssAdmin: "State Scout Admin",
      nsAdmin: "National Scout Admin",
      superAdmin: "Super Admin",
    };

    const displayNewRole = roleDisplayMap[newRole] || newRole;
    const displayOldRole = roleDisplayMap[user.role] || user.role;
    user.stateScoutCouncil = stateScoutCouncil?.trim() || "FCT Scout Council";

    // ✅ Audit trail logging
    await auditTrailModel.create({
      userId: user._id,
      field: "role",
      oldValue: displayOldRole,
      newValue: displayNewRole,
      changedBy: req.user.fullName,
      remarks: `${req.user.fullName} (${req.user.role}) promoted ${user.fullName} from ${displayOldRole} to ${displayNewRole}`,
      timestamp: new Date(),
    });

    user.role = newRole;
    await user.save();
    await sendMail({
      email: user.email,
      subject: "TSAN Role Promotion Notification",
      html: `
        <p>Hello ${user.fullName.split(" ")[0]},</p>
        <p>Congratulations!  You have been promoted to the role of <strong>${displayNewRole}</strong> on the TSAN platform.</p>
        <p>You can access your admin dashboard using the same login credentials</p>
        <p> © ${new Date().getFullYear()} TSAN. All rights reserved.</p>
      `,
    });

    res.status(200).json({
      status: true,
      message: `User promoted to ${displayNewRole}`,
      data: { ...user._doc, role: displayNewRole },
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// Demote User Role
exports.demoteRole = async (req, res) => {
  try {
    const { email, newRole, stateScoutCouncil } = req.body;

    if (!email || !newRole) {
      return res
        .status(400)
        .json({ status: false, message: "email and newRole are required" });
    }

    const validRoles = ["member", "ssAdmin", "nsAdmin", "superAdmin"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ status: false, message: "Invalid role" });
    }

    const user = await userModel
      .findOne({ email: email.toLowerCase() })
      .select("-password");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (user.role === newRole) {
      return res.status(400).json({
        status: false,
        message: `User already has the role ${newRole}`,
      });
    }
    // 🔒 Permission Logic
    const currentUserRole = req.user.role;

    if (currentUserRole === "nsAdmin") {
      // nsAdmin cannot demote anyone to superAdmin
      if (newRole === "superAdmin") {
        return res.status(403).json({
          status: false,
          message: "nsAdmin cannot assign the superAdmin role",
        });
      }

      // nsAdmin can only demote members or lower admins
      if (user.role === "superAdmin") {
        return res.status(403).json({
          status: false,
          message: "nsAdmin cannot demote a superAdmin",
        });
      }
    }
    // Map for readable role names
    const roleDisplayMap = {
      member: "Member",
      ssAdmin: "State Scout Admin",
      nsAdmin: "National Scout Admin",
      superAdmin: "Super Admin",
    };

    const displayNewRole = roleDisplayMap[newRole] || newRole;
    const displayOldRole = roleDisplayMap[user.role] || user.role;
    user.stateScoutCouncil = stateScoutCouncil?.trim() || "FCT Scout Council";

    // ✅ Audit trail logging
    await auditTrailModel.create({
      userId: user._id,
      field: "role",
      oldValue: displayOldRole,
      newValue: displayNewRole,
      changedBy: req.user.fullName,
      remarks: `${req.user.fullName} (${req.user.role}) demoted ${user.fullName} from ${displayOldRole} to ${displayNewRole}`,
      timestamp: new Date(),
    });

    user.role = newRole;
    await user.save();

    await sendMail({
      email: user.email,
      subject: "TSAN Role Change Notification",
      html: `
        <p>Dear ${user.fullName},</p>
        <p>This is to inform you that your role on the TSAN platform has been changed to <strong>${displayNewRole}</strong>.</p>
        <p>If you believe this was made in error, please contact the TSAN Admin Team.</p>
        <p> © ${new Date().getFullYear()} TSAN. All rights reserved.</p>
      `,
    });

    res.status(200).json({
      status: true,
      message: `User demoted to ${displayNewRole}`,
      data: { ...user._doc, role: displayNewRole },
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

exports.updateMemberStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;
    if (!userId || !status)
      return res
        .status(400)
        .json({ status: false, message: "userId and status are required" });

    const validStatuses = ["active", "inactive", "suspended"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ status: false, message: "Invalid status" });

    const user = await userModel.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    await auditTrailModel.create({
      userId: user._id,
      field: `Status`,
      oldValue: user.status,
      newValue: status,
      changedBy: req.user.fullName,
      remarks:`${req.user.fullName} (${req.user.role}) changed ${user.fullName} status to ${user.status}`,
      timestamp: new Date(),
    });

    user.status = status;
    await user.save();

    return res.status(200).json({
      status: true,
      message: `User status updated to ${status}`,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

exports.getMembersTrainingsByState = async (req, res) => {
  try {
    const { stateScoutCouncil } = req.user;

    // Leaders: only see their state's members
    let query = {};
    if (req.user.role === "leader") {
      query = { stateScoutCouncil };
    }

    // Admins: can see all (ssAdmin, nsAdmin, superAdmin)
    const trainings = await trainingModel
      .find()
      .populate(
        "scout",
        "fullName email membershipId stateScoutCouncil scoutingRole section"
      )
      .sort({ createdAt: 1 });

    res.json({ status: true, trainings });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Server error", error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sort = req.query.sort || "-createdAt";

    const filter = {};
    const role = req.user.role;

    /**
     *  ROLE VISIBILITY RULES
     */

    if (role === "superAdmin") {
      //  SEE EVERYTHING — NO FILTER
    }

    else if (role === "nsAdmin") {
      //  Cannot see superAdmins
      filter.role = { $ne: "superAdmin" };
    }

    else if (role === "ssAdmin") {
      //  State restriction
      filter.stateScoutCouncil = req.user.stateScoutCouncil;
    }

    /**
     *  OPTIONAL FILTERS
     */

    if (req.query.status) filter.status = req.query.status;
    if (req.query.section) filter.section = req.query.section;
    if (req.query.role) filter.role = req.query.role;

    if (req.query.fullName) {
      filter.fullName = { $regex: req.query.fullName, $options: "i" };
    }

    if (
      req.query.stateScoutCouncil &&
      role !== "ssAdmin"
    ) {
      filter.stateScoutCouncil = req.query.stateScoutCouncil.trim();
    }

    /**
     * QUERY
     */

    const totalUsers = await userModel.countDocuments(filter);

    const users = await userModel
      .find(filter)
      .select(
        "fullName membershipId role scoutingRole section stateScoutCouncil status lastSignedIn"
      )
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const roleDisplayMap = {
      superAdmin: "Super Admin",
      nsAdmin: "National Scout Admin",
      ssAdmin: "State Scout Admin",
      leader: "Scout Leader",
      member: "Member",
    };

    const formattedUsers = users.map((u) => ({
      ...u,
      displayRole: roleDisplayMap[u.role] || u.role,
    }));

    res.status(200).json({
      status: true,
      message: "Users fetched successfully",
      pagination: {
        totalUsers,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
      },
      data: formattedUsers,
    });

  } catch (error) {
    console.error("GET USERS ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};


exports.getUsersByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    if (!["active", "inactive", "suspended"].includes(status)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid status value" });
    }

    let filter = { status };

    if (req.user.role === "ssAdmin") {
      filter.stateScoutCouncil = req.user.stateScoutCouncil;
    }

    const users = await userModel
      .find(filter)
      .select("-password -authAppSecret -emailOtp -phoneOtp -resetOtp")
      .sort("-createdAt");

    res.status(200).json({
      status: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.getUserRoleStats = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "ssAdmin") {
      filter.stateScoutCouncil = req.user.stateScoutCouncil;
    }
    const roles = ["member", "leader", "ssAdmin", "nsAdmin", "superAdmin"];

    const roleCounts = {};

    for (const role of roles) {
      roleCounts[role] = await userModel.countDocuments({
        ...filter,
        role,
      });
    }
    const totalUsers = await userModel.countDocuments(filter);

    res.status(200).json({
      status: true,
      message: "User role statistics fetched successfully",
      data: {
        totalUsers,
        ...roleCounts,
      },
    });
  } catch (error) {
    console.error("GET USER ROLE STATISTICS ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getReportStatistics = async (req, res) => {
  try {
    const { range, stateScoutCouncil } = req.query;
    const { role, stateScoutCouncil: userCouncil } = req.user;

    const filter = {};

if (role === "ssAdmin") {
  // ssAdmin: locked to their council
  filter.stateScoutCouncil = userCouncil;
}

if (
  req.query.stateScoutCouncil &&
  req.query.stateScoutCouncil.trim() !== "" &&
  role !== "ssAdmin"
) {
  // superAdmin, nsAdmin, or leader/member (if allowed)
  filter.stateScoutCouncil = req.query.stateScoutCouncil.trim();
}

if (!filter.stateScoutCouncil) {
 
  if (["superAdmin", "nsAdmin"].includes(role)) {
   
  } else {
    // Regular leaders/members default to own council
    filter.stateScoutCouncil = userCouncil;
  }
}


    // 🗓 Date range filter
    const now = new Date();
    let startDate, endDate;

    switch (range) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case "yesterday":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "thisYear":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date();
        break;
      case "lastYear":
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      default:
        startDate = new Date("2025-08-01T00:00:00Z"); // all-time
        endDate = new Date();
        break;
    }

    filter.createdAt = { $gte: startDate, $lte: endDate };

    // 🧮 1️⃣ MEMBERSHIP GROWTH (grouped by date + section)
    const membershipGrowth = await userModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            section: "$section",
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const SECTIONS = ["Cub", "Scout", "Venturer", "Rover", "Volunteers"];
    const formattedGrowth = {};

    // ✅ Ensure every section is represented for every date
    membershipGrowth.forEach(({ _id: { date, section }, total }) => {
      if (!formattedGrowth[date]) {
        formattedGrowth[date] = SECTIONS.reduce((acc, s) => {
          acc[s] = 0;
          return acc;
        }, {});
      }
      formattedGrowth[date][section || "Volunteers"] = total;
    });

    // 👶 2️⃣ AGE DISTRIBUTION
    const users = await userModel.find(filter).select("dateOfBirth");
    const nowYear = new Date().getFullYear();
    const ageGroups = {
      "Under 11": 0,
      "11-16": 0,
      "17-20": 0,
      "21-22": 0,
      "Above 22": 0,
    };

    users.forEach((u) => {
      if (!u.dateOfBirth) return;
      const age = nowYear - new Date(u.dateOfBirth).getFullYear();
      if (age < 11) ageGroups["Under 11"]++;
      else if (age <= 16) ageGroups["11-16"]++;
      else if (age <= 20) ageGroups["17-20"]++;
      else if (age <= 22) ageGroups["21-22"]++;
      else ageGroups["Above 22"]++;
    });

    // 🚻 3️⃣ GENDER DISTRIBUTION
    const genderStats = await userModel.aggregate([
      { $match: filter },
      { $group: { _id: "$gender", total: { $sum: 1 } } },
    ]);

    // 🧭 4️⃣ SCOUTING ROLE DISTRIBUTION    
    const roleStats = await userModel.aggregate([
  { $group: {
      _id: { $toLower: { $trim: { input: "$scoutingRole" } } },
      total: { $sum: 1 }
    }
  },
  { $sort: { total: -1 } }
]);

    // ✅ FINAL RESPONSE
    res.status(200).json({
      status: true,
      message: "Report statistics fetched successfully",
      filterRange: range || "all",
      filtersApplied: {
        stateScoutCouncil: filter.stateScoutCouncil || "All",
        dateRange: { startDate, endDate },
      },
      data: {
        membershipGrowth: formattedGrowth,
        ageDistribution: ageGroups,
        genderDistribution: genderStats,
        scoutingRoleDistribution: roleStats,
      },
    });
  } catch (error) {
    console.error("REPORT STATISTICS ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


exports.sendMessageToScouts = async (req, res) => {
  try {
    const { subject, message, section } = req.body;
    const sender = req.user;

    if (!subject || !message) {
      return res.status(400).json({
        status: false,
        message: "Subject and message are required",
      });
    }

    // Determine recipients based on role
    let filter = {};

    if (sender.role === "ssAdmin") {
      filter.stateScoutCouncil = sender.stateScoutCouncil;
    }

    // // Optional section-based targeting
    if (section && section !== "all") {
      const validSections = ["Cub", "Scout", "Venturer", "Rover", "Volunteers"];
      if (!validSections.includes(section)) {
        return res.status(400).json({
          status: false,
          message: `Invalid section. Valid options: ${validSections.join(
            ", "
          )}`,
        });
      }
      filter.section = section;
    }
    // Find all users that match the filter
    const scouts = await userModel.find(filter).select("email fullName");

    if (!scouts.length) {
      return res.status(404).json({
        status: false,
        message: "No users found to send the message to",
      });
    }

    // Optional attachment
    let attachmentUrl = null;
    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "tsan_attachments",
      });
      attachmentUrl = uploaded.secure_url;
    }

    // Send emails individually (or in batches)
    for (const scout of scouts) {
      await sendMail({
        email: scout.email,
        subject,
        text: message,
        html: `<p>${message}</p>
               ${
                 attachmentUrl
                   ? `<p><a href="${attachmentUrl}">View Attachment</a></p>`
                   : ""
               }`,
      });
    }

    // Save in DB
    const newMessage = await messageModel.create({
      subject,
      message,
      sentBy: sender.fullName,
      sentById: sender._id,
      sentTo:
        sender.role === "ssAdmin"
          ? `${sender.stateScoutCouncil} - ${section || "All Scouts"}`
          : section
          ? section
          : "All Scouts",
      attachmentUrl,
    });

    await new auditTrailModel({
      userId: sender._id,
      field: "Message Sent",
      oldValue: "",
      newValue: `Sent message: ${subject} to ${
        sender.role === "ssAdmin"
          ? `${sender.stateScoutCouncil} - ${section || "All Sections"}`
          : section || "All Scouts"
      }`,
      changedBy: sender.fullName,
    }).save();

    res.status(200).json({
      status: true,
      message: `Message sent successfully to ${
        section && section !== "all" ? section : "all scouts"
      }`,
      data: {
        subject: newMessage.subject,
        sentBy: newMessage.sentBy,
        sentTo: newMessage.sentTo,
        dateSent: newMessage.dateSent,
        attachmentUrl: newMessage.attachmentUrl || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.getAllMessages = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : null;

    let filter = {};

    if (req.user.role === "ssAdmin") {
      const stateScoutCouncil = req.user.stateScoutCouncil;
      const stateUsers = await userModel
        .find({ stateScoutCouncil })
        .select("_id");

      const userIds = stateUsers.map((u) => u._id);
      filter.sentById = { $in: userIds };
    }
    
    //  Add search filter if query provided
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
        { sentBy: { $regex: search, $options: "i" } },
        { sentTo: { $regex: search, $options: "i" } },
      ];
    };
    const totalMessages = await messageModel.countDocuments(filter);

    const messages = await messageModel
      .find(filter)
      .sort("-dateSent")
      .select("subject sentBy sentTo attachmentUrl dateSent")
      .skip(skip)
      .limit(limit);


    const totalPages = Math.ceil(totalMessages / limit);

    res.status(200).json({
      status: true,
      message: "Messages fetched successfully",
      pagination: {
        totalMessages,
        currentPage: page,
        totalPages,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filter: search ? { search } : undefined,
      data: messages,
    });
  } catch (error) {
    console.error("GET ALL MESSAGES ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await messageModel.findById(id);
    if (!message) {
      return res.status(404).json({
        status: false,
        message: "Message not found",
      });
    }

    const sender = await userModel
      .findById(message.sentById)
      .select("stateScoutCouncil fullName");
    if (!sender) {
      return res.status(404).json({
        status: false,
        message: "Sender information not found",
      });
    }
    if (req.user.role === "ssAdmin") {
      if (req.user.stateScoutCouncil !== sender.stateScoutCouncil) {
        return res.status(403).json({
          status: false,
          message: "You can only delete messages from your State Scout Council",
        });
      }
    } else if (!["superAdmin", "nsAdmin"].includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "You are not authorized to delete messages",
      });
    }
    await messageModel.deleteOne({ _id: id });

    await new auditTrailModel({
      userId: req.user._id,
      field: "Message Deletion",
      oldValue: message.subject,
      newValue: "Message Deleted",
      changedBy: req.user.fullName,
    }).save();

    res.status(200).json({
      status: true,
      message: "Message deleted successfully",
      deletedMessageId: id,
      deletedBy: req.user.fullName,
      senderState: sender.stateScoutCouncil,
    });
  } catch (error) {
    console.error("DELETE MESSAGE ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getAllAuditTrails = async (req, res) => {
  try {
    const { role, stateScoutCouncil } = req.user;
    const { page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let filter = {};
    if (role === "ssAdmin") {
      const usersInCouncil = await userModel
        .find({ stateScoutCouncil })
        .select("_id");
      const userIds = usersInCouncil.map((u) => u._id);
      filter.userId = { $in: userIds };
    } else if (["superAdmin", "nsAdmin"].includes(role)) {
      filter = {};
    } else {
      return res.status(403).json({
        status: false,
        message:
          "Access denied. Only SuperAdmin, NSAdmin, or SSAdmin can view audit trails.",
      });
    }

    const total = await auditTrailModel.countDocuments(filter);
    const auditTrails = await auditTrailModel
      .find(filter)
      .populate("userId", "fullName email role stateScoutCouncil")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      status: true,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      data: auditTrails,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.exportReportStatistics = async (req, res) => {
  try {
    // 🔒 Authorization check
    if (!["superAdmin", "nsAdmin", "ssAdmin"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ status: false, message: "Not authorized to export reports" });
    }

    const { range } = req.query;
    const filter = {};

    // 🎯 Restrict ssAdmin to their state scout council
    if (req.user.role === "ssAdmin") {
      filter.stateScoutCouncil = req.user.stateScoutCouncil;
    }

    const now = new Date();
    let startDate, endDate;

    // 🕓 Define date range filter
    switch (range) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;

      case "yesterday":
        startDate = new Date();
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "last30days":
        startDate = new Date();
        startDate.setDate(now.getDate() - 30);
        endDate = new Date();
        break;

      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;

      case "lastYear":
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;

      default:
        startDate = new Date(0);
        endDate = new Date();
        break;
    }

    filter.createdAt = { $gte: startDate, $lte: endDate };

    // 👥 Fetch users
    const users = await userModel
      .find(filter)
      .select(
        "fullName email gender scoutingRole stateScoutCouncil dateOfBirth createdAt"
      );

    const nowYear = new Date().getFullYear();
    const ageGroups = {
      "Under 18": 0,
      "18-25": 0,
      "26-35": 0,
      "36-50": 0,
      "Above 50": 0,
    };

    // 📊 Age group calculation
    users.forEach((u) => {
      if (!u.dateOfBirth) return;
      const age = nowYear - new Date(u.dateOfBirth).getFullYear();
      if (age < 18) ageGroups["Under 18"]++;
      else if (age <= 25) ageGroups["18-25"]++;
      else if (age <= 35) ageGroups["26-35"]++;
      else if (age <= 50) ageGroups["36-50"]++;
      else ageGroups["Above 50"]++;
    });

    // ⚧ Gender statistics
    const genderStats = await userModel.aggregate([
      { $match: filter },
      { $group: { _id: "$gender", total: { $sum: 1 } } },
    ]);

    // 🧭 Scouting role distribution
    const roleStats = await userModel.aggregate([
      { $match: filter },
      { $group: { _id: "$scoutingRole", total: { $sum: 1 } } },
    ]);

    // 🔢 Number the rows
    let count = 1;
    const userData = users.map((user) => ({
      No: count++,
      FullName: user.fullName,
      Email: user.email,
      Gender: user.gender,
      ScoutingRole: user.scoutingRole,
      StateScoutCouncil: user.stateScoutCouncil,
      DateOfBirth: user.dateOfBirth
        ? new Date(user.dateOfBirth).toLocaleDateString()
        : "N/A",
      RegisteredOn: new Date(user.createdAt).toLocaleString(),
    }));

    // 🧮 Summary section
    const summaryData = [
      { Section: "Age Distribution", Value: JSON.stringify(ageGroups) },
      { Section: "Gender Distribution", Value: JSON.stringify(genderStats) },
      { Section: "Scouting Roles", Value: JSON.stringify(roleStats) },
    ];

    // 📁 Final CSV data
    const csvData = [
      { Report: "Scout Statistics Report" },
      { Range: range || "all" },
      {},
      { Section: "Summary Statistics" },
      ...summaryData,
      {},
      { Section: "User Details" },
      ...userData,
    ];

    // 🧾 Parse to CSV
    const parser = new Parser();
    const csv = parser.parse(csvData);

    // 📤 Set headers for download
    res.header("Content-Type", "text/csv");
    res.attachment(
      `scout_statistics_${range || "all"}_${
        req.user.role === "ssAdmin" ? req.user.stateScoutCouncil : "all"
      }.csv`
    );
    res.send(csv);

    // 🪵 Log action to audit trail
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Export Report Statistics",
      oldValue: "N/A",
      newValue: `Exported ${range || "all"} report data`,
      changedBy: req.user.fullName,
    });
  } catch (error) {
    console.error("EXPORT REPORT ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Failed to export report statistics",
      error: error.message,
    });
  }
};

exports.inviteUser = async (req, res) => {
  try {
    const { fullName, email, role, council } = req.body;

    if (!["superAdmin", "nsAdmin"].includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message:
          "Access denied — only Super Admin or NS Admin can invite users.",
      });
    }

    if (!["ssAdmin", "nsAdmin", "superAdmin"].includes(role)) {
      return res.status(400).json({
        status: false,
        message: "Invalid role. Must be ssAdmin, nsAdmin, or superAdmin.",
      });
    }
    const assignedCouncil =
      council && council.trim() !== "" ? council : "FCT Scout Council";
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(404).json({
        status: false,
        message: "User already exists on TSAN Platform.",
      });
    }

    const existingInvite = await invitationModel.findOne({
      email: req.body.email,
    });

    if (existingInvite && existingInvite.expiresAt > new Date()) {
      return res.status(400).json({
        status: false,
        message: "Invitation already sent and still valid.",
      });
    }
    // ✅ Convert role to human-readable format
    const roleDisplayMap = {
      ssAdmin: "State Scout Admin",
      nsAdmin: "National Scout Admin",
      superAdmin: "Super Admin",
    };
    const displayRole = roleDisplayMap[role] || role;

    // Split fullName into first and last
    const [first = "", last = ""] = fullName.trim().split(" ");
    const inviteLink = `${process.env.FRONTEND_ONBOARDING_URL}/${first}/${last}/${role}/${council}/${email}`;

    const invite = new invitationModel({
      fullName,
      email,
      role,
      council: assignedCouncil,
      invitedBy: req.user._id,
      inviteLink,
    });

    // ✅ Send mail with the proper HTML template
    await sendMail({
      email,
      subject: "TSAN Invitation ",
      text: ` Join TSAN platform as ${displayRole}`,
      html: inviteUserMail(
        invite.fullName,
        displayRole,
        invite.council,
        inviteLink
      ),
    });

    await invite.save();
    await auditTrailModel.create({
      userId: req.user._id,
      field: "User Invitation",
      oldValue: null,
      newValue: JSON.stringify({ fullName, email, role, council }),
      changedBy: req.user.fullName,
      timestamp: new Date(),
      remarks: `${req.user.role} invited ${fullName} (${email}) as ${displayRole}`,
    });

    res.status(201).json({
      status: true,
      message: "Invitation sent successfully.",
      data: {
        fullName,
        email,
        role: displayRole,
        council: assignedCouncil,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error("INVITE ERROR:", error);
    res
      .status(500)
      .json({ status: false, message: "Server error while inviting user." });
  }
};

exports.resendInvitation = async (req, res) => {
  try {
    const { email } = req.body;

    const invitation = await invitationModel.findOne({ email });
    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    if (invitation.status === "accepted") {
      return res
        .status(400)
        .json({ success: false, message: "User already onboarded." });
    }

    // Generate new token & expiration
    const newToken = crypto.randomBytes(20).toString("hex");
    invitation.token = newToken;
    invitation.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    invitation.status = "resent";
    await invitation.save();

    const inviteLink = `${process.env.FRONTEND_URL}/onboarding?inviteToken=${newToken}`;

    // ✅ Send mail with the proper HTML template
    await sendMail({
      email,
      subject: "TSAN Invitation Resent",
      text: "Complete Your Onboarding",
      html: inviteUserMail(invitation.fullName, invitation.role, inviteLink),
    });

    await sendMail({
      email,
      subject: "TSAN Welcome Email",
      text: `Your OTP`,
      html: welcomeMail(emailOtp, newUser.fullName),
    });

    res
      .status(200)
      .json({ success: true, message: "Invitation resent successfully." });
  } catch (error) {
    console.error("RESEND INVITE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending invite.",
    });
  }
};

exports.getUserWithAllDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.user;

    const user = await userModel
      .findById(id)
      .select(
        "fullName membershipId profilePic section scoutingRole stateScoutCouncil role email status dateOfBirth gender stateOfOrigin lga address phoneNumber scoutDivision scoutDistrict troop"
      );
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    // Role-based access check
    if (admin.role === "ssAdmin" && admin.state !== user.stateScoutCouncil) {
      return res
        .status(403)
        .json({ status: false, message: "Access denied: Different state" });
    }

    if (!["ssAdmin", "nsAdmin", "superAdmin"].includes(admin.role)) {
      return res.status(403).json({
        status: false,
        message: "You don’t have access to this resource",
      });
    }

    // Fetch related data
    const [awards, trainings, events, activities] = await Promise.all([
      awardProgressModel.find({ scout: id }),
      trainingModel.find({ scout: id }),
      eventModel.find({ createdBy: id }),
      ActivityLog.find({ scout: id }),
    ]);

    res.status(200).json({
      status: true,
      message: "User details fetched successfully",
      data: {
        user,
        awards,
        trainings,
        events,
        activities,
      },
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.manageAllEvents = async (req, res) => {
  try {
    const ADMIN_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const { status } = req.query;
    const query = {};

    // Filter by approval status
    if (status) {
      if (status === "pending") query.approved = false;
      else if (status === "approved") query.approved = true;
      else {
        return res.status(400).json({
          status: false,
          message: "Invalid status filter. Use 'pending' or 'approved'.",
        });
      }
    }

    // 🔒 Limit ssAdmin to their own stateScoutCouncil
    if (req.user.role === "ssAdmin") {
      query["createdBy"] = {
        $in: await eventModel.db
          .collection("users")
          .find(
            { stateScoutCouncil: req.user.stateScoutCouncil },
            { projection: { _id: 1 } }
          )
          .map((u) => u._id)
          .toArray(),
      };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch results
    const totalEvents = await eventModel.countDocuments(query);

    const events = await eventModel
      .find(query)
      .populate("createdBy", "fullName email stateScoutCouncil")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      status: true,
      message: `Fetched ${status || "all"} events successfully`,
      totalEvents,
      currentPage: page,
      totalPages: Math.ceil(totalEvents / limit),
      pageSize: events.length,
      events,
    });
  } catch (error) {
    console.error("Error managing events:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.manageAllRecords = async (req, res) => {
  try {
    const ADMIN_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const { status } = req.query;

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Initialize filters
    const eventQuery = {};
    const trainingQuery = {};
    const awardQuery = {};
    

    // 🔍 Map logical status to actual database fields
    if (status) {
      switch (status) {
        case "pending":
          eventQuery.approved = false;
          trainingQuery.status = { $in: ["Pending", "pending", false] };
          awardQuery.status = { $in: ["in-progress", "pending", false] };
          
          break;

        case "active":
          eventQuery.approved = true;
          trainingQuery.status = {
            $in: ["Active", "active", "completed", "Verified", true],
          };
          awardQuery.status = { $in: ["approved", "active", "Active", true] };
          break;

        case "expired":
          eventQuery.status = { $in: ["Expired", "expired", "closed"] };
          trainingQuery.status = { $in: ["Expired", "expired", "Rejected"] };
          awardQuery.status = { $in: ["expired", "Expired"] };
          break;

        case "verified":
          trainingQuery.status = { $in: ["Verified", "verified", true] };
          break;

        default:
          return res.status(400).json({
            status: false,
            message:
              "Invalid status. Use 'pending', 'active', 'expired', or 'verified'.",
          });
      }
    }

    // 🔒 ssAdmin restriction to their stateScoutCouncil (for events only)
    if (req.user.role === "ssAdmin") {
      eventQuery["createdBy"] = {
        $in: await eventModel.db
          .collection("users")
          .find(
            { stateScoutCouncil: req.user.stateScoutCouncil },
            { projection: { _id: 1 } }
          )
          .map((u) => u._id)
          .toArray(),
      };
    }

    // Fetch all in parallel for speed ⚡
    const [events, trainings, awards, logs] = await Promise.all([
      eventModel
        .find(eventQuery)
        .populate("createdBy", "fullName section email stateScoutCouncil")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      trainingModel
        .find(trainingQuery)
        .populate("scout", "fullName section email membershipId section")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      awardProgressModel
        .find(awardQuery)
        .populate("scout", "fullName section email membershipId section")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

    ]);

    // Counts
    const [totalEvents, totalTrainings, totalAwards ] =
      await Promise.all([
        eventModel.countDocuments(eventQuery),
        trainingModel.countDocuments(trainingQuery),
        awardProgressModel.countDocuments(awardQuery),
        
      ]);

    res.status(200).json({
      status: true,
      message: `Fetched ${status || "all"} records successfully`,
      filter: status || "all",
      pagination: {
        currentPage: page,
        limit,
        eventsCount: totalEvents,
        trainingsCount: totalTrainings,
        awardsCount: totalAwards
       
      },
      data: {
        events,
        trainings,
        awards,
        activityLogs: logs,
      },
    });
  } catch (error) {
    console.error("Error fetching all records:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.getAllAdmins = async (req, res) => {
  try {
    const ADMIN_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];
    const ALLOWED_FILTER_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];

    // Check permission
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const {
      name,
      role,
      stateScoutCouncil,
      page = 1,
      limit = 10,
      sort = "desc",
    } = req.query;

    const query = { role: { $in: ALLOWED_FILTER_ROLES } };

    // 🔍 Filtering
    if (name) {
      query.fullName = { $regex: name, $options: "i" };
    }
    if (role) {
      query.role = role;
    }
    if (stateScoutCouncil) {
      query.stateScoutCouncil = { $regex: stateScoutCouncil, $options: "i" };
    }

    // 🔒 Restrict ssAdmin to their own state
    if (req.user.role === "ssAdmin") {
      query.stateScoutCouncil = req.user.stateScoutCouncil;
    }

    // Pagination setup
    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * pageSize;

    // Sorting (default: newest first)
    const sortOrder = sort === "asc" ? 1 : -1;

    // Fetch total and paginated results
    const totalAdmins = await userModel.countDocuments(query);

    const admins = await userModel
      .find(query)
      .select("fullName email role stateScoutCouncil status lastSignedIn")
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(pageSize);

    res.status(200).json({
      status: true,
      message: "Admins fetched successfully",
      totalAdmins,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalAdmins / pageSize),
      pageSize: admins.length,
      data: admins,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

//  Admin Edit User details
exports.adminEditUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      stateOfOrigin,
      lga,
      address,
      profilePic,
      stateScoutCouncil,
      scoutDivision,
      scoutDistrict,
      troop,
      scoutingRole,
      section,
    } = req.body;

    if (!["superAdmin", "nsAdmin", "ssAdmin"].includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Only admins can edit user details.",
      });
    }

    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }
     // Check if email already exists (excluding current user)
    if (email && email !== user.email) {
      const existingEmail = await userModel.findOne({ email });
      if (existingEmail && existingEmail._id.toString() !== id) {
        return res.status(400).json({
          status: false,
          message: "Email already exists. Please use a different email.",
        });
      }
    }

    // Check if phone number already exists (excluding current user)
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const existingPhone = await userModel.findOne({ phoneNumber });
      if (existingPhone && existingPhone._id.toString() !== id) {
        return res.status(400).json({
          status: false,
          message: "Phone number already exists. Please use a different number.",
        });
      }
    }

    // Keep old data for audit trail
    const oldData = {
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      stateOfOrigin: user.stateOfOrigin,
      lga: user.lga,
      address: user.address,
      profilePic: user.profilePic,
      stateScoutCouncil: user.stateScoutCouncil,
      scoutDivision: user.scoutDivision,
      scoutDistrict: user.scoutDistrict,
      troop: user.troop,
      scoutingRole: user.scoutingRole,
      section: user.section,
    };

    // 🧠 Update fields if provided
    if (fullName) user.fullName = fullName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (email) user.email = email;
    if (gender) user.gender = gender;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (stateOfOrigin) user.stateOfOrigin = stateOfOrigin;
    if (lga) user.lga = lga;
    if (address) user.address = address;
    if (profilePic) user.profilePic;
    if (stateScoutCouncil) user.stateScoutCouncil = stateScoutCouncil;
    if (scoutDivision) user.scoutDivision = scoutDivision;
    if (scoutDistrict) user.scoutDistrict = scoutDistrict;
    if (troop) user.troop = troop;
    if (scoutingRole) user.scoutingRole = scoutingRole;
    if (section) user.section = section;

    await user.save();

    // 🧾 Log admin action in audit trail
    await auditTrailModel.create({
      userId: req.user._id,
      field: "User Profile Edit",
      oldValue: JSON.stringify(oldData),
      newValue: JSON.stringify({
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        phoneNumber: user.phoneNumber,
        stateOfOrigin: user.stateOfOrigin,
        lga: user.lga,
        address: user.address,
        profilePic: user.profilePic,
        stateScoutCouncil: user.stateScoutCouncil,
        scoutDivision: user.scoutDivision,
        scoutDistrict: user.scoutDistrict,
        troop: user.troop,
        scoutingRole: user.scoutingRole,
        section: user.section,
      }),
      changedBy: req.user.fullName,
      remarks: `${req.user.role} updated user profile (${user.fullName})`,
    });

    return res.status(200).json({
      status: true,
      message: "User details updated successfully.",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Server error: " + error.message,
    });
  }
};

//  Search Event by Title
exports.searchEventsByTitle = async (req, res) => {
  try {
    const { title } = req.query;

    const allowedRoles = ["superAdmin", "nsoAdmin", "sscAdmin", "ssAdmin"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Only admins can search events.",
      });
    }

    if (!title) {
      return res.status(400).json({
        status: false,
        message: "Please provide a title to search",
      });
    }

    // Case-insensitive regex search
    const events = await eventModel
      .find({
        title: { $regex: title, $options: "i" },
      })
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 });

    if (!events.length) {
      return res.status(404).json({
        status: false,
        message: "No events found matching your search",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Events fetched successfully",
      results: events.length,
      data: events,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Server error: " + error.message,
    });
  }
};

exports.countUserStatus = async (req, res) => {
  try {
    //  Restrict access
    if (!["superAdmin", "nsAdmin", "ssAdmin"].includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Only admins can view user statistics.",
      });
    }

    // 📊 Count users by status
    const [activeCount, inactiveCount, suspendedCount, totalCount] =
      await Promise.all([
        userModel.countDocuments({ status: "active" }),
        userModel.countDocuments({ status: "inactive" }),
        userModel.countDocuments({ status: "suspended" }),
        userModel.countDocuments(),
      ]);

    return res.status(200).json({
      status: true,
      message: "User statistics retrieved successfully.",
      data: {
        active: activeCount,
        inactive: inactiveCount,
        suspended: suspendedCount,
        total: totalCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

const identifyItem = async (id) => {
  const award = await awardProgressModel
    .findById(id)
    .populate("scout", "fullName email");
  if (award) return { type: "award", model: award };

  const event = await eventModel
    .findById(id)
    .populate("createdBy", "fullName email");
  if (event) return { type: "event", model: event };

  const training = await trainingModel
    .findById(id)
    .populate("scout", "fullName email");
  if (training) return { type: "training", model: training };

  return null;
};

exports.acceptItem = async (req, res) => {
  try {
    const { id } = req.params;

    const itemInfo = await identifyItem(id);
    if (!itemInfo)
      return res.status(404).json({ status: false, message: "Item not found" });

    const { type, model: item } = itemInfo;
    const user = req.user;

    let oldValue;
    let recipientEmail;
    let recipientName;
    let newValue = "Approved";
    let title;
    let message;

    // ---- Update Logic ----
    if (type === "training") {
      oldValue = item.status;
      item.status = "Verified";
      item.verified = true;
      item.verifiedBy = user._id;
      item.verificationLevel = user.role;
      item.verifiedAt = new Date();
      recipientEmail = item.scout.email;
      recipientName = item.scout.fullName;
      title = "Training Verified";
      message = `Your training "${item.trainingType}" has been verified successfully.`;
    } else if (type === "event") {
      oldValue = item.approved;
      item.approved = true;
      recipientEmail = item.createdBy.email;
      recipientName = item.createdBy.fullName;
      title = "Event Approved";
      message = `Your event "${item.title}" has been approved successfully.`;
    } else {
      oldValue = item.status;
      item.status = "approved";
      item.completedAt = new Date();
      recipientEmail = item.scout.email;
      recipientName = item.scout.fullName;
      title = "Award Approved";
      message = `Your award "${item.awardName}" has been approved successfully.`;
    }

    await item.save();

    // ---- Audit Trail ----
    await auditTrailModel.create({
      userId: user._id,
      field: `${type.toUpperCase()} Approval`,
      oldValue: String(oldValue),
      newValue,
      changedBy: user.fullName,
    });

    // ✅ Convert role to human-readable format
    const roleDisplayMap = {
      ssAdmin: "State Scout Admin",
      nsAdmin: "National Scout Admin",
      superAdmin: "Super Admin",
    };
    const displayRole = roleDisplayMap[user.role] || user.role;

    await sendMail({
      email: recipientEmail,
      subject: title,
      text: `Approval Notification`,
      html: approvalMailTemplate(
        recipientName,
        message,
        user.fullName,
        displayRole
      ),
    });

    res.status(200).json({
      status: true,
      message: `${type} approved successfully`,
      data: item,
    });
  } catch (error) {
    console.error("APPROVAL ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Server error: " + error.message,
    });
  }
};

exports.rejectItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const itemInfo = await identifyItem(id);
    if (!itemInfo)
      return res.status(404).json({ status: false, message: "Item not found" });

    const { type, model: item } = itemInfo;
    const user = req.user;

    let oldValue;
    let recipientEmail;
    let recipientName;
    let newValue = "Rejected";
    let title;
    let message;

    // ---- Update Logic ----
    if (type === "training") {
      oldValue = item.status;
      item.status = "Rejected";
      item.verified = false;
      item.rejectionReason = reason || "No reason provided";
      item.verifiedBy = user._id;
      item.verificationLevel = user.role;
      item.verifiedAt = new Date();
      recipientEmail = item.scout.email;
      recipientName = item.scout.fullName;
      title = "Training Rejected";
      message = `Your training "${item.trainingType}" has been rejected. Reason: ${item.rejectionReason}`;
    } else if (type === "event") {
      oldValue = item.approved;
      item.approved = false;
      item.rejectionReason = reason || "No reason provided";
      recipientEmail = item.createdBy.email;
      recipientName = item.createdBy.fullName;
      title = "Event Rejected";
      message = `Your event "${item.title}" has been rejected. Reason: ${item.rejectionReason}`;
    } else {
      oldValue = item.status;
      item.status = "rejected";
      item.rejectionReason = reason || "No reason provided";
      recipientEmail = item.scout.email;
      recipientName = item.scout.fullName;
      title = "Award Rejected";
      message = `Your award "${item.awardName}" has been rejected. Reason: ${item.rejectionReason}`;
    }

    await item.save();

    // ---- Audit Trail ----
    await auditTrailModel.create({
      userId: user._id,
      field: `${type.toUpperCase()} Rejection`,
      oldValue: String(oldValue),
      newValue,
      changedBy: user.fullName,
    });
    //  Convert role to human-readable format
    const roleDisplayMap = {
      ssAdmin: "State Scout Admin",
      nsAdmin: "National Scout Admin",
      superAdmin: "Super Admin",
    };
    const displayRole = roleDisplayMap[user.role] || role;

    await sendMail({
      email: recipientEmail,
      subject: title,
      text: `Rejection Notification`,
      html: rejectionMailTemplate(recipientName, message,
        user.fullName,
        displayRole
      ),
    });

    res.status(200).json({
      status: true,
      message: `${type} rejected successfully`,
      data: item,
    });
  } catch (error) {
    console.error("REJECTION ERROR:", error);
    res.status(500).json({
      status: false,
      message: "Server error: " + error.message,
    });
  }
};

exports.getAllRecordStats = async (req, res) => {
  try {
    const ADMIN_ROLES = ["superAdmin", "nsAdmin", "ssAdmin"];
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        status: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    // Restrict ssAdmin to their stateScoutCouncil
    let eventFilter = {};
    if (req.user.role === "ssAdmin") {
      const stateUserIds = await eventModel.db
        .collection("users")
        .find(
          { stateScoutCouncil: req.user.stateScoutCouncil },
          { projection: { _id: 1 } }
        )
        .map((u) => u._id)
        .toArray();

      eventFilter.createdBy = { $in: stateUserIds };
    }

    // Perform all counts in parallel ⚡
    const [
      // Event counts
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,

      // Training counts
      totalTrainings,
      pendingTrainings,
      approvedTrainings,
      rejectedTrainings,

      // Award counts
      totalAwards,
      pendingAwards,
      approvedAwards,
      rejectedAwards,
    ] = await Promise.all([
      // ---- EVENTS ----
      eventModel.countDocuments(eventFilter),
      eventModel.countDocuments({ ...eventFilter, approved: false }),
      eventModel.countDocuments({ ...eventFilter, approved: true }),
      eventModel.countDocuments({
        ...eventFilter,
        approved: false,
        rejectionReason: { $exists: true },
      }),

      // ---- TRAININGS ----
      trainingModel.countDocuments(),
      trainingModel.countDocuments({ status: { $in: ["Pending", "pending", false] } }),
      trainingModel.countDocuments({ status: { $in: ["Verified", "verified", true] } }),
      trainingModel.countDocuments({ status: { $in: ["Rejected", "rejected"] } }),

      // ---- AWARDS ----
      awardProgressModel.countDocuments(),
      awardProgressModel.countDocuments({ status: { $in: ["in-progress", "pending", false] } }),
      awardProgressModel.countDocuments({ status: { $in: ["approved", "Approved", true] } }),
      awardProgressModel.countDocuments({ status: { $in: ["rejected", "Rejected"] } }),
    ]);

    // Summarize by category
    const eventStats = {
      total: totalEvents,
      pending: pendingEvents,
      approved: approvedEvents,
      rejected: rejectedEvents,
    };

    const trainingStats = {
      total: totalTrainings,
      pending: pendingTrainings,
      approved: approvedTrainings,
      rejected: rejectedTrainings,
    };

    const awardStats = {
      total: totalAwards,
      pending: pendingAwards,
      approved: approvedAwards,
      rejected: rejectedAwards,
    };

    // Combined total
    const combined = {
      total: totalEvents + totalTrainings + totalAwards,
      pending: pendingEvents + pendingTrainings + pendingAwards,
      approved: approvedEvents + approvedTrainings + approvedAwards,
      rejected: rejectedEvents + rejectedTrainings + rejectedAwards,
    };

    res.status(200).json({
      status: true,
      message: "Record statistics fetched successfully",
      data: {
        events: eventStats,
        trainings: trainingStats,
        awards: awardStats,
        combined,
      },
    });
  } catch (error) {
    console.error("Error fetching record stats:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};
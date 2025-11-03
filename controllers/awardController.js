const awardProgressModel = require("../models/awardProgressModel");
const trainingModel = require("../models/trainingModel");
const { userModel } = require("../models/userModel");
const cloudinary = require('../config/cloudinary');
const fs = require("fs");
const { auditTrailModel } = require("../models/auditTrailModel");

exports.createAwardProgress = async (req, res) => {
try {
    const { awardName, awardLocation } = req.body;

    
    let scoutId = req.user._id;
    if (req.user.role === "admin" || req.user.role === "superAdmin") {
      scoutId = req.body.scoutId || scoutId; 
    }

    if (!scoutId || !awardName) {
      return res
        .status(400)
        .json({ status: false, message: "scoutId and awardName are required" });
    }
    let awardUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "awards",
      });
      awardUrl = result.secure_url;
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error removing file", err);
      });
    }

    const award = await awardProgressModel.create({
      scout: scoutId,
      awardName,
      awardLocation,
      awardUrl,
    });

    return res
      .status(201)
      .json({ 
        status: true, 
        message: "Award progress created", 
        data: award });
  } catch (err) {
    return res
      .status(500)
      .json({ status: false, message: err.message });
  }
};


exports.getAwardProgress = async (req, res) => {
  try {
    const { scoutId } = req.params;

    if (req.user.role === "member" && req.user._id.toString() !== scoutId) {
      return res.status(403).json({ status: false, message: "Unauthorized to view this user's awards" });
    }

    const awards = await awardProgressModel.find({ scout: scoutId }).populate("scout", "fullName email scoutingRole");
    return res.status(200).json({ status: true, data: awards });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateAwardProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { awardName, awardLocation, status } = req.body;

    const award = await awardProgressModel.findById(id);
    if (!award) {
      return res.status(404).json({ status: false, message: "Award not found" });
    }

    if (req.user.role === "member" && req.user._id.toString() !== award.scout.toString()) {
      return res.status(403).json({ status: false, message: "Unauthorized" });
    }
    
    const oldData = {
      awardName: award.awardName,
      awardLocation: award.awardLocation,
      status: award.status,
      awardUrl: award.awardUrl,
    };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "awards",
      });
      award.awardUrl = result.secure_url;
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error removing file", err);
      });
    }

    if (awardName) award.awardName = awardName;
    if (awardLocation) award.awardLocation = awardLocation;

    if (status) {
      award.status = status;
      if (status === "approved") {
        award.completedAt = new Date();
      }
    }

    await award.save();
    
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Award Progress Update",
      oldValue: JSON.stringify(oldData),
      newValue: JSON.stringify({
        awardName: award.awardName,
        awardLocation: award.awardLocation,
        status: award.status,
        awardUrl: award.awardUrl,
      }),
      changedBy: req.user.fullName,
    });

    return res.status(200).json({
      status: true,
      message: "Award progress updated",
      data: award,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getAllAwards = async (req, res) => {
  try {
    if (!["superAdmin", "nsAdmin", "ssAdmin", "leader"].includes(req.user.role)) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};
    if (req.user.role === "superAdmin") {
      const leader = await userModel.findById(req.user._id);
      filter = {
        $or: [
          { stateScoutCouncil: leader.stateScoutCouncil },
          { scoutDivision: leader.scoutDivision },
          { scoutDistrict: leader.scoutDistrict },
          { troop: leader.troop },
        ],
      };
    }

    const [awards, totalAwards] = await Promise.all([
      awardProgressModel
        .find()
        .populate("scout", "fullName email scoutingRole stateScoutCouncil scoutDivision scoutDistrict troop"),
      awardProgressModel.countDocuments(),
    ]);

  
    const filteredAwards =
      req.user.role === "superAdmin"
        ? awards.filter(
            (a) =>
              a.scout.stateScoutCouncil === req.user.stateScoutCouncil ||
              a.scout.scoutDivision === req.user.scoutDivision ||
              a.scout.scoutDistrict === req.user.scoutDistrict ||
              a.scout.troop === req.user.troop
          )
        : awards;
    const paginatedAwards = filteredAwards.slice(skip, skip + limit);

    return res.status(200).json({
      status: true,
      totalAwards: filteredAwards.length,
      currentPage: page,
      totalPages: Math.ceil(filteredAwards.length / limit),
      pageSize: limit,
      data: paginatedAwards,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};


exports.getAwardById = async (req, res) => {
  try {
    const { id } = req.params;
    const award = await awardProgressModel.findById(id).populate("scout", "fullName email scoutingRole");
    if (!award) {
      return res.status(404).json({ status: false, message: "Award not found" });
    }

    // Only owner or admins/leaders can view
    if (req.user.role === "member" && req.user._id.toString() !== award.scout._id.toString()) {
      return res.status(403).json({ status: false, message: "Unauthorized" });
    }

    return res.status(200).json({ status: true, data: award });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getUserAwards = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role === "member" && req.user._id.toString() !== userId) {
      return res.status(403).json({ status: false, message: "Unauthorized" });
    }

    // Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // default 10 per page
    const skip = (page - 1) * limit;

    // Count total
    const totalAwards = await awardProgressModel.countDocuments({ scout: userId });

    // Fetch paginated results
    const awards = await awardProgressModel.find({ scout: userId })
      .populate("scout", "fullName email scoutingRole")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      status: true,
      message: "Awards fetched successfully",
      data: awards,
      totalAwards,
      currentPage: page,
      totalPages: Math.ceil(totalAwards / limit),
      pageSize: awards.length,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getMembersProgress = async (req, res) => {
  try {
    const { role, stateScoutCouncil, scoutDivision, scoutDistrict, troop } = req.user;

    let filter = {};

    // Leaders: filter members by their troop/unit
    if (role === "leader") {
      filter = {
        stateScoutCouncil,
        scoutDivision,
        scoutDistrict,
        troop,
        role: "member"
      };
    }

    // Admins: can see all members
    if (["superAdmin", "nsAdmin", "ssAdmin"].includes(role)) {
      filter = { role: "member" };
    }

    // Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Count total members
    const totalMembers = await userModel.countDocuments(filter);

    // Fetch paginated members
    const members = await userModel.find(filter)
      .select("_id fullName email section profilePic")
      .skip(skip)
      .limit(limit);

    // Collect progress for each member
    const result = await Promise.all(
      members.map(async (member) => {
        const trainings = await trainingModel.find({ scout: member._id })
          .select("trainingType certificateUrl status createdAt")
          .sort({ createdAt: 1 });

        const awards = await awardProgressModel.find({ scout: member._id })
          .select("awardName progress status milestones completedAt")
          .sort({ createdAt: 1 });

        return { member, trainings, awards };
      })
    );

    return res.status(200).json({
      status: true,
      message: "Member training and award progress retrieved successfully",
      data: result,
      totalMembers,
      currentPage: page,
      totalPages: Math.ceil(totalMembers / limit),
      pageSize: members.length,
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


exports.deleteAwardProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const award = await awardProgressModel.findById(id).populate("scout", "fullName email stateScoutCouncil");
    if (!award) {
      return res.status(404).json({ status: false, message: "Award not found" });
    }

    const user = req.user;
    const isMember = user.role === "member";
    const isSsAdmin = user.role === "ssAdmin";
    const isNsAdmin = user.role === "nsAdmin";
    const isSuperAdmin = user.role === "superAdmin";

    // 🧠 Authorization Logic
    if (isMember && award.scout._id.toString() !== user._id.toString()) {
      return res.status(403).json({ status: false, message: "You can only delete your own awards." });
    }

    if (isSsAdmin && award.scout.stateScoutCouncil !== user.stateScoutCouncil) {
      return res.status(403).json({ status: false, message: "You can only delete awards within your state scout council." });
    }

    if (!(isMember || isSsAdmin || isNsAdmin || isSuperAdmin)) {
      return res.status(403).json({ status: false, message: "Unauthorized to delete award" });
    }

    // 🧾 Delete file from Cloudinary if exists
    if (award.awardUrl) {
      try {
        const publicId = award.awardUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`awards/${publicId}`);
      } catch (err) {
        console.error("Cloudinary deletion failed:", err.message);
      }
    }

    // 🗑️ Delete award record
    await award.deleteOne();

    // 🧾 Audit Trail
    await auditTrailModel.create({
      userId: user._id,
      field: "Award Progress",
      oldValue: JSON.stringify({
        awardName: award.awardName,
        awardLocation: award.awardLocation,
        status: award.status,
      }),
      newValue: "Deleted",
      changedBy: user.fullName,
      remarks: `${user.role} deleted award "${award.awardName}" for ${award.scout.fullName}`,
    });

    return res.status(200).json({
      status: true,
      message: `Award "${award.awardName}" deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete Award Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    
    
    });
  }
};

// ✅ Fetch all in-progress awards (Pending)
exports.getPendingAwards = async (req, res) => {
  try {
    if (!["superAdmin", "nsAdmin", "ssAdmin"].includes(req.user.role)) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ssAdmin only sees awards in their state
    const filter =
      req.user.role === "ssAdmin"
        ? { status: "in-progress", "scout.stateScoutCouncil": req.user.stateScoutCouncil }
        : { status: "in-progress" };

    const awards = await awardProgressModel
      .find(filter)
      .populate("scout", "fullName email stateScoutCouncil")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await awardProgressModel.countDocuments(filter);

    return res.status(200).json({
      status: true,
      totalPending: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: awards,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ✅ Update in-progress award (Approve/Reject)
exports.updatePendingAward = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const award = await awardProgressModel.findById(id).populate("scout", "fullName stateScoutCouncil");
    if (!award) return res.status(404).json({ status: false, message: "Award not found" });

    if (award.status !== "in-progress")
      return res.status(400).json({ status: false, message: "Only in-progress awards can be updated" });

    // ssAdmin restriction
    if (req.user.role === "ssAdmin" && award.scout.stateScoutCouncil !== req.user.stateScoutCouncil) {
      return res.status(403).json({ status: false, message: "Unauthorized for this state" });
    }

    award.status = status;
    if (status === "approved") award.completedAt = new Date();
    await award.save();

    // Log update
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Award Status Update",
      oldValue: "in-progress",
      newValue: status,
      changedBy: req.user.fullName,
      remarks: `${req.user.role} updated award "${award.awardName}" to ${status}`,
    });

    return res.status(200).json({ status: true, message: `Award ${status}`, data: award });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

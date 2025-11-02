const Training = require("../models/trainingModel");
const fs = require("fs");
const cloudinary = require('../config/cloudinary');
const { auditTrailModel } = require("../models/auditTrailModel");


exports.uploadTraining = async (req, res) => {
  try {
    const scoutId = req.user._id; 
    let {trainingType, customTrainingName } = req.body;
    if (Array.isArray(trainingType)) {
     trainingType = trainingType[0];
    }

      if (!trainingType) {
      return res.status(400).json({
        status: false,
        message: "Training type is required",
      });
    }    
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Certificate file is required",
      });
    }
    const duplicate = await Training.findOne({
      scout: scoutId,
      trainingType,
      customTrainingName,
    });
    if (duplicate) {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        status: false,
        message: "You have already uploaded this training record.",
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "scout_certificates",
    });

    fs.unlink(req.file.path, (err) => {
      if (err) console.error("File cleanup error:", err);
    });

    const training = new Training({
      scout: scoutId,
      trainingType,
      customTrainingName,      
      certificateUrl: result.secure_url
    });

    await training.save();
    res.status(201).json({
      status: true, 
      message: "Training uploaded successfully",
      data: {
        id: training._id,
        trainingType: training.trainingType,
        customTrainingName: training.customTrainingName,
        certificateUrl: training.certificateUrl,
        status: training.status,
        createdAt: training.createdAt,
      },
     });
  } catch (error) {
    console.error("UPLOAD TRAINING ERROR:", error);
  res.status(500).json({
    status: false,
    message: "Server error",
    error: error.message
  });
  }
};


exports.getMyTrainings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 10; 
    const skip = (page - 1) * limit;

   
    const totalTrainings = await Training.countDocuments({ scout: req.user._id });

    const trainings = await Training.find({ scout: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    if(!trainings){
      return res.status(404).json({ status: false, message: "Training not found" });
    }

    res.json({
      status: true,
      message: "My trainings fetched successfully",
      totalTrainings,
      currentPage: page,
      totalPages: Math.ceil(totalTrainings / limit),
      pageSize: trainings.length,
      trainings,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getAllTrainings = async (req, res) => {
  try {
    
    const page = parseInt(req.query.page) || 1; // default page = 1
    const limit = parseInt(req.query.limit) || 10; // default 10 per page
    const skip = (page - 1) * limit;

    const totalTrainings = await Training.countDocuments();

    // Fetch paginated trainings
    const trainings = await Training.find()
      .populate("scout", "fullName email membershipId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
      if(!trainings){
      return res.status(404).json({ status: false, message: "Training not found" });
    }

    res.json({
      status: true,
      message: "Trainings fetched successfully",
      totalTrainings,
      currentPage: page,
      totalPages: Math.ceil(totalTrainings / limit),
      pageSize: trainings.length,
      trainings,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getTrainingById = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id)
      .populate("scout", "fullName email membershipId");
    if (!training) {
      return res.status(404).json({ status: false, message: "Training not found" });
    }
    res.json({status: true, training });
  } catch (error) {
    res.status(500).json({status: false, message: "Server error", error: error.message });
  }
};


exports.updateTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({status:false, message: "Training not found" });
    }
    if (training.scout.toString() !== req.user._id.toString()) {
      return res.status(403).json({status:false, message: "Not authorized to update this training" });
    }

    Object.assign(training, req.body);
    await training.save();

    res.json({status: true, message: "Training updated successfully", training });
  } catch (error) {
    res.status(500).json({status: false, message: "Server error", error: error.message });
  }
};


exports.deleteTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({status: false, message: "Training not found" });
    }

    if (
      training.scout.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "superAdmin"
    ) {
      return res.status(403).json({ status: false, message: "Not authorized to delete this training" });
    }

    await training.deleteOne();
    
    await auditTrailModel.create({
      userId: req.user._id,
      field: "Training Deletion",
      oldValue: training.trainingType || "N/A",
      newValue: "Deleted",
      changedBy: req.user.fullName,
    });
    res.json({status: true, message: "Training deleted successfully" });
  } catch (error) {
    res.status(500).json({status: false, message: "Server error", error: error.message });
  }
};


exports.verifyTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({status: false, message: "Training not found" });
    }

    const { status, rejectionReason } = req.body;

    if (!["Verified", "Rejected"].includes(status)) {
      return res.status(400).json({status: false, message: "Status must be Verified or Rejected" });
    }

    const oldStatus = training.status;

    training.status = status;
    training.verifiedBy = req.user._id;
    training.verificationLevel = req.user.role;
    training.verifiedAt = new Date();

    if (status === "Rejected") {
      training.rejectionReason = rejectionReason || "No reason provided";
    }

    await training.save();

    await auditTrailModel.create({
      userId: req.user._id,
      field: "Training Verification",
      oldValue: oldStatus,
      newValue: status,
      changedBy: req.user.fullName,
    });

    res.json({status: true, message: `Training ${status}`, training });
  } catch (error) {
    res.status(500).json({status: false, message: "Server error", error: error.message });
  }
};

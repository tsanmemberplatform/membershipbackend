const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema({
  scout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  trainingType: {
    type: String,
    enum: [
      "Tenderfoot",
      "Second Class",
      "First Class",
      "Basic Training Course",
      "Woodbadge",
      "Assistant Leader Trainer",
      "Leader Trainer",
      "Other",
    ],
    required: true,
  },
  customTrainingName: {
    type: String, 
    
  },
  customTrainingDate: {
    type: String, 
    
  },
  customTrainingLocation: {
    type: String, 
    
  },
  certificateUrl: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["Pending", "Verified", "Rejected"],
    default: "Pending",
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
  },
    verificationLevel: {
    type: String,
    enum: ["nsAdmin", "superAdmin"],
  },
  verifiedAt: {
    type: Date,
  },
   rejectionReason: {
    type: String,
    trim: true,
  },
}, { timestamps: true });


trainingSchema.path("customTrainingName").validate(function (value) {
  if (this.trainingType === "Other" && !value) {
    return false;
  }
  return true;
}, "customTrainingName is required when trainingType is 'Other'");


module.exports = mongoose.model("Training", trainingSchema);
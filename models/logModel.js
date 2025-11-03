const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  scout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  fileUrl: { type: String }, 
}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
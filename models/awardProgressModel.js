const mongoose = require("mongoose");

const awardProgressSchema = new mongoose.Schema({
  scout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  awardName: {
    type: String,
    
  },
  awardLocation: {
    type: String,

  },
  awardUrl: {
    type: String,
    
  },
  progress: {
    type: Number, 
    min: 0,
    max: 1000,
    default: 0,
  },
  milestones: [
    {
      title: String,
      achievedAt: Date,
      completed: { type: Boolean, default: false },
      dateCompleted: Date,
    },
  ],
  status: {
    type: String,
    enum: ["in-progress", "approved","rejected" ],
    default: "in-progress",
  },
  completedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("AwardProgress", awardProgressSchema);

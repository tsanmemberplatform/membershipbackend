const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  time: { type: String },
  location: { type: String, required: true },
  photoUrl: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approved: {
    type: Boolean,
    default: false,
  },
  attendees: [
    {
      scout: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: String, enum: ["Going", "Not Going", "Maybe"], default: "Going" },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);
    
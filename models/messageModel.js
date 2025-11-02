const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  message: { type: String, required: true },
  sentBy: { type: String, required: true },
  sentById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sentTo: { type: String, required: true }, 
  attachmentUrl: { type: String },
  dateSent: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
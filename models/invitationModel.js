const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 3 },
  council: { type: String, default: "FCT"},
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  role: { type: String, enum: ["ssAdmin", "nsAdmin", "superAdmin"], required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String },
  status: { type: String, enum: ["pending", "accepted", "expired", "resent"], default: "pending" },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } 
}, { timestamps: true });

module.exports = mongoose.model("Invitation", invitationSchema);

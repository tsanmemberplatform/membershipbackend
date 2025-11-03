const mongoose = require('mongoose')
const auditTrailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  field: { type: String, required: true },          
  oldValue: { type: String },
  newValue: { type: String },
  changedBy: { type: String, required: true },      
  timestamp: { type: Date, default: Date.now }
});

exports.auditTrailModel = mongoose.model("AuditTrail", auditTrailSchema);

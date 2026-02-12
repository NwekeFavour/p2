const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin", // Or "User", depending on your model name
    required: true,
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
  },
  action: {
    type: String,
    enum: ["Status Update", "Feedback Edit"],
    required: true,
  },
  details: {
    oldStatus: String,
    newStatus: String,
    feedbackProvided: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);

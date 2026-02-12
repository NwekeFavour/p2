const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicationForm",
      required: true,
    },
    certificateId: {
      type: String,
      unique: true,
      required: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
    },
    track: String,
    level: String,
    verificationHash: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);

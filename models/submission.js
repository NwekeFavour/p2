const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema(
  {
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      required: [true, "Submission must be linked to a cohort"],
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicationForm",
      required: [true, "Submission must be linked to an application"],
    },
    slackUserId: {
      type: String,
      required: true,
    },
    slackUserName: {
      type: String,
    },
    projectLink: {
      type: String,
      required: [true, "Project link is required"],
      trim: true,
      match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/, "Please provide a valid URL"],
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Accepted", "Needs Revision"],
      default: "Pending",
    },
    feedback: {
      type: String,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const Submission = mongoose.model("Submission", SubmissionSchema);
module.exports = Submission;
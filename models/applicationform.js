const mongoose = require("mongoose");

const ApplicationFormSchema = new mongoose.Schema(
  {
    fname: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lname: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    level: {
      type: String,
      required: true,
    },
    track: {
      type: String,
      enum: ["Frontend Development", "Backend Development", "UI/UX Design", "Data Analysis", "Project Management"],
      required: true,
    },
    social: {
      type: String,
      enum: ["Social Media", "Friend or Colleague", "Online Search", "Other"],
      required: true,
    },
    university: {
      type: String,
      required: false,
    },
    package: {
      type: String,
      default: false,
    },
    paymentReference: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

const ApplicationForm = mongoose.model("ApplicationForm", ApplicationFormSchema);
module.exports = ApplicationForm;
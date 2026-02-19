const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto")
// ==================== USER/ADMIN MODEL ====================
const UserSchema = new mongoose.Schema(
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
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email"
      ]
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password in queries by default
    },
    slackUserId: {
      type: String,
      default: null,
      unique: true, // Prevents one Slack account from linking to multiple emails
      sparse: true, // Allows multiple 'null' values for users not on Slack yet
    },
    assignedCohorts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort", // This must match the string in mongoose.model("Cohort", ...)
    }],
    role: {
      type: String,
      enum: ["super-admin", "admin"],
      default: "admin",
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    // Mentor-specific fields
    expertise: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Password reset
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpire: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
UserSchema.virtual("fullName").get(function () {
  return `${this.fname} ${this.lname}`;
});


UserSchema.virtual('myCreatedCohorts', {
  ref: 'Cohort',
  localField: '_id',
  foreignField: 'createdBy'
});

// Set this to ensure virtuals show up in JSON responses
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

UserSchema.methods.getResetPasswordToken = function () {
  // Create token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to DB
  this.resetPasswordToken = crypto.createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire time (1 hour)
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

  return resetToken;
};
// ==================== PERMISSIONS SCHEMA ====================
const PermissionSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["super-admin", "admin"],
    required: true,
    unique: true,
  },
  permissions: {
    // Cohort permissions
    cohorts: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    // Application permissions
    applications: {
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      reject: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    // User management permissions
    users: {
      create: { type: Boolean, default: true },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      assignRoles: { type: Boolean, default: false },
    },
    // Mentor assignment
    mentorship: {
      assignInterns: { type: Boolean, default: false },
      viewAssignedInterns: { type: Boolean, default: false },
      updateInternProgress: { type: Boolean, default: false },
    },
    // Analytics
    analytics: {
      viewAll: { type: Boolean, default: false },
      viewOwn: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
    },
  },
});

// ==================== COHORT SCHEMA (Updated) ====================
const CohortSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Cohort name is required"],
      unique: true,
      trim: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    applicationDeadline: {
      type: Date,
      required: [true, "Application deadline is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    availableTracks: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Auto-disable cohort if past application deadline
CohortSchema.pre("save", function (next) {
  if (this.applicationDeadline && this.applicationDeadline < new Date()) {
    this.isActive = false;
  }
  next();
});

// Method to check if cohort can accept applications
CohortSchema.methods.canAcceptApplications = function () {
  const now = new Date();
  return this.isActive && now <= this.applicationDeadline;
};


// ==================== APPLICATION FORM SCHEMA (Updated) ====================
const ApplicationFormSchema = new mongoose.Schema(
  {
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      required: [true, "Cohort is required"],
      index: true,
    },
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
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    slackUserId: {
      type: String,
      default: null,
      index: true // Makes searching faster
    },
    currentStage: {
      type: Number,
      default: 1,
      min: 1,
      max: 8
    },
    level: {
      type: String,
      required: true,
    },
    track: {
      type: String,
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
      enum: ["Free", "Premium", "Pro"],
      default: "Free",
    },
    paymentReference: {
      type: String,
      default: null,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    sendAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      maxlength: 1000,
    },
    // Progress tracking (for mentors)
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    completed: { type: Boolean, default: false },
    completedTasks: {
      type: Number,
      default: 0,
    },
    totalTasks: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index for unique email per cohort
ApplicationFormSchema.index({ email: 1, cohort: 1 }, { unique: true });

// Virtual for full name
ApplicationFormSchema.virtual("fullName").get(function () {
  return `${this.fname} ${this.lname}`;
});

// ==================== DEFAULT PERMISSIONS ====================
const defaultPermissions = [
  {
    role: "super-admin",
    permissions: {
      cohorts: { create: true, read: true, update: true, delete: true },
      applications: { read: true, update: true, approve: true, reject: true, delete: true },
      users: { create: true, read: true, update: true, delete: true, assignRoles: true },
      mentorship: { assignInterns: true, viewAssignedInterns: true, updateInternProgress: true },
      analytics: { viewAll: true, viewOwn: true, export: true },
    },
  },
  {
    role: "admin",
    permissions: {
      cohorts: { create: false, read: true, update: false, delete: false },
      applications: { read: true, update: true, approve: true, reject: true, delete: true },
      users: { create: true, read: true, update: false, delete: false, assignRoles: false },
      mentorship: { assignInterns: true, viewAssignedInterns: true, updateInternProgress: false },
      analytics: { viewAll: true, viewOwn: true, export: true },
    },
  },
];

// Export models
const User = mongoose.model("User", UserSchema);
const Permission = mongoose.model("Permission", PermissionSchema);
const Cohort = mongoose.model("Cohort", CohortSchema);
const ApplicationForm = mongoose.model("ApplicationForm", ApplicationFormSchema);

module.exports = {
  User,
  Permission,
  Cohort,
  ApplicationForm,
  defaultPermissions,
};
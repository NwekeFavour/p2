const mongoose = require("mongoose");

// More permissive URL validation that accepts:
// - Standard URLs (http/https)
// - Google Drive/Docs/Slides/Sheets
// - Figma links
// - GitHub links
// - Deployed app URLs (Vercel, Netlify, etc.)
const urlValidator = {
  validator: function(v) {
    if (!v || typeof v !== 'string') return false;
    
    const trimmed = v.trim();
    
    // Must start with http:// or https://
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    
    // Basic URL structure check
    try {
      const url = new URL(trimmed);
      
      // Must have a valid hostname
      if (!url.hostname || url.hostname.length < 3) {
        return false;
      }
      
      // Block localhost and private IPs for non-testing environments
      if (process.env.NODE_ENV === 'production') {
        if (url.hostname === 'localhost' || 
            url.hostname === '127.0.0.1' ||
            url.hostname.startsWith('192.168.') ||
            url.hostname.startsWith('10.')) {
          return false;
        }
      }
      
      return true;
    } catch (e) {
      return false;
    }
  },
  message: 'Please provide a valid URL starting with http:// or https://'
};

const submissionSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicationForm",
      required: [true, "Application reference is required"],
      index: true,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      required: [true, "Cohort reference is required"],
      index: true,
    },
    slackUserId: {
      type: String,
      required: [true, "Slack user ID is required"],
      index: true,
    },
    slackUserName: {
      type: String,
      required: [true, "Slack username is required"],
    },
    projectLink: {
      type: String,
      required: [true, "Project link is required"],
      trim: true,
      validate: urlValidator,
    },
    status: {
      type: String,
      enum: {
        values: ["Pending", "Accepted", "Needs Revision", "Rejected"],
        message: "Status must be Pending, Accepted, Needs Revision, or Rejected",
      },
      default: "Pending",
      index: true,
    },
    feedback: {
      type: String,
      default: "",
    },
    score: {
      type: Number,
      min: [0, "Score cannot be negative"],
      max: [100, "Score cannot exceed 100"],
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes for common queries
submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ application: 1, createdAt: -1 });
submissionSchema.index({ cohort: 1, status: 1 });

// Virtual for submission age
submissionSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Pre-save hook to trim and validate URL
submissionSchema.pre('save', function(next) {
  if (this.projectLink) {
    this.projectLink = this.projectLink.trim();
  }
  next();
});

// Static method to find submissions by user
submissionSchema.statics.findBySlackUser = function(slackUserId) {
  return this.find({ slackUserId })
    .populate('application', 'fname lname track package')
    .sort({ createdAt: -1 });
};

// Static method to find pending submissions
submissionSchema.statics.findPending = function(cohortId = null) {
  const query = { status: 'Pending' };
  if (cohortId) {
    query.cohort = cohortId;
  }
  return this.find(query)
    .populate('application', 'fname lname track package email')
    .populate('cohort', 'name')
    .sort({ createdAt: 1 }); // Oldest first
};

// Instance method to mark as reviewed
submissionSchema.methods.markAsReviewed = function(reviewerId, status, feedback, score = null) {
  this.status = status;
  this.feedback = feedback;
  this.score = score;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Submission", submissionSchema);
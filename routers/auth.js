require("dotenv").config();
const crypto = require("crypto")
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const {
  User,
  Permission,
  ApplicationForm,
} = require("../models/applicationform");
const { Resend } = require("resend");
// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);
// ==================== MIDDLEWARE ====================

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or inactive user.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Authorization middleware
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found. Unauthorized.",
        });
      }

      next();
    } catch (error) {
      console.error("JWT verification error:", error);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Authorization denied.",
    });
  }
};

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
};

// Permission checker middleware
const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const permission = await Permission.findOne({ role: req.user.role });

      if (!permission || !permission.permissions[resource]?.[action]) {
        return res.status(403).json({
          success: false,
          message: `You do not have permission to ${action} ${resource}.`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error checking permissions.",
      });
    }
  };
};

// ==================== AUTH ROUTES ====================

// Register (Super Admin only - for creating other admins/mentors)
router.post("/auth/register", async (req, res) => {
  try {
    const {
      fname,
      lname,
      email,
      password,
      role,
      phone,
      expertise,
      maxInterns,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    // Validate role
    if (!["super-admin", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified.",
      });
    }

    // Create user
    const newUser = await User.create({
      fname,
      lname,
      email,
      password,
      role,
      phone,
      expertise: role === "admin" ? expertise : [],
      maxInterns: role === "admin" ? maxInterns : undefined,
    });

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(400).json({
      success: false,
      message: "Error creating user.",
      error: error.message,
    });
  }
});

// Login
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login.",
    });
  }
});

// Get current user
router.get("/auth/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
  }
});

// Change password
router.patch("/auth/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password.",
    });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Frontend reset link
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: "Knownly Internship <support@knownly.tech>",
      to: [user.email],
      subject: "🔑 Reset Your Knownly Password",
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; padding: 40px; background:#f4f7fa;">
          <div style="max-width: 550px; margin:auto; background:white; border-radius:10px; padding:30px;">
            <h2 style="text-align:center; color:#111827;">Reset Your Password</h2>
            <p>Hi <strong>${user.fname} ${user.lname}</strong>,</p>
            <p>You requested to reset your Knownly account password. Click the button below to set a new password. This link expires in 1 hour.</p>
            <div style="text-align:center; margin: 30px 0;">
              <a href="${resetUrl}" style="
                background:#4f39f6;
                color:white;
                text-decoration:none;
                padding:12px 22px;
                border-radius:6px;
                font-weight:600;
              ">Reset Password</a>
            </div>
            <p>If you did not request this, please ignore this email.</p>
            <p style="font-size:12px; color:#9ca3af;">This is an automated message. Do not reply.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ success: false, message: "Email could not be sent." });
    }

    res.status(200).json({
      success: true,
      message: `Password reset link sent to ${user.email}`,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, message: "Error generating password reset link." });
  }
});


router.post("/auth/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success:false, message:"Password must be at least 8 characters." });
  }

  // Hash the token to compare with DB
  const resetPasswordToken = crypto.createHash("sha256")
    .update(token)
    .digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:"Error resetting password." });
  }
});


// ==================== USER MANAGEMENT ROUTES ====================

// Get all users (Super Admin & Admin)
router.get(
  "/users",
  authenticate,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const { role, isActive } = req.query;

      let query = {};
      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive === "true";

      const users = await User.find(query)
        .select("-password")
        .populate("assignedCohorts", "name startDate isActive")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching users.",
      });
    }
  },
);

// Get single user
router.get(
  "/users/:userId",
  authenticate,
  authorize("super-admin", "admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId)
        .select("-password")
        .populate("assignedCohorts", "name")
        .populate("assignedInterns", "fname lname email track status");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching user.",
      });
    }
  },
);

// Update user (Super Admin only)
router.patch(
  "/users/:userId",
  authenticate,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Don't allow password updates through this route
      delete updates.password;

      const user = await User.findByIdAndUpdate(userId, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      res.status(200).json({
        success: true,
        message: "User updated successfully.",
        data: user,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({
        success: false,
        message: "Error updating user.",
        error: error.message,
      });
    }
  },
);

// Deactivate/Activate user (Super Admin only)
router.patch(
  "/users/:userId/toggle-active",
  authenticate,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      user.isActive = !user.isActive;
      await user.save();

      res.status(200).json({
        success: true,
        message: `User ${user.isActive ? "activated" : "deactivated"} successfully.`,
        data: { isActive: user.isActive },
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json({
        success: false,
        message: "Error updating user status.",
      });
    }
  },
);

// Delete user (Super Admin only)
router.delete(
  "/users/:userId",
  authenticate,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Don't allow super-admin to delete themselves
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "You cannot delete your own account.",
        });
      }

      await user.deleteOne();

      res.status(200).json({
        success: true,
        message: "User deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting user.",
      });
    }
  },
);

// ==================== MENTOR MANAGEMENT ====================

// Get all mentors
router.get("/admin", authenticate, async (req, res) => {
  try {
    const { expertise, cohort } = req.query;

    let query = { role: "admin", isActive: true };
    if (expertise) query.expertise = expertise;
    if (cohort) query.assignedCohorts = cohort;

    const mentors = await User.find(query)
      .select("-password")
      .populate("assignedCohorts", "name")
      .populate("assignedInterns", "fname lname track");

    res.status(200).json({
      success: true,
      count: mentors.length,
      data: mentors,
    });
  } catch (error) {
    console.error("Error fetching mentors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching mentors.",
    });
  }
});

// Update intern progress (Mentor only)
router.patch(
  "/interns/:internId/progress",
  authenticate,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { internId } = req.params;
      const { progress, completedTasks, totalTasks, reviewNotes } = req.body;

      const intern = await ApplicationForm.findById(internId);

      if (!intern) {
        return res.status(404).json({
          success: false,
          message: "Intern not found.",
        });
      }

      // Update progress
      if (progress !== undefined) intern.progress = progress;
      if (completedTasks !== undefined) intern.completedTasks = completedTasks;
      if (totalTasks !== undefined) intern.totalTasks = totalTasks;
      if (reviewNotes !== undefined) intern.reviewNotes = reviewNotes;

      await intern.save();

      res.status(200).json({
        success: true,
        message: "Intern progress updated successfully.",
        data: intern,
      });
    } catch (error) {
      console.error("Error updating intern progress:", error);
      res.status(500).json({
        success: false,
        message: "Error updating progress.",
      });
    }
  },
);


module.exports = router;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
module.exports.checkPermission = checkPermission;
module.exports.protect = protect;

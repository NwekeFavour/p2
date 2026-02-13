const express = require("express");
const { ApplicationForm, Cohort, User } = require("../models/applicationform");
const transporter = require("../config/mailer");
const { authorize, protect } = require("./auth");
const { rejectedEmail, approvedEmail } = require("../config/updateemail");
const Submission = require("../models/submission");
const mongoose = require("mongoose");

const router = express.Router();

// Create new application methods
// ==================== COHORT ROUTES (ADMIN) ====================

// Get all cohorts
router.get("/cohorts", async (req, res) => {
  try {
    const cohorts = await Cohort.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: cohorts.length,
      data: cohorts,
    });
  } catch (error) {
    console.error("Error fetching cohorts:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get active cohort (accepting applications)
router.get("/cohorts/active", async (req, res) => {
  try {
    const now = new Date();
    const activeCohort = await Cohort.findOne({
      isActive: true,
      applicationDeadline: { $gte: now },
    }).sort({ applicationDeadline: 1 });

    if (!activeCohort) {
      return res.status(404).json({
        success: false,
        message: "No active cohort accepting applications at this time.",
      });
    }

    res.status(200).json({ success: true, data: activeCohort });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all active cohorts for Super Admin management
router.get("/cohorts/all-active", async (req, res) => {
  try {
    // Find all cohorts where isActive is true
    const activeCohorts = await Cohort.find({ isActive: true }).sort({
      startDate: -1,
    }); // Show newest first

    res.status(200).json({
      success: true,
      count: activeCohorts.length,
      data: activeCohorts,
    });
  } catch (error) {
    console.error("Error fetching active cohorts:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Create new cohort (SUPER ADMIN only - add auth middleware)
router.post("/cohorts", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { name, applicationDeadline, startDate, availableTracks } = req.body;

    if (!name || !applicationDeadline) {
      return res.status(400).json({
        success: false,
        message: "Name and application deadline are required",
      });
    }

    if (new Date(applicationDeadline) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Application deadline must be in the future",
      });
    }

    const cohort = await Cohort.create({
      name,
      applicationDeadline,
      startDate: startDate || null,
      availableTracks: availableTracks || [],
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Cohort created successfully",
      data: cohort,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Update cohort (ADMIN only)
router.patch(
  "/cohorts/:cohortId",
  protect,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const { cohortId } = req.params;
      const updates = req.body;

      // Ensure deadline is not in the past
      if (
        updates.applicationDeadline &&
        new Date(updates.applicationDeadline) <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Application deadline must be in the future",
        });
      }

      const updatedCohort = await Cohort.findByIdAndUpdate(cohortId, updates, {
        new: true,
        runValidators: true,
      });

      if (!updatedCohort) {
        return res
          .status(404)
          .json({ success: false, message: "Cohort not found" });
      }

      res
        .status(200)
        .json({
          success: true,
          message: "Cohort updated",
          data: updatedCohort,
        });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error",
          error: error.message,
        });
    }
  },
);

router.delete(
  "/cohorts/:cohortId",
  protect,
  authorize("super-admin"),
  async (req, res) => {
    try {
      const { cohortId } = req.params;
      const deleted = await Cohort.findByIdAndDelete(cohortId);

      if (!deleted)
        return res
          .status(404)
          .json({ success: false, message: "Cohort not found" });

      res
        .status(200)
        .json({
          success: true,
          message: "Cohort deleted successfully",
          data: deleted,
        });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error",
          error: error.message,
        });
    }
  },
);

// Get applications for specific cohort
router.get("/cohorts/:cohortId/applications", async (req, res) => {
  try {
    const { cohortId } = req.params;
    const { status, package: pkg } = req.query;

    let query = { cohort: cohortId };
    if (status) query.status = status;
    if (pkg) query.package = pkg.toLowerCase();

    const applications = await ApplicationForm.find(query).populate(
      "cohort",
      "name",
    );

    res.status(200).json({
      success: true,
      count: applications.length,
      cohortId,
      data: applications,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== APPLICATION ROUTES ====================

// Get applications (with optional filters)
router.get("/apply", async (req, res) => {
  try {
    const { package: pkg, cohort, status } = req.query;

    let query = {};
    if (pkg) query.package = pkg.toLowerCase();
    if (cohort) query.cohort = cohort;
    if (status) query.status = status;

    const applications = await ApplicationForm.find(query).populate(
      "cohort",
      "name",
    );

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc Delete applicant by ID
router.delete(
  "/:id",
  protect,
  authorize("super-admin", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const deletedApp = await ApplicationForm.findByIdAndDelete(id);

      if (!deletedApp) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Application deleted successfully",
        data: deletedApp,
      });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({
        success: false,
        message: "Server error while deleting application",
        error: error.message,
      });
    }
  },
);

// PUT /api/applications/:id/status
router.put(
  "/:id/status",
  protect,
  authorize("super-admin", "admin"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const validStatuses = ["Pending", "Approved", "Rejected"];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status value" });
      }

      const updatedApp = await ApplicationForm.findByIdAndUpdate(
        req.params.id,
        { status, reviewedAt: new Date() },
        { new: true },
      );

      if (!updatedApp) {
        return res
          .status(404)
          .json({ success: false, message: "Application not found" });
      }

      // Send email
      if (status === "Approved") {
        await transporter.sendMail({
          from: `"Knownly Internship" <support@knownly.tech>`,
          to: updatedApp.email,
          subject: "Congratulations! Your Application Has Been Approved",
          html: approvedEmail(updatedApp.fname),
        });
      } else if (status === "Rejected") {
        await transporter.sendMail({
          from: `"Knownly Internship" <support@knownly.tech>`,
          to: updatedApp.email,
          subject: "Application Update",
          html: rejectedEmail(updatedApp.fname),
        });
      }

      res.status(200).json({
        success: true,
        message: "Status updated successfully",
        data: updatedApp,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error while updating status",
          error: error.message,
        });
    }
  },
);

router.get("/stats/premium", async (req, res) => {
  try {
    const premiumApplications = await ApplicationForm.find({
      package: "premium",
    });

    const totalPremium = premiumApplications.length;
    const pendingPremium = await ApplicationForm.countDocuments({
      package: "premium",
      status: "Pending",
    });
    const approvedPremium = await ApplicationForm.countDocuments({
      package: "premium",
      status: "Approved",
    });
    const rejectedPremium = await ApplicationForm.countDocuments({
      package: "premium",
      status: "Rejected",
    });

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newPremium = await ApplicationForm.countDocuments({
      package: "premium",
      createdAt: { $gte: lastWeek },
    });

    res.status(200).json({
      success: true,
      stats: {
        totalPremium,
        pendingPremium,
        approvedPremium,
        rejectedPremium,
        newPremium,
        conversionRate:
          totalPremium > 0
            ? ((approvedPremium / totalPremium) * 100).toFixed(2) + "%"
            : "0%",
      },
    });
  } catch (error) {
    console.error("Error fetching premium stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Submit application
router.post("/apply", async (req, res) => {
  try {
    const {
      email,
      fname,
      lname,
      phone,
      social,
      university,
      track,
      level,
      package: pkg,
      cohortId,
    } = req.body;

    // 1. Initial Validations
    if (!cohortId) {
      return res
        .status(400)
        .json({ success: false, message: "Cohort ID is required." });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res
        .status(404)
        .json({ success: false, message: "Cohort not found." });
    }

    if (!cohort.canAcceptApplications()) {
      return res.status(400).json({
        success: false,
        message: `Applications for ${cohort.name} are closed.`,
      });
    }

    const existingApplication = await ApplicationForm.findOne({
      email,
      cohort: cohortId,
    });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this cohort.",
      });
    }

    // 2. Define a reusable email function
    // This allows us to trigger the email for both Free and Premium users
    const triggerWelcomeEmail = async (cohortName) => {
      try {
        await transporter.sendMail({
          from: `"Knownly Internship" <support@knownly.tech>`, // Verified domain
          to: email,
          subject: "🎉 Application Received - Welcome to Knownly Internship!",
          html: `

          <div style="

            font-family: 'Segoe UI', Roboto, Arial, sans-serif;

            background-color: #f4f7fa;

            padding: 40px 0;

            display: flex;

            justify-content: center;

            items-align: center;

          ">

            <div style="

              background: #ffffff;

              max-width: 550px;

              width: 100%;

              border-radius: 10px;

              box-shadow: 0 4px 10px rgba(0,0,0,0.05);

              padding: 30px 35px;

            ">

              <div style="text-align: center; margin-bottom: 20px;">

                <img src="https://knownly.tech/logo.png" alt="Knownly Logo" style="width: 80px; height: auto; margin-bottom: 10px;" />

                <h1 style="color: #4f39f6; font-size: 22px; margin: 0;">Knownly Internship</h1>

              </div>



              <p style="font-size: 16px; color: #111827;">Hi <strong>${fname} ${lname}</strong>,</p>



              <p style="font-size: 15px; color: #374151; line-height: 1.6;">

                🎉 <strong>Congratulations!</strong> Your application for the

                <strong>Knownly Internship Program (${newApplication.cohort.name})</strong> has been received successfully.

              </p>



              <p style="font-size: 15px; color: #374151; line-height: 1.6;">

                You're now one step closer to joining a dynamic community of tech innovators, learners, and creators.

                At <strong>Knownly</strong>, we're passionate about helping you <em>build real-world skills</em> and

                <em>launch a rewarding tech career</em>.

              </p>





              <div style="background: #f9fafb; padding: 15px 20px; border-radius: 8px; margin-top: 20px;">

                <p style="font-size: 14px; color: #0f172a; margin: 0;">

                  💎 <strong>Want to go further?</strong>

                  Our <span style="color: #4f39f6; font-weight: 600;">Premium Track</span> gives you access to:

                </p>

                <ul style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 10px; padding-left: 20px;">

                  <li>🌟 <strong>Exclusive 1-on-1 mentorship sessions</strong> with experienced industry professionals.</li>

                  <li>📚 <strong>Direct access to curated career resources</strong> and project-based learning materials.</li>

                  <li>🚀 <strong>Networking opportunities</strong> with top-performing interns and mentors.</li>

                </ul>

                <div style="text-align: center; margin-top: 20px;">

                  <a href="https://knownly.tech/premium" style="

                    background-color: #4f39f6;

                    color: #ffffff;

                    text-decoration: none;

                    padding: 12px 22px;

                    border-radius: 6px;

                    font-weight: 500;

                    display: inline-block;

                  ">Explore Premium Benefits</a>

                </div>

              </div>



              <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">

                Stay tuned — we'll reach out soon with the next steps and onboarding details.

                Keep an eye on your inbox for updates!

              </p>



              <p style="font-size: 15px; color: #111827; margin-top: 25px;">

                Best regards, <br/>

                <strong>The Knownly Team</strong>

              </p>



              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />



              <p style="font-size: 12px; color: #9ca3af; text-align: center;">

                This is an automated message. Please do not reply to this email.

              </p>

            </div>

          </div>

        `,
        });
        // console.log(`✅ Success: Email sent to ${email}`);
      } catch (mailErr) {
        console.error("❌ Background Mailer Error:", mailErr.message);
      }
    };

    // 3. Handle PREMIUM Track (Subaccount Logic)
    if (pkg === "Premium") {
      // Trigger email in background BEFORE returning
      triggerWelcomeEmail(cohort.name);

      return res.status(200).json({
        success: true,
        shouldPay: true,
        message: "Details validated. Proceeding to payment...",
      });
    }

    // 4. Handle FREE Track
    const sendAt = new Date(Date.now() + 5 * 60 * 1000);
    const newApplication = await ApplicationForm.create({
      cohort: cohortId,
      email,
      fname,
      lname,
      package: "Free",
      phone,
      level,
      track,
      social,
      university,
      sendAt,
    });

    // Populate cohort name for the email
    await newApplication.populate("cohort", "name");

    // Send JSON response first so user doesn't wait
    res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data: newApplication,
    });

    // Trigger email in background
    return triggerWelcomeEmail(newApplication.cohort.name);
  } catch (error) {
    console.error("❌ Critical Error:", error);
    if (!res.headersSent) {
      res.status(400).json({
        success: false,
        message: "Error submitting application",
        error: error.message,
      });
    }
  }
});

// ==================== STATS ROUTES ====================

// Overall stats
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await ApplicationForm.countDocuments();
    const premiumUsers = await ApplicationForm.countDocuments({
      package: "premium",
    });
    const freeUsers = await ApplicationForm.countDocuments({ package: "free" });
    const pendingApplications = await ApplicationForm.countDocuments({
      status: "Pending",
    }); // ✅ new

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newUsers = await ApplicationForm.countDocuments({
      createdAt: { $gte: lastWeek },
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers,
        newUsers,
        pendingApplications,
        conversionRate:
          totalUsers > 0
            ? ((premiumUsers / totalUsers) * 100).toFixed(2) + "%"
            : "0%",
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Stats for specific cohort
router.get("/cohorts/:cohortId/stats", async (req, res) => {
  try {
    const { cohortId } = req.params;

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res.status(404).json({
        success: false,
        message: "Cohort not found.",
      });
    }

    const totalApplications = await ApplicationForm.countDocuments({
      cohort: cohortId,
    });
    const premiumApplications = await ApplicationForm.countDocuments({
      cohort: cohortId,
      package: "premium",
    });
    const freeApplications = await ApplicationForm.countDocuments({
      cohort: cohortId,
      package: "free",
    });

    const pendingApplications = await ApplicationForm.countDocuments({
      cohort: cohortId,
      status: "Pending",
    });
    const approvedApplications = await ApplicationForm.countDocuments({
      cohort: cohortId,
      status: "Approved",
    });
    const rejectedApplications = await ApplicationForm.countDocuments({
      cohort: cohortId,
      status: "Rejected",
    });

    // Track breakdown
    const trackStats = await ApplicationForm.aggregate([
      { $match: { cohort: mongoose.Types.ObjectId(cohortId) } },
      { $group: { _id: "$track", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      cohort: {
        id: cohort._id,
        name: cohort.name,
        isActive: cohort.isActive,
      },
      stats: {
        totalApplications,
        premiumApplications,
        freeApplications,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        conversionRate:
          totalApplications > 0
            ? ((premiumApplications / totalApplications) * 100).toFixed(2) + "%"
            : "0%",
        trackBreakdown: trackStats,
      },
    });
  } catch (error) {
    console.error("Error fetching cohort stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/:cohortId/incubees", protect, async (req, res) => {
  try {
    const { cohortId } = req.params;

    // 1. Grab the first expertise from the array (e.g., "Frontend")
    const expertiseArray = req.user.expertise;
    // console.log(req.user)
    const adminTrack = Array.isArray(expertiseArray) ? expertiseArray[0] : null;

    let query = { cohort: cohortId };

    // 2. Apply "Starts With" logic using Regex
    if (adminTrack) {
      // ^ ensures it starts with the string
      // i makes it case-insensitive
      query.track = { $regex: `^${adminTrack}`, $options: "i" };
    }

    const students = await ApplicationForm.find(query);

    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET submissions for a specific cohort
router.get(
  "/cohorts/:cohortId/submissions",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { cohortId } = req.params;

      if (!cohortId || !mongoose.Types.ObjectId.isValid(cohortId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing cohortId",
        });
      }

      const adminExpertise = req.user.expertise; // e.g., ["Frontend"]

      // Convert ["Frontend", "UI"] into regex: /Frontend|UI/i
      const expertiseRegex = new RegExp(adminExpertise.join("|"), "i");

      const submissions = await Submission.find()
        .populate({
          path: "application",
          match: {
            cohort: cohortId,
            track: { $regex: expertiseRegex },
          },
          select: "fname lname email track package status",
        })
        .sort({ createdAt: -1 });

      const filteredSubmissions = submissions.filter(
        (sub) => sub.application !== null,
      );

      res.status(200).json({
        success: true,
        count: filteredSubmissions.length,
        data: filteredSubmissions,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

//submission

// DELETE a submission
router.delete(
  "/submissions/:id",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const submission = await Submission.findById(req.params.id);

      if (!submission) {
        return res
          .status(404)
          .json({ success: false, message: "Submission not found" });
      }

      // 1. Find the associated intern/application
      const application = await ApplicationForm.findById(
        submission.application,
      );

      if (application) {
        // 2. Decrement completed tasks (ensure it doesn't go below 0)
        application.completedTasks = Math.max(
          0,
          application.completedTasks - 1,
        );

        // 3. Recalculate progress
        const total = application.totalTasks || 10; // Defaulting to 10 if not set
        application.progress = Math.round(
          (application.completedTasks / total) * 100,
        );

        await application.save();
      }

      // 4. Delete the actual submission record
      await submission.deleteOne();

      res.status(200).json({
        success: true,
        message: "Submission removed and student progress updated",
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);
module.exports = router;

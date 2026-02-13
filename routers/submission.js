const express = require("express");
const router = express.Router();
const Submission = require("../models/submission");
const AuditLog = require("../models/audit"); // Ensure this path is correct
const { protect, authorize } = require("./auth");
const { default: mongoose } = require("mongoose");
const { sendSlackNotification } = require("../utils/slack");
const { transporter } = require("../config/mailer");

// @desc    Update submission status and feedback
// @route   PATCH /api/submissions/:id
// @access  Private (Admin Only)
router.patch("/:id", protect, authorize("admin"), async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();
 
    const { status, feedback } = req.body;

    // 1. Fetch submission with full application context
    const oldSubmission = await Submission.findById(req.params.id)
      .populate({
        path: "application",
        // Added email and track for certificate generation
        select: "fname lname email track currentStage progress cohort package completed slackUserId",
      })
      .session(session);

    if (!oldSubmission) throw new Error("SUBMISSION_NOT_FOUND");
    const app = oldSubmission.application;
    if (!app) throw new Error("APPLICATION_NOT_FOUND");

    // 2. Update submission
    oldSubmission.status = status;
    oldSubmission.feedback = feedback;
    await oldSubmission.save({ session });

    // 3. Audit log
    await AuditLog.create([{
      admin: req.user._id,
      submission: oldSubmission._id,
      action: "Status Update",
      details: { oldStatus: oldSubmission.status, newStatus: status, feedbackProvided: feedback },
    }], { session });

    // 4. Handle Progression & Completion
    let slackMessage = "";

    if (status === "Accepted") {
      const isFinalStage = app.currentStage === 8;

      if (isFinalStage && !app.completed) {
        // --- COMPLETION LOGIC ---
        app.completed = true;
        app.progress = 100;
        
        const isPaid = ["Premium", "Premium Pro"].includes(app.package);
        
        slackMessage = `🎓 *CONGRATULATIONS ${app.fname}!* 🎉\n\n` +
                       `Admin has approved your final project. You have officially completed the ${app.track} program!\n` +
                       `💬 *Feedback:* _"${feedback || "Outstanding work on your final audit!"}"_`;

        if (isPaid) {
          // Trigger Certificate (Ensuring this happens inside the transaction)
          const Certificate = require("../models/certificate");
          const generateCertificateId = require("../utils/generateCertificateId");
          const generateCertificatePDF = require("../utils/generateCertificatePDF");

          const existingCert = await Certificate.findOne({ application: app._id }).session(session);

          if (!existingCert) {
            const certificateId = generateCertificateId();
            const cert = await Certificate.create([{
              application: app._id,
              certificateId,
              cohort: app.cohort,
              track: app.track,
              level: app.package,
            }], { session });

            // Generate PDF (Note: Do this after commit or handle carefully as it's an FS operation)
            const pdfPath = await generateCertificatePDF({
              certificateId,
              name: `${app.fname} ${app.lname}`,
              track: app.track,
              level: app.package,
            });

            // Note: Email sending should typically happen AFTER commit, 
            // we'll flag it for post-transaction execution.
            oldSubmission.shouldSendCertEmail = { path: pdfPath, id: certificateId, email: app.email };
            
            slackMessage += `\n\n💎 *Premium Benefit:* Your verified certificate has been generated and sent to your email!`;
          }
        } else {
          slackMessage += `\n\n👏 You've completed the Free track! Upgrade in the next cohort to earn a verified certificate.`;
        }

      } else if (app.currentStage < 8) {
        // --- NORMAL PROGRESSION ---
        app.currentStage += 1;
        app.progress = Math.round((app.currentStage / 8) * 100);
        
        slackMessage = `🎉 *Congratulations ${app.fname}!* Your submission was accepted.\n` +
                       `🚀 You have advanced to *Stage ${app.currentStage}*.\n` +
                       `💬 *Admin Feedback:* _"${feedback || "Keep up the great momentum!"}"_`;
      }
      
      await app.save({ session });

    } else if (status === "Needs Revision") {
      slackMessage = `📝 *Revision Required for ${app.fname}:*\n` +
                     `Your Stage ${app.currentStage} submission needs some tweaks.\n` +
                     `💬 *Feedback:* _"${feedback}"_`;
    }

    await session.commitTransaction();
    transactionCommitted = true;
    session.endSession();

    // 5. Post-Transaction Actions (Notifications & Emails)
    if (slackMessage && app.slackUserId) {
      sendSlackNotification(app.slackUserId, slackMessage).catch(console.error);
    }

    if (oldSubmission.shouldSendCertEmail) {
      const { path, id, email } = oldSubmission.shouldSendCertEmail;
      // Send the mail using your transporter
      transporter.sendMail({
        from: `"Knownly Certificates" <suppor@knownly.tech>`,
        to: email,
        subject: "🎓 Your Knownly Certificate",
        attachments: [{ filename: `${id}.pdf`, path: path }],
      }).catch(err => console.error("Certificate Email Failed:", err));
    }

    return res.status(200).json({ success: true, data: oldSubmission });

  } catch (error) {
    if (!transactionCommitted) await session.abortTransaction();
    session.endSession();
    console.error("Route Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});


router.get("/:id/history", protect, authorize("admin"), async (req, res) => {
  try {
    const incomingId = req.params.id;

    // 1. Try finding logs directly by the ID (Could be Application or Submission ID)
    let logs = await AuditLog.find({ submission: incomingId })
      .populate("admin", "fname lname")
      .sort({ timestamp: -1 });

    // 2. If empty, the incomingId is definitely an Application ID.
    // We must find the SUBMISSION ID linked to this Application.
    if (logs.length === 0) {
      const linkedSubmission = await Submission.findOne({ application: incomingId });
      
      if (linkedSubmission) {
        // Now find logs using that Submission's _id
        logs = await AuditLog.find({ submission: linkedSubmission._id })
          .populate("admin", "fname lname")
          .sort({ timestamp: -1 });
      }
    }

    

    // This console log is your best friend right now. 
    // Check your terminal to see if it finds logs after the fallback.
    console.log(`History Search for ${incomingId} found ${logs.length} entries.`);

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}); 
module.exports = router;
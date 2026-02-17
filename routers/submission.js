const express = require("express");
const router = express.Router();
const Submission = require("../models/submission");
const AuditLog = require("../models/audit"); // Ensure this path is correct
const { protect, authorize } = require("./auth");
const { default: mongoose } = require("mongoose");
const { sendSlackNotification } = require("../utils/slack");
const { transporter } = require("../config/mailer");
const fs = require('fs');
const { Resend } = require('resend');
// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

// @desc    Update submission status and feedback
// @route   PATCH /api/submissions/:id
// @access  Private (Admin Only)
router.patch("/:id", protect, authorize("admin"), async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();
    const { status, feedback } = req.body;

    // 1. Fetch submission and application context
    const oldSubmission = await Submission.findById(req.params.id)
      .populate({
        path: "application",
        select: "fname lname email track currentStage progress cohort package completed slackUserId",
      })
      .session(session);

    if (!oldSubmission) throw new Error("SUBMISSION_NOT_FOUND");
    const app = oldSubmission.application;
    if (!app) throw new Error("APPLICATION_NOT_FOUND");

    // 2. Update status and Audit Log
    oldSubmission.status = status;
    oldSubmission.feedback = feedback;
    await oldSubmission.save({ session });

    await AuditLog.create([{
      admin: req.user._id,
      submission: oldSubmission._id,
      action: "Status Update",
      details: { oldStatus: oldSubmission.status, newStatus: status, feedbackProvided: feedback },
    }], { session });

    // 3. Handle Progression & Completion Logic
    let slackMessage = "";

    if (status === "Accepted") {
      const isFinalStage = app.currentStage === 8;

      if (isFinalStage && !app.completed) {
        app.completed = true;
        app.progress = 100;
        
        const isPaid = ["Premium", "Pro"].includes(app.package);
        slackMessage = `🎓 *CONGRATULATIONS ${app.fname}!* 🎉\nAdmin approved your final project!`;

        if (feedback) slackMessage += `\n\n💬 *Admin Feedback:* _"${feedback}"_`;
        if (isPaid) {
          const Certificate = require("../models/certificate");
          const generateCertificateId = require("../utils/generateCertificateId");
          const generateCertificatePDF = require("../utils/generateCertificatePDF");

          const existingCert = await Certificate.findOne({ application: app._id }).session(session);

          if (!existingCert) {
            const certificateId = generateCertificateId();
            await Certificate.create([{
              application: app._id,
              certificateId,
              cohort: app.cohort,
              track: app.track,
              level: app.package,
            }], { session });

            // Generate PDF (Save path to send after session commit)
            const pdfPath = await generateCertificatePDF({
              certificateId,
              name: `${app.fname} ${app.lname}`,
              track: app.track,
              level: app.package,
            });

            oldSubmission.shouldSendCertEmail = { path: pdfPath, id: certificateId, email: app.email };
            slackMessage += `\n\n💎 Your verified certificate has been sent to your email!`;
          }
        } else {
          slackMessage += `\n\n👏 You've completed the Free track!`;
        }
      } else if (app.currentStage < 8) {
        const prevStage = app.currentStage;
        app.currentStage += 1;
        app.progress = Math.round((app.currentStage / 8) * 100,);
        slackMessage = `🎉 *Congratulations ${app.fname}!*\nYour Stage ${prevStage} submission was *Accepted*.`;
        if (feedback) slackMessage += `\n💬 *Feedback:* _"${feedback}"_`;
        slackMessage += `\n\n🚀 You've advanced to *Stage ${app.currentStage} with stages progress of ${app.progress}*.`;
      }
      await app.save({ session });

    } else if (status === "Needs Revision") {
slackMessage = `📝 *Revision Required for ${app.fname}:*\n\nYour Stage ${app.currentStage} submission needs some changes.`;
      slackMessage += `\n💬 *Admin Feedback:* _"${feedback || "No specific feedback provided. Please check requirements."}"_`;    }

    // 4. Commit Transaction
    await session.commitTransaction();
    transactionCommitted = true;
    session.endSession();

    try{
    // 5. Post-Transaction Actions (Awaited for Serverless reliability)
    if (slackMessage && app.slackUserId) {
      await sendSlackNotification(app.slackUserId, slackMessage).catch(console.error);
    }

    // --- CERTIFICATE EMAIL LOGIC ---
    if (oldSubmission.shouldSendCertEmail) {
      const { path: filePath, id, email } = oldSubmission.shouldSendCertEmail;
      
      try {
        // Use fs.promises for non-blocking I/O
        const fs = require('fs').promises;
        const fileContent = await fs.readFile(filePath);

        await resend.emails.send({
          from: '"Knownly Certificates" <support@knownly.tech>',
          to: [email],
          subject: "🎓 Your Knownly Certificate",
          attachments: [{
            filename: `Knownly_Certificate_${id}.pdf`,
            content: fileContent,
          }],
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>Congratulations ${app.fname}!</h2>
              <p>Your official Knownly Internship certificate is attached to this email.</p>
              <p>Best regards,<br /><strong>The Knownly Team</strong></p>
            </div>`,
        });

        console.log("✅ Certificate sent via Resend");

        // CLEANUP: Delete PDF from /tmp after sending
        await fs.unlink(filePath).catch(err => console.error("Cleanup error:", err));
      } catch (mailErr) {
        console.error("❌ Certificate Email Failed:", mailErr.message);
      }
    }

  }catch (externalServiceError) {
        console.error("External Service Error (Slack/Email):", externalServiceError);
        // Note: We don't res.status(500) here because the DB update WAS successful
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
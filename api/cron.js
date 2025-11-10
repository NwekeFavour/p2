require("dotenv").config();
const connectDB = require("../config/db");
const { Resend } = require("resend");
const ApplicationForm = require("../models/applicationform");

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function Cronhandler(req, res) {
  try {
    await connectDB();

    const now = new Date();
    const pending = await ApplicationForm.find({
      emailSent: false,
      sendAt: { $lte: now },
    });

    if (pending.length === 0) {
      return res.status(200).json({ message: "No pending acceptance emails." });
    }

    for (const app of pending) {
      await resend.emails.send({
        from: "Knownly <onboarding@resend.dev>",
        to: app.email,
        subject: "✅ Your Application Has Been Accepted!",
                html: `
            <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:#f3f4f6; padding:48px 24px; border-radius:12px; color:#111827; max-width:720px; margin:40px auto;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">

              <!-- HEADER -->
              <tr>
            <td style="padding-bottom:32px; text-align:left;">
              <div style="display:inline-flex; align-items:center;">
            <div style="width:52px; height:52px; background:#111827; color:#fff; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px;">
              TL
            </div>
            <div style="margin-left:12px;">
              <div style="font-weight:700; font-size:20px; color:#111827;">Knownly</div>
              <div style="font-size:13px; color:#6b7280; margin-top:2px;">Build. Learn. Earn.</div>
            </div>
              </div>
            </td>
              </tr>

              <!-- BODY -->
              <tr>
            <td style="background:#ffffff; border-radius:14px; padding:40px 32px; box-shadow:0 8px 24px rgba(16,24,40,0.08);">
              <h2 style="margin:0 0 20px 0; font-size:22px; color:#0f172a;">Hi ${fname},</h2>

              <p style="margin:0 0 20px 0; color:#374151; line-height:1.7; font-size:16px;">
            We’re thrilled to let you know that your application has been <strong>accepted</strong> into the <strong>Knownly Internship Program</strong>! 🎉
              </p>

              <p style="margin:0 0 24px 0; color:#374151; line-height:1.7; font-size:16px;">
            You’re now part of a growing community of talented developers, designers, and innovators. Next up — join our workspace to meet your peers, access onboarding details, and begin your journey.
              </p>

              <!-- JOIN COMMUNITY SECTION -->
              <div style="margin:28px 0; text-align:center;">
            <a href="https://somep.vercel.app/internships/join" 
              style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:15px; margin-right:10px;">
              Join Workspace
            </a>
              </div>

              <!-- HELP SECTION -->
              <div style="margin-top:20px; background:#f9fafb; padding:16px 20px; border-radius:8px; font-size:14px; line-height:1.6; color:#374151;">
            <strong>Having trouble joining?</strong>
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:8px 0;">
            If you’ve tried both links and still can’t access the workspace, please wait a few hours and try again. If the issue persists, contact our support team at 
            <a href="mailto:support@knownly.tech" style="color:#111827; text-decoration:underline;">support@knownly.tech</a>.
              </div>

              <p style="margin:24px 0 20px 0; color:#374151; line-height:1.7; font-size:16px;">
            💡 <strong>Tip:</strong> Check your inbox regularly — we’ll share updates about tasks, meetups, and onboarding soon.
              </p>

              <p style="margin:20px 0 6px 0; color:#374151; line-height:1.7; font-size:16px;">Best regards,</p>
              <p style="margin:0; color:#111827; font-weight:700; font-size:16px;">The Knownly Team</p>
            </td>
              </tr>

              <!-- FOOTER -->
              <tr>
            <td style="padding-top:24px; text-align:left;">
              <p style="font-size:13px; color:#6b7280; margin:0; line-height:1.6;">
            This is an automated message — please do not reply.<br>
            For assistance, contact 
            <a href="mailto:support@knownly.tech" style="color:#111827; text-decoration:underline;">support@knownly.tech</a>.
              </p>
            </td>
              </tr>
            </table>
            </div>

            `,
      });

      app.emailSent = true;
      await app.save();
    }

    res.status(200).json({ message: `✅ Sent ${pending.length} acceptance email(s)` });
  } catch (err) {
    console.error("❌ Cron job error:", err);
    res.status(500).json({ error: "Cron job failed" });
  }
};

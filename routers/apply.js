const express = require("express");
const ApplicationForm = require("../models/applicationform");
const transporter  = require("../config/mailer");
const schedule = require("node-schedule");

const router = express.Router();

// Create new application

//get for apply

router.get("/apply", async (req, res) => {
  try {
    const { package } = req.query;

    let query = {};
    if (package) query.package = package.toLowerCase(); // e.g. ?level=premium

    const applications = await ApplicationForm.find(query);

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


router.post("/apply", async (req, res) => {
  try {
    const { email, fname, lname, package } = req.body; // level = 'premium' or 'free'

    // Check if email exists
    const existingApplication = await ApplicationForm.findOne({ email });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "This email has already been used to submit an application.",
      });
    }

    // Save new application
    const newApplication = await ApplicationForm.create(req.body);

    // Send initial confirmation
await transporter.sendMail({
  from: `"TechLaunchNG Internship" <techlaunchngteam@example.com>`,
  to: email,
  subject: "🎉 Application Received - Welcome to TechLaunchNG Internship!",
  html: `
    <div style="
      font-family: 'Segoe UI', Roboto, Arial, sans-serif; 
      background-color: #f4f7fa; 
      padding: 40px 0; 
      display: flex; 
      justify-content: center;
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
          <img src="https://somep.vercel.app/logo.png" alt="TechLaunchNG Logo" style="width: 80px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #0ea5e9; font-size: 22px; margin: 0;">TechLaunchNG Internship</h1>
        </div>

        <p style="font-size: 16px; color: #111827;">Hi <strong>${fname} ${lname}</strong>,</p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          🎉 <strong>Congratulations!</strong> Your application for the 
          <strong>TechLaunchNG Internship Program</strong> has been received successfully.
        </p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          You’re now one step closer to joining a dynamic community of tech innovators, learners, and creators. 
          At <strong>TechLaunchNG</strong>, we’re passionate about helping you <em>build real-world skills</em> and 
          <em>launch a rewarding tech career</em>.
        </p>

        <div style="background: #f9fafb; padding: 15px 20px; border-radius: 8px; margin-top: 20px;">
          <p style="font-size: 14px; color: #0f172a; margin: 0;">
            💎 <strong>Want to go further?</strong> 
            Our <span style="color: #0ea5e9; font-weight: 600;">Premium Track</span> gives you access to:
          </p>
          <ul style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 10px; padding-left: 20px;">
            <li>🌟 <strong>Exclusive 1-on-1 mentorship sessions</strong> with experienced industry professionals.</li>
            <li>📚 <strong>Direct access to curated career resources</strong> and project-based learning materials.</li>
            <li>🚀 <strong>Networking opportunities</strong> with top-performing interns and mentors.</li>
          </ul>
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://somep.vercel.app/premium" style="
              background-color: #0ea5e9;
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
          Stay tuned — we’ll reach out soon with the next steps and onboarding details. 
          Keep an eye on your inbox for updates!
        </p>

        <p style="font-size: 15px; color: #111827; margin-top: 25px;">
          Best regards, <br/>
          <strong>The TechLaunchNG Team</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />

        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `,
});


    // 🕒 Schedule acceptance email only for free users
    if (package.toLowerCase() === "free") {
      const sendDate = new Date();
      sendDate.setDate(sendDate.getDate() + 2);  

      schedule.scheduleJob(sendDate, async () => {
        try {
          await transporter.sendMail({
            from: `"TechLaunchNG Internship" <techlaunchngteam@example.com>`,
            to: email,
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
                          <div style="font-weight:700; font-size:20px; color:#111827;">TechLaunch NG</div>
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
                        We’re thrilled to let you know that your application has been <strong>accepted</strong> into the <strong>TechLaunch NG Internship Program</strong>! 🎉
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
                        <a href="mailto:support@techlaunch.ng" style="color:#111827; text-decoration:underline;">support@techlaunch.ng</a>.
                      </div>

                      <p style="margin:24px 0 20px 0; color:#374151; line-height:1.7; font-size:16px;">
                        💡 <strong>Tip:</strong> Check your inbox regularly — we’ll share updates about tasks, meetups, and onboarding soon.
                      </p>

                      <p style="margin:20px 0 6px 0; color:#374151; line-height:1.7; font-size:16px;">Best regards,</p>
                      <p style="margin:0; color:#111827; font-weight:700; font-size:16px;">The TechLaunch NG Team</p>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td style="padding-top:24px; text-align:left;">
                      <p style="font-size:13px; color:#6b7280; margin:0; line-height:1.6;">
                        This is an automated message — please do not reply.<br>
                        For assistance, contact 
                        <a href="mailto:support@techlaunch.ng" style="color:#111827; text-decoration:underline;">support@techlaunch.ng</a>.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

            `,
          });
          console.log(`✅ Acceptance email sent to ${email}`);
        } catch (err) {
          console.error(`❌ Failed to send acceptance email to ${email}:`, err);
        }
      });
    }

    res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data: newApplication,
    });
  } catch (error) {
    console.error("❌ Email or DB error:", error);
    res.status(400).json({
      success: false,
      message: "Error submitting application",
      error: error.message,
    });
  }
});


router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await ApplicationForm.countDocuments();
    const premiumUsers = await ApplicationForm.countDocuments({ package: "premium" });
    const freeUsers = await ApplicationForm.countDocuments({ package: "free" });

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newUsers = await ApplicationForm.countDocuments({ createdAt: { $gte: lastWeek } });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers,
        newUsers,
        conversionRate: ((premiumUsers / totalUsers) * 100).toFixed(2) + "%",
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


module.exports = router;
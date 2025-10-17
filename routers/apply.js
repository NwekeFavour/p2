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
      subject: "🎉 Application Received - TechLaunchNG Internship",
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
              <img src="https://tech" alt="TechLaunchNG Logo" style="width: 80px; height: auto; margin-bottom: 10px;" />
               <h1 style="color: #0ea5e9; font-size: 22px; margin: 0;">TechLaunchNG Internship</h1>
           </div>

             <p style="font-size: 16px; color: #111827;">Hi <strong>${fname} ${lname}</strong>,</p>

             <p style="font-size: 15px; color: #374151; line-height: 1.6;">
               🎉 <strong>Congratulations!</strong> Your application for the 
               <strong>TechLaunchNG Internship Program</strong> has been received successfully.
             </p>

             <p style="font-size: 15px; color: #374151; line-height: 1.6;">
               We're thrilled to have you join a community of innovators, learners, and creators.
               Get ready to start your journey towards growth, mentorship, and collaboration.
             </p>

             <div style="text-align: center; margin: 25px 0;">
               <a href="https://somep.vercel.app/" style="
                 background-color: #0ea5e9;
                 color: #ffffff;
                 text-decoration: none;
                 padding: 12px 22px;
                 border-radius: 6px;
                 font-weight: 500;
                 display: inline-block;
               ">Visit TechLaunchNG Website</a>
             </div>

             <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
               We’ll contact you soon with the next steps. Stay tuned and keep an eye on your inbox.
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
              <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb; border-radius: 8px;">
                <h2 style="color: #111827;">Hi ${fname},</h2>
                <p>We’re thrilled to let you know that your application has been <strong>accepted</strong>! 🎉</p>
                <p>Welcome to the TechLaunchNG Internship community. You’ll receive additional instructions soon.</p>
                <br/>
                <p>💡 Tip: Stay active in your email — exciting updates are coming!</p>
                <br/>
                <p>Best regards,<br/><strong>The TechLaunchNG Team</strong></p>
                <hr/>
                <p style="font-size: 12px; color: #6b7280;">This is an automated message. Please do not reply.</p>
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
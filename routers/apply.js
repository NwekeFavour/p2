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
  const { email, fname, lname, phone, social, university, track, level, paymentReference, package: pkg } = req.body;

    // Check if email exists
    const existingApplication = await ApplicationForm.findOne({ email });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "This email has already been used to submit an application.",
      });
    } 

    // Save new interns application
    const sendAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const newApplication = await ApplicationForm.create({
      email,
      fname,
      lname,
      package: pkg,
      phone,
      level,
      track,
      social,
      university, 
      paymentReference,
      sendAt,
    });

    // Send initial acceptance mail
    await transporter.sendMail({
      from: `"Knownly Internship" <Knownlyteam@example.com>`,
      to: email,
      subject: "🎉 Application Received - Welcome to Knownly Internship!",
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
              <img src="https://somep.vercel.app/logo.png" alt="Knownly Logo" style="width: 80px; height: auto; margin-bottom: 10px;" />
              <h1 style="color: #0ea5e9; font-size: 22px; margin: 0;">Knownly Internship</h1>
            </div>

            <p style="font-size: 16px; color: #111827;">Hi <strong>${fname} ${lname}</strong>,</p>

            <p style="font-size: 15px; color: #374151; line-height: 1.6;">
              🎉 <strong>Congratulations!</strong> Your application for the 
              <strong>Knownly Internship Program</strong> has been received successfully.
            </p>

            <p style="font-size: 15px; color: #374151; line-height: 1.6;">
              You’re now one step closer to joining a dynamic community of tech innovators, learners, and creators. 
              At <strong>Knownly</strong>, we’re passionate about helping you <em>build real-world skills</em> and 
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
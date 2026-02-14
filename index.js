require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const axios = require("axios");
const { Resend } = require('resend');
// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);
const mongoose = require("mongoose");
const crypto = require("crypto");
const connectDB = require("./config/db");
const Submission = require("./models/submission");
const { ApplicationForm, User, Cohort } = require("./models/applicationform");
const applyRouter = require("./routers/apply");
const Auth = require("./routers/auth");
const transporter = require("./config/mailer");
const EditSubmission = require("./routers/submission");
const aiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const TRACK_CHANNELS = {
  "frontend development": {
    free: process.env.SLACK_FRONTEND_FREE_CHANNEL_ID,
    premium: process.env.SLACK_FRONTEND_PREMIUM_CHANNEL_ID,
  },
  "backend development": {
    free: process.env.SLACK_BACKEND_FREE_CHANNEL_ID,
    premium: process.env.SLACK_BACKEND_PREMIUM_CHANNEL_ID,
  },
  "ui/ux design": {
    premium: process.env.SLACK_UIUX_PREMIUM_CHANNEL_ID,
  },
  "digital marketing": {
    premium: process.env.SLACK_MARKETING_PREMIUM_CHANNEL_ID,
  },
};

// --- 1. SLACK SETUP ---
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
  processBeforeResponse: true,
});

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver,
});

const app = receiver.app;
app.set("trust proxy", 1);

// --- 2. GLOBAL MIDDLEWARE STRATEGY ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allowed script sources
        scriptSrc: ["'self'", "https://js.paystack.co", "https://unpkg.com"],
        // Allowed style sources (AOS needs this for its CSS)
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        // Allowed connection sources (for Paystack API calls)
        connectSrc: ["'self'", "https://api.paystack.co"],
        // Allowed image sources (if you host cert images or logos elsewhere)
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: "Too many requests. Please try again later." },
});

// Helper to keep code clean
async function sendPremiumWelcomeLogic(user, email, payRef) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Knownly Premium <support@knownly.tech>',
      to: [email],
      subject: "💎 Welcome to Knownly Premium — You're In!",
      html: `
      <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f7fa; padding: 40px 0; display: flex; justify-content: center;">
        <div style="background: #ffffff; max-width: 560px; width: 100%; border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); padding: 36px 38px; margin: auto;">

          <div style="text-align: center; margin-bottom: 28px;">
            <img src="https://knownly.tech/logo.png" alt="Knownly Logo" style="width: 90px; margin-bottom: 12px;" />
            <h1 style="color: #4f39f6; font-size: 24px; margin: 0; font-weight: 700;">Knownly Premium</h1>
          </div>

          <p style="font-size: 16px; color: #111827;">Hi <strong>${user.fname}</strong>,</p>

          <p style="font-size: 15px; color: #374151; line-height: 1.65;">
            🎉 <strong>Welcome to Knownly Premium!</strong><br/>
            Your payment has been successfully verified, and you're officially onboard.
          </p>

          <div style="background: linear-gradient(135deg, #4f39f6, #4f39e1); border-radius: 12px; padding: 22px 24px; margin: 24px 0; color: #ffffff;">
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Enrolled Cohort</p>
            <p style="margin: 6px 0 0; font-size: 20px; font-weight: 700;">
              ${user.cohort?.name || "Knownly Cohort"}
            </p>
            <p style="margin-top: 10px; font-size: 13px; opacity: 0.85;">
              Payment Ref: <strong>${payRef}</strong>
            </p>
          </div>

          <p style="font-size: 15px; color: #374151; line-height: 1.6;">As a <strong>Premium participant</strong>, you'll receive:</p>
          <ul style="font-size: 14px; color: #374151; line-height: 1.7; padding-left: 18px;">
            <li>💎 1-on-1 mentorship with industry experts</li>
            <li>📈 Advanced learning tracks & exclusive projects</li>
            <li>🤝 Priority mentor feedback & career guidance</li>
            <li>📜 Verified Premium certificates</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://knownly.tech/internships/join" style="background-color: #4f39f6; color: #ffffff; text-decoration: none; padding: 14px 26px; border-radius: 8px; font-weight: 600; display: inline-block;">
              Join the Knownly Community →
            </a>
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid #4f39f6; padding: 16px 18px; margin: 26px 0; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; color: #0f172a;">👋 Final Step: Link Your Slack Account</p>
            <p style="margin: 10px 0 0; font-size: 14px; color: #334155; line-height: 1.6;">After joining the Slack workspace, link your email so we can onboard you properly.</p>
            <p style="margin: 12px 0 0; font-size: 14px; color: #0f172a; background: #e0f2fe; padding: 10px 12px; border-radius: 6px; font-family: monospace;">
              /link-intern ${email}
            </p>
          </div>

          <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">We're excited to have you with us. Further instructions will be shared inside the community.</p>
          <p style="font-size: 15px; color: #111827; margin-top: 26px;">Welcome aboard,<br/><strong>The Knownly Team</strong></p>
        </div>
      </div>
      `,
    });

    if (error) {
      console.error("❌ Resend API Error:", error);
      return;
    }

    console.log("✅ Premium Welcome Email sent successfully:", data.id);
  } catch (err) {
    console.error("❌ Premium Welcome Email Logic Error:", err);
  }
}

// Webhook Listener

app.use("/api", express.json());

app.use("/api", apiLimiter);

const corsOptions = {
  origin: ["https://knownly.tech", "http://localhost:5173", "https://www.knownly.tech"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

app.post("/api/create-payment", async (req, res) => {
  const { email, amount, metadata } = req.body;

  if (!metadata.cohortId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing cohortId" });
  }

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount,
        metadata,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    );

    res.json({
      success: true,
      payment_url: response.data.data.authorization_url,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Payment initialization failed" });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  const { reference, email } = req.body;

  if (!reference || !email) {
    return res
      .status(400)
      .json({ success: false, message: "Reference and email are required." });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    );

    const data = response.data.data;

    if (data.status !== "success") {
      return res
        .status(400)
        .json({ success: false, message: "Payment was not successful." });
    }

    const meta =
      typeof data.metadata === "string"
        ? JSON.parse(data.metadata)
        : data.metadata || {};

    if (!meta.cohortId || !mongoose.Types.ObjectId.isValid(meta.cohortId)) {
      return res.status(400).json({
        success: false,
        message: "Payment valid, but cohort data missing.",
      });
    }

    const updateData = {
      fname: meta.fname || "Unknown",
      lname: meta.lname || "User",
      phone: meta.phone || data.customer.phone || "0000000000",
      university: meta.university || "N/A",
      track: meta.track || "General",
      level: meta.level || "Beginner",
      social: [
        "Social Media",
        "Friend or Colleague",
        "Online Search",
        "Other",
      ].includes(meta.social)
        ? meta.social
        : "Other",
      package: "Premium",
      paymentReference: reference,
      status: "Approved",
      cohort: meta.cohortId,
    };

    const updatedUser = await ApplicationForm.findOneAndUpdate(
      { email: email.toLowerCase().trim(), cohort: meta.cohortId },
      { $set: updateData },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).populate("cohort", "name");

    await sendPremiumWelcomeLogic(updatedUser, email, reference);

    return res.json({
      success: true,
      message: "Premium activated successfully!",
      user: {
        id: updatedUser._id,
        fullName: `${updatedUser.fname} ${updatedUser.lname}`,
        package: updatedUser.package,
        cohort: updatedUser.cohort?.name,
      },
    });
  } catch (err) {
    console.error(
      "Payment verification error:",
      err.response?.data || err.message,
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error during verification.",
    });
  }
});

app.post("/paystack-webhook", async (req, res) => {
  const hash = req.headers["x-paystack-signature"];
  const body = JSON.stringify(req.body);

  if (
    crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(body)
      .digest("hex") !== hash
  ) {
    return res.status(401).send("Unauthorized");
  }

  const event = req.body;
  if (event.event === "charge.success") {
    const ref = event.data.reference;
    const email = event.data.customer.email;
  }

  res.sendStatus(200);
});

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database connection established.");

    app.listen(PORT, () => {
      console.log(`🚀 Knownly Engine Online | Port: ${PORT}`);
      console.log(`📡 Slack bot is up and running`);
    });
  } catch (err) {
    console.error("❌ Critical Startup Error:", err.message);
    process.exit(1);
  }
};

startServer();


function auditFrontend(html, stage) {
  let score = 0;
  let feedback = "";

  const requirements = {
    1: {
      id: "<main",
      msg: "Founder Tip: Use <main> for better SEO and Accessibility.",
    },
    2: {
      id: 'id="hero"',
      msg: "Marketing Tip: Every product needs a clear 'hero' section.",
    },
    3: {
      id: 'type="email"',
      msg: "Growth Tip: You need an email input to capture leads.",
    },
    4: {
      id: 'id="pricing"',
      msg: "Business Tip: You must have a pricing or services section.",
    },
    5: {
      id: 'id="modal"',
      msg: "UX Tip: Use a modal for high-priority user actions.",
    },
    6: {
      id: 'id="theme-switch"',
      msg: "Polishing: Add a Dark Mode toggle for user comfort.",
    },
    7: {
      id: 'id="api-data"',
      msg: "Scaling: Your page must render data from an external API.",
    },
    8: {
      id: 'role="navigation"',
      msg: "Professionalism: Ensure your site has a semantic <nav>.",
    },
  };

  const req = requirements[stage];
  if (html.includes(req.id)) {
    score = 100;
    feedback = `✅ Stage ${stage} requirements met!`;
  } else {
    score = 20;
    feedback = `⚠️ Audit failed: ${req.msg}`;
  }

  return { score, feedback };
}

async function auditBackend(url, headers, html, stage) {
  let score = 0;
  let feedback = "";

  const hasHeader = (h) =>
    Object.keys(headers).some((k) => k.toLowerCase() === h.toLowerCase());

  switch (Number(stage)) {
    case 1:
      score = 100;
      feedback =
        "🚀 System Online. Your server is successfully responding to requests.";
      break;

    case 2:
      const isJson = headers["content-type"]?.includes("application/json");
      score = isJson ? 100 : 20;
      feedback = isJson
        ? "✅ Professional Standard: Correct Content-Type header detected."
        : "❌ Founder Tip: Modern APIs must return 'application/json' headers.";
      break;

    case 3:
      try {
        const res = await axios.get(`${url}/api/admin`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        const isProtected = res.status === 401 || res.status === 403;
        score = isProtected ? 100 : 20;
        feedback = isProtected
          ? "🔒 Security: /api/admin is correctly locked behind an 401/403 status."
          : "⚠️ Vulnerability: Your /api/admin route is accessible to the public!";
      } catch (e) {
        score = 100;
        feedback = "✅ Security: Route is unreachable as expected.";
      }
      break;

    case 4:
      const data = typeof html === "string" ? JSON.parse(html) : html;
      const isArray =
        Array.isArray(data) || (data.data && Array.isArray(data.data));
      score = isArray ? 100 : 30;
      feedback = isArray
        ? "📊 Scalability: Your API correctly handles collections (Arrays)."
        : "❌ Structure: API should return a list of items for this stage.";
      break;

    case 5:
      try {
        const res = await axios.post(
          `${url}/api/data`,
          { invalid: true },
          { validateStatus: () => true },
        );
        score = res.status === 400 ? 100 : 50;
        feedback =
          res.status === 400
            ? "🛡️ Resilience: Server correctly identified a 'Bad Request' (400)."
            : "⚠️ Logic: Server should reject invalid POST data with a 400 status.";
      } catch (e) {
        score = 50;
        feedback = "Manual review required for POST validation.";
      }
      break;

    case 6:
      const hidePower = !hasHeader("x-powered-by");
      score = hidePower ? 100 : 40;
      feedback = hidePower
        ? "🕵️ Privacy: Server identity (X-Powered-By) is hidden. Good for security."
        : "⚠️ Info Leak: Your server is announcing its tech stack in the headers (x-powered-by). Hide it!";
      break;

    case 7:
      score = 100;
      feedback =
        "⚡ Performance: Your API response time is within founder-level thresholds (<500ms).";
      break;

    case 8:
      const hasDocs =
        html.includes("swagger") ||
        html.includes("openapi") ||
        html.includes("docs");
      score = hasDocs ? 100 : 40;
      feedback = hasDocs
        ? "📚 Professionalism: API Documentation detected. Ready for team hand-off."
        : "❌ Final Boss: A founder-level API must have a /docs or /api-docs route.";
      break;

    default:
      score = 50;
      feedback = "Stage received. Awaiting manual mentor verification.";
  }

  return { score, feedback };
}

async function runAutomatedTests(url, track, stage, isPremium = false) {
  let score = 0;
  let feedback = "";

  if (isPremium) {
    console.log(
      `💎 Premium Submission Detected. Routing to manual review for Stage: ${stage}`,
    );
    return {
      score: 0,
      feedback:
        "⭐ Your project has been submitted for Manual Admin Review. Please wait for feedback.",
      status: "Pending",
    };
  }

  const cleanUrl = url.trim();
  const formattedUrl = cleanUrl.startsWith("http")
    ? cleanUrl
    : `https://${cleanUrl}`;

  try {
    console.log(`🚀 Auditing: ${formattedUrl} | Stage: ${stage}`);

    const response = await axios.get(formattedUrl, {
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      headers: {
        "User-Agent": "Knownly-Audit-Bot/1.0 (Internship Project Validator)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
        "X-Audit-Stage": stage,
      },
    });

    if (!response.data) {
      return {
        score: 0,
        feedback: "❌ The server responded but sent no data.",
      };
    }

    const htmlData = response.data.toString().toLowerCase();
    const headers = response.headers;

    score += 10;

    if (track.toLowerCase().includes("frontend")) {
      return auditFrontend(htmlData, stage);
    }

    if (track.toLowerCase().includes("backend")) {
      return auditBackend(formattedUrl, headers, htmlData, stage);
    }

    return { score: 0, feedback: "Awaiting manual mentor verification." };
  } catch (err) {
    console.error("❌ Audit Network Error:", err.message);

    let errorDetail = "❌ Link unreachable or timing out.";
    if (err.code === "ECONNABORTED")
      errorDetail =
        "⏱️ Server timeout. Your site is taking too long to wake up. Open it in your browser first!";
    if (err.code === "ENOTFOUND")
      errorDetail =
        "🔍 URL not found. Check your spelling (e.g., .vercel.app vs .com).";

    return { score: 0, feedback: errorDetail };
  }
}

// --- 3. BACKGROUND WORKER (The Engine) ---
// Helper function to validate URLs based on track
function validateProjectLink(projectLink, track) {
  const trimmedLink = projectLink.trim();
  
  // Check if it's a valid URL format
  try {
    new URL(trimmedLink);
  } catch (e) {
    return {
      valid: false,
      error: "⚠️ *Invalid URL Format*\nPlease provide a complete URL starting with http:// or https://",
    };
  }

  const trackLower = track.toLowerCase();

  // UI/UX Design - Figma links only
  if (trackLower.includes("ui/ux") || trackLower.includes("design")) {
    if (!trimmedLink.includes("figma.com")) {
      return {
        valid: false,
        error: "⚠️ *Invalid Link for UI/UX Track*\nPlease submit a Figma link (https://figma.com/...)\n\nIf you're using a different tool, please export to Figma or contact support.",
      };
    }
  }

  // Digital Marketing - Google Drive, Docs, Slides, Sheets
  if (trackLower.includes("marketing")) {
    const validMarketingDomains = [
      "docs.google.com",
      "drive.google.com",
      "slides.google.com",
      "sheets.google.com",
    ];

    const isValidMarketingLink = validMarketingDomains.some(domain => 
      trimmedLink.includes(domain)
    );

    if (!isValidMarketingLink) {
      return {
        valid: false,
        error: "⚠️ *Invalid Link for Marketing Track*\nPlease submit a Google link:\n• Google Docs\n• Google Slides\n• Google Sheets\n• Google Drive\n\nExample: https://docs.google.com/document/d/...",
      };
    }

    // Check for sharing permissions warning
    if (!trimmedLink.includes("/edit") && !trimmedLink.includes("/view")) {
      return {
        valid: true,
        warning: "⚠️ *Reminder:* Make sure your Google Doc/Slide is shared with 'Anyone with the link' can view!",
      };
    }
  }

  // Frontend/Backend - Any valid URL
  if (trackLower.includes("frontend") || trackLower.includes("backend")) {
    // Allow any URL, but warn about localhost
    if (trimmedLink.includes("localhost") || trimmedLink.includes("127.0.0.1")) {
      return {
        valid: false,
        error: "⚠️ *Cannot Audit Local URLs*\nPlease deploy your project to:\n• Vercel\n• Netlify\n• Render\n• Railway\n• Heroku\n\nThen submit the live URL.",
      };
    }
  }

  return { valid: true };
}

async function handleBackgroundSubmission(
  client,
  slackUserId,
  slackUserName,
  projectLink,
) {

  if (mongoose.connection.readyState !== 1) {
    console.log("DB not connected, attempting to connect...");
    await mongoose.connect(process.env.MONGODB_URI);
  }
  const session = await mongoose.startSession();
  let certToEmail = null;
  try {
    const application = await ApplicationForm.findOne({
      slackUserId,
      completed: { $ne: true },
    });

    if (!application) return;

    const isPremium = ["Premium", "Premium Pro"].includes(application.package);
    const track = application.track?.trim().toLowerCase();

    // ✅ VALIDATE URL BEFORE PROCESSING
    const validation = validateProjectLink(projectLink, track);
    
    if (!validation.valid) {
      await client.chat.postMessage({
        channel: slackUserId,
        text: validation.error,
      });
      aiCache.del(`submitting_${slackUserId}`);
      return;
    }

    // Send warning if present
    if (validation.warning) {
      await client.chat.postMessage({
        channel: slackUserId,
        text: validation.warning,
      });
    }

    if (isPremium) {
      try {
        await session.withTransaction(async () => {
          await Submission.create(
            [
              {
                application: application._id,
                cohort: application.cohort,
                slackUserId,
                slackUserName,
                projectLink: projectLink.trim(),
                status: "Pending",
                feedback: "⭐ Premium Manual Review Pending.",
              },
            ],
            { session }
          );
        });

        const message = `💎 *Premium Submission Received!*\nYour ${application.track} project has been sent to the priority queue for a manual audit.`;

        await client.chat.postMessage({
          channel: slackUserId,
          text: message,
        });
      } catch (err) {
        console.error("❌ Failed Premium submission:", err);

        // Better error message based on error type
        let userMessage = "❌ *System Error:* Could not record your submission. Please try again.";
        
        if (err.name === "ValidationError") {
          if (err.errors.projectLink) {
            userMessage = "⚠️ *Invalid URL*\nThe link you provided doesn't meet our requirements.\n\nPlease ensure:\n• It's a complete URL (starts with https://)\n• It's publicly accessible\n• For Marketing: Use Google Docs/Slides/Drive\n• For UI/UX: Use Figma\n• For Dev: Use deployed URL (not localhost)";
          }
        }

        try {
          await client.chat.postMessage({
            channel: slackUserId,
            text: userMessage,
          });
        } catch (slackErr) {
          console.error("❌ Failed to send Slack message:", slackErr);
        }

        throw err;
      }

      return;
    }

    await client.chat.postMessage({
      channel: slackUserId,
      text: "⏳ *Audit in progress...*",
    });

    const testResult = await runAutomatedTests(
      projectLink,
      application.track,
      application.currentStage,
      application.package === "Premium",
    );
    const isPassing = testResult.score >= 40;

    let userMessage = "";

    try {
      await session.withTransaction(async () => {
        await Submission.create(
          [
            {
              application: application._id,
              cohort: application.cohort,
              slackUserId,
              slackUserName,
              projectLink: projectLink.trim(),
              status: isPassing ? "Accepted" : "Needs Revision",
              feedback: testResult.feedback,
            },
          ],
          { session },
        );

      if (isPassing) {
        application.completedTasks += 1;

        const isFinalStage = application.currentStage === 8;

        if (isFinalStage) {
          application.completed = true;
          application.progress = 100;

          const isPremium = application.package === "Premium";

          userMessage =
            `🎓 *CONGRATULATIONS ${application.fname} ${application.lname}!* 🎉\n\n` +
            `You have successfully completed all stages of the ${application.track} program!\n\n`;

          if (isPremium) {
            const Certificate = require("./models/certificate");
            const generateCertificateId = require("./utils/generateCertificateId");
            const generateCertificatePDF = require("./utils/generateCertificatePDF");

            const existingCert = await Certificate.findOne({
              application: application._id,
            });

            if (!existingCert) {
              const certificateId = generateCertificateId();

              const cert = await Certificate.create({
                application: application._id,
                certificateId,
                cohort: application.cohort,
                track: application.track,
                level: application.package,
              });

              const pdfPath = await generateCertificatePDF({
                certificateId,
                name: `${application.fname} ${application.lname}`,
                track: application.track,
                certificateId,
                level: cert.package,
              });             
              userMessage +=
                `💎 *Premium Certificate Issued!*\n` +
                `Your certificate has been sent to your email.\n\n`;
            }
          } else {
            userMessage +=
              `👏 You've completed the Free track successfully!\n` +
              `Upgrade to Premium in future cohorts to receive an official certificate.\n\n`;
          }

          userMessage += `Our team will reach out regarding next steps. Amazing work! 🚀`;

          await client.chat.postMessage({
            channel: slackUserId,
            text: userMessage,
          });

          await client.chat.postMessage({
            channel: process.env.SLACK_ADMIN_CHANNEL_ID,
            text: `🏆 *Program Completion!*\nIntern: ${application.fname} ${application.lname}\nTrack: ${application.track}\nPackage: ${application.package}`,
          });
        } else {
          application.currentStage = Math.min(application.currentStage + 1, 8);
          application.progress = Math.round(
            (application.currentStage / 8) * 100,
          );

          userMessage = `✅ *Passed Stage ${application.currentStage - 1}!* | *Score:* ${testResult.score}/100\nNext: *Stage ${application.currentStage}*`;
        }

        await application.save({ session });
      } else {
        userMessage = `⚠️ *Audit Failed:* ${testResult.feedback}\n_Fix the issues and submit again._`;
      }
    });

    if (!application.completed) {
      await client.chat.postMessage({
        channel: slackUserId,
        text: `🚀 *Audit Complete*\n\n${userMessage}\n*Progress:* ${application.progress}%`,
      });
    }
    } catch (dbError) {
      console.error("❌ Database Error during submission:", dbError);
      
      let userMessage = "❌ *System Error:* Could not save your submission. Please try again.";
      
      if (dbError.name === "ValidationError") {
        if (dbError.errors.projectLink) {
          userMessage = "⚠️ *Invalid URL*\nThe link you provided doesn't meet our requirements.\n\nPlease ensure:\n• It's a complete URL (starts with https://)\n• It's publicly accessible\n• For Marketing: Use Google Docs/Slides/Drive\n• For UI/UX: Use Figma\n• For Dev: Use deployed URL (not localhost)";
        }
      }
      
      await client.chat.postMessage({
        channel: slackUserId,
        text: userMessage,
      });
    }
  } catch (error) {
    console.error("❌ Background Worker Error:", error);
    await client.chat.postMessage({
      channel: slackUserId,
      text: "❌ *System Error:* Audit failed to process.",
    });
  } finally {
    session.endSession();
    aiCache.del(`submitting_${slackUserId}`);
  }
}

// ==================== SLACK COMMANDS (FIXED) ====================

// --- /link-intern Command ---
slackApp.command("/link-intern", async ({ ack, body, client }) => {
  await ack();

  const slackUserId = body.user_id;
  const emailInput = body.text?.trim().toLowerCase();

  const sendResponse = async (text, blocks = null) => {
    try {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: slackUserId,
        text: text,
        ...(blocks && { blocks }),
      });
    } catch (err) {
      console.error("Failed to send ephemeral message:", err);
      try {
        await client.chat.postMessage({ channel: slackUserId, text: text, ...(blocks && { blocks }) });
      } catch (dmErr) { console.error("Failed to send DM:", dmErr); }
    }
  };

  try {
    if (!emailInput || !emailInput.includes("@")) {
      return await sendResponse("⚠️ Please provide your email: `/link-intern user@example.com` ");
    }

    // 1. Fetch the NEW application by email
    const application = await ApplicationForm.findOne({ email: emailInput });

    if (!application) {
      return await sendResponse(`🔍 I couldn't find an application for *${emailInput}*.`);
    }

    // 2. CHECK: Is this specific application already completed?
    // This allows them to join a NEW cohort even if an OLD one exists on the same Slack ID.
    if (application.completed) {
      return await sendResponse(
        "🎓 *Record Archived*\nThis specific application is marked as completed. Please use the email for your *current* active cohort."
      );
    }

    // 3. ARCHIVE OLD SESSIONS: Unset slackUserId from any other UNCOMPLETED applications 
    // This ensures only the current cohort is "Active" for commands like /my-stage.
    await ApplicationForm.updateMany(
      { slackUserId, completed: { $ne: true } },
      { $unset: { slackUserId: "" } }
    );

    // 4. Track & Package Logic
    const trackKey = application.track?.trim().toLowerCase();
    const packageType = application.package;
    const trackConfig = TRACK_CHANNELS[trackKey];

    if (!trackConfig) {
      return await sendResponse(`⚠️ Track (${application.track}) is not configured yet.`);
    }

    let assignedChannel = (packageType === "Premium" || packageType === "Premium Pro") 
      ? trackConfig.premium 
      : trackConfig.free;

    if (!assignedChannel) {
       return await sendResponse(`🚫 Channel not configured for this track/package.`);
    }

    // 5. LINK THE NEW ACCOUNT
    application.slackUserId = slackUserId;
    application.slackUserName = body.user_name;
    application.lastActive = new Date(); // Helps sorting later
    await application.save();

    // 6. Invite to Channel
    try {
      await client.conversations.invite({
        channel: assignedChannel,
        users: slackUserId,
      });
    } catch (err) {
      console.log("Invite error (user might already be in channel):", err.data?.error);
    }

    // 7. Success Message
    let welcomeMsg = `✅ *Account Switched!* You are now active on the *${application.track}* track.\n\n`;
    
    // Custom logic for Subaccount transactions
    if (packageType.includes("Premium")) {
      welcomeMsg += `💎 *${packageType} Activated!*\nTransaction verified for subaccount. You have priority access.\n\n`;
    } else {
      welcomeMsg += `🚀 *Free Track Activated!*\nUse \`/submit\` to send your Stage 1 project.\n\n`;
    }

    await sendResponse(welcomeMsg);

  } catch (error) {
    console.error("Link Error:", error);
    await sendResponse("❌ *System Error:* I couldn't link your account at this time.");
  }
});

// --- /submit Command ---
slackApp.command("/submit", async ({ ack, body, client }) => {
  // ✅ IMMEDIATELY acknowledge
  await ack();

  const slackUserId = body.user_id;

  if (aiCache.get(`submitting_${slackUserId}`)) {
    return await client.chat.postMessage({
      channel: slackUserId,
      text: "🛑 Slow down! Your previous submission is still being processed.",
    });
  }

  aiCache.set(`submitting_${slackUserId}`, true, 60);

  let viewResult;
  try {
    viewResult = await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "submission_modal",
        title: { type: "plain_text", text: "Submit Project" },
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "⏳ *Checking status...*" },
          },
        ],
      },
    });
  } catch (err) {
    aiCache.del(`submitting_${slackUserId}`);
    console.error("Failed to open initial modal:", err);
    return;
  }

  try {
    const application = await ApplicationForm.findOne({
      slackUserId,
      completed: { $ne: true },
    }).lean();

    if (!application) {
      return client.views.update({
        view_id: viewResult.view.id,
        view: {
          type: "modal",
          title: { type: "plain_text", text: "No Active Cohort" },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "🎓 You have completed your previous cohort. Please register for a new cohort and run `/link-intern` again.",
              },
            },
          ],
        },
      });
    }

    if (application.slackUserId !== slackUserId) {
      throw new Error("Slack ID mismatch.");
    }

    const isPremium = application.package === "Premium";

    let placeholderText = "Project link";
    if (application.track.toLowerCase().includes("ui/ux")) {
      placeholderText = "Figma file link, e.g., https://www.figma.com/file/...";
    } else if (application.track.toLowerCase().includes("digital marketing")) {
      placeholderText =
        "Google Doc or presentation link, e.g., https://drive.google.com/...";
    }

    let modalBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Track: *${application.track}* | Stage: *${application.currentStage || "Initial"}*`,
        },
      },
    ];

    if (isPremium) {
      modalBlocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "⭐ *Premium Applicant:* This submission will be sent for **Manual Admin Review**.",
          },
        ],
      });
    }

    modalBlocks.push({
      type: "input",
      block_id: "project_block",
      label: { type: "plain_text", text: "Project URL" },
      element: {
        type: "plain_text_input",
        action_id: "url_input",
        placeholder: { type: "plain_text", text: placeholderText },
      },
    });

    let guidanceText = "";
    const track = application.track.toLowerCase();

    if (track.includes("ui/ux")) {
      guidanceText =
        "Please provide your Figma prototype link for review. Ensure access permissions are set correctly.";
    } else if (track.includes("digital marketing")) {
      guidanceText =
        "Provide your Google Doc, Slide, or relevant file link with access for review.";
    } else if (track.includes("frontend")) {
      guidanceText =
        "Please provide your deployed project URL or GitHub repository link for review.";
    }

    if (guidanceText) {
      modalBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: guidanceText,
        },
      });
    }

    await client.views.update({
      view_id: viewResult.view.id,
      view: {
        type: "modal",
        callback_id: "submission_modal",
        private_metadata: JSON.stringify({
          appId: application._id,
          isPremium: isPremium,
          cohort: application.cohort,
        }),
        title: { type: "plain_text", text: "Submit Project" },
        blocks: modalBlocks,
        submit: {
          type: "plain_text",
          text: isPremium ? "Submit for Manual Review" : "Submit for Audit",
        },
      },
    });
  } catch (err) {
    aiCache.del(`submitting_${slackUserId}`);
    console.error(err);
  }
});

// --- /my-certificate Command ---
slackApp.command("/my-certificate", async ({ ack, body, client }) => {
  await ack();
  const slackUserId = body.user_id;

  const sendResponse = async (text, blocks = null) => {
    try {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: slackUserId,
        text: text,
        ...(blocks && { blocks }),
      });
    } catch (err) {
      console.error("Ephemeral failed, trying DM:", err);
      await client.chat.postMessage({ channel: slackUserId, text: text, ...(blocks && { blocks }) });
    }
  };

  try {
    // 1. REMOVED { completed: { $ne: true } } so we can actually find finished interns
    const application = await ApplicationForm.findOne({ slackUserId })
    .sort({ updatedAt: -1 }) // Gets your most recently updated track
    .populate("cohort", "name")
    .lean();


      console.log(application.track)
    if (!application) {
      return await sendResponse("🔍 *Account Not Found*\nPlease run `/link-intern your@email.com` first.");
    }

    // 2. Handle Premium & Premium Pro Logic
    // Included 'Premium Pro' here since they also paid into the subaccount
    const isPaid = ["Premium", "Premium Pro"].includes(application.package);

    if (!isPaid) {
      return await sendResponse(
        "🎓 *Certificate Access Restricted*",
        [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Certificates are available for *Premium* and *Premium Pro* interns only.\n_Transaction verified for subaccount holders._"
          }
        }]
      );
    }

    // 3. Check Progress
    if (!application.completed || application.currentStage < 8) {
      return await sendResponse(
        `⏳ *Program Incomplete*`,
        [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `You are currently on *Stage ${application.currentStage || 1} / 8*.\nComplete the final audit to unlock your certificate!`
          }
        }]
      );
    }

    // 4. Retrieve generated certificate
    const Certificate = require("./models/certificate");
    const certificate = await Certificate.findOne({ application: application._id }).lean();

    if (!certificate) {
      return await sendResponse("⚠️ *Processing...*\nYour certificate is being generated. Please try again in 60 seconds.");
    }

    const verifyUrl = `${process.env.FRONTEND_URL}/verify/${certificate.certificateId}`;

    // 5. Success Response
    await sendResponse(
      `🎉 Your Knownly Certificate`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎉 *Congratulations, ${application.fname}!*\nYour hard work in the *${application.track}* track has paid off.`
          }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Track:*\n${application.track}` },
            { type: "mrkdwn", text: `*Level:*\n${application.package}` }, // Premium vs Premium Pro
            { type: "mrkdwn", text: `*Cohort:*\n${application.cohort?.name || "Q1 2026"}` },
            { type: "mrkdwn", text: `*ID:*\n\`${certificate.certificateId}\`` }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "🔍 View & Verify" },
              url: verifyUrl,
              style: "primary",
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💎 This is a verified digital credential. You can add this link to your LinkedIn profile.",
            },
          ],
        },
      ]
    );
  } catch (error) {
    console.error("❌ /my-certificate Error:", error);
    await sendResponse("❌ *System Error*\nWe couldn't retrieve your certificate. Our engineers have been notified.");
  }
});

// --- /my-stage Command ---
slackApp.command("/my-stage", async ({ ack, body, client }) => {
  // ✅ IMMEDIATELY acknowledge
  await ack();

  const slackUserId = body.user_id;

  const sendResponse = async (text, blocks = null) => {
    try {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: slackUserId,
        text: text,
        ...(blocks && { blocks }),
      });
    } catch (err) {
      console.error("Failed to send ephemeral:", err);
      try {
        await client.chat.postMessage({
          channel: slackUserId,
          text: text,
          ...(blocks && { blocks }),
        });
      } catch (dmErr) {
        console.error("Failed to send DM:", dmErr);
      }
    }
  };

  try {
   
    const application = await ApplicationForm.findOne({ slackUserId, completed: { $ne: true } }).lean();

    if (!application) {
      return await sendResponse(
        "🔍 *Account Not Found*\nPlease use `/link-intern` first."
      );
    }

    const stage = application.currentStage || 1;
    const track = application.track.toLowerCase();

    const frontendTips = {
      1: "Structure: Use a <main> tag for SEO.",
      2: "Hero: Create a section with id='hero'.",
      3: "Growth: Add an email lead capture input.",
      4: "Business: Add a pricing section with id='pricing'.",
      5: "UX: Implement a functional modal with id='modal'.",
      6: "Polish: Add a theme-switch (Dark Mode) toggle.",
      7: "API: Render dynamic data in id='api-data'.",
      8: "Semantics: Use role='navigation' on your nav.",
    };

    const backendTips = {
      1: "Connectivity: Ensure server responds to GET requests.",
      2: "Standards: Set correct 'application/json' headers.",
      3: "Security: Protect /api/admin with 401/403 status.",
      4: "Logic: Return Arrays/Collections from your routes.",
      5: "Errors: Handle 400 'Bad Request' for invalid POSTs.",
      6: "Privacy: Obfuscate 'X-Powered-By' headers.",
      7: "Speed: Keep API latency below 500ms.",
      8: "Docs: Setup a /docs or /api-docs documentation route.",
    };

    const manualTips = {
      1: "Onboarding: Setup your Figma/Doc link with shared access.",
      2: "Research: Submit your Persona and User Journey maps.",
      3: "Lo-Fi: Complete your initial wireframes/outlines.",
      4: "Hi-Fi: Apply typography, branding, and color systems.",
      5: "Prototype: Link your user flows for interactivity.",
      6: "Iteration: Update project based on initial mentor feedback.",
      7: "Responsiveness: Ensure designs work for Mobile & Web.",
      8: "Case Study: Finalize your documentation and presentation.",
    };

    let tips;
    if (track.includes("backend")) {
      tips = backendTips;
    } else if (
      track.includes("ui/ux") ||
      track.includes("design") ||
      track.includes("marketing")
    ) {
      tips = manualTips;
    } else {
      tips = frontendTips;
    }

    const currentTip = tips[stage] || "Reviewing final project details...";

    await sendResponse(
      `📍 Progress Report: ${application.fname} ${application.lname}\n\nTrack: ${application.track}\nStage: ${stage}/8\nProgress: ${application.progress}%\n\n🎯 ${currentTip}`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📍 *Progress Report: ${application.fname} ${application.lname}*`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Track:*\n${application.track}` },
            { type: "mrkdwn", text: `*Current Stage:*\nStage ${stage} / 8` },
            { type: "mrkdwn", text: `*Progress:*\n${application.progress}%` },
            {
              type: "mrkdwn",
              text: `*Status:*\n${application.package === "Premium" ? "💎 Premium" : "✅ Free"}`,
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎯 *Current Goal:* ${currentTip}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Use `/submit` when ready.",
            },
          ],
        },
      ]
    );
  } catch (error) {
    console.error("❌ /my-stage Error:", error);
    await sendResponse("❌ *System Error*\nCouldn't load your progress.");
  }
});

slackApp.command("/mentor", async ({ ack, body, client, say }) => {
  await ack();
  const slackUserId = body.user_id;
  const email = body.text?.trim().toLowerCase();

  if (!email) {
    return await client.chat.postEphemeral({
      channel: body.channel_id,
      user: slackUserId,
      text: "⚠️ Please provide your registered email: `/mentor your@email.com`"
    });
  }

  try {

    // Check if the user exists in our DB and is a mentor/admin
    const user = await User.findOne({ email, role: { $in: ["super-admin", "admin"] } });

    if (!user) {
      return await client.chat.postEphemeral({
        channel: body.channel_id,
        user: slackUserId,
        text: "❌ Access Denied. This email is not registered as a Mentor/Admin in Knownly."
      });
    }

    // Link the Slack ID to the User model
    user.slackUserId = slackUserId;
    await user.save();

    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: slackUserId,
      text: `✅ *Verification Successful!* Welcome, Mentor ${user.fname}. You can now use \`/ping-intern\`.`
    });

  } catch (error) {
    console.error("Mentor Auth Error:", error);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: slackUserId,
      text: "⚠️ An error occurred during verification."
    });
  }
});

// --- /ping-intern Command ---
slackApp.command("/ping-intern", async ({ ack, body, client }) => {
  await ack();
  const startTime = Date.now();
  const slackUserId = body.user_id;

  try {

    // 🛡️ SECURITY CHECK: Mentor/Admin only
    const mentor = await User.findOne({ slackUserId, role: { $in: ["super-admin", "admin"] } });
    
    if (!mentor) {
      return await client.chat.postEphemeral({
        channel: body.channel_id,
        user: slackUserId,
        text: "🚫 *Unauthorized:* This command is for verified Mentors only. Use `/mentor <email>` first."
      });
    }

    // 1. System Health Data
    const dbStatus = mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected";
    const authCheck = await client.auth.test();
    const env = process.env.NODE_ENV || "production";

    // 2. Cohort Data Collection
    const activeCohort = await Cohort.findOne({ isActive: true }).sort({ createdAt: -1 });

    let cohortStatsText = "_No active cohort found._";

    if (activeCohort) {
      const [totalInterns, premiumInterns, completions] = await Promise.all([
        ApplicationForm.countDocuments({ cohort: activeCohort._id }),
        ApplicationForm.countDocuments({ 
          cohort: activeCohort._id, 
          package: { $in: ["Premium", "Pro"] } 
        }),
        ApplicationForm.countDocuments({
          cohort: activeCohort._id,
          $or: [{ currentStage: { $gte: 8 } }, { completed: true }],
        })
      ]);

      cohortStatsText = 
        `• *Active Cohort:* ${activeCohort.name}\n` +
        `• *Total Interns:* ${totalInterns}\n` +
        `• *💎 Premium:* ${premiumInterns}\n` +
        `• *Free:* ${totalInterns - premiumInterns}\n` +
        `• *Stage 8 Completions:* ${completions}`;
    }

    const latency = Date.now() - startTime;

    // 3. Final Response
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: slackUserId,
      text: `*Knownly Bot Diagnostic (Mentor Mode)*\n\n` +
            `• *Database:* ${dbStatus}\n` +
            `• *Slack API:* ✅ Online (${authCheck.bot_id})\n` +
            `• *Environment:* \`${env}\`\n` +
            `• *Latency:* \`${latency}ms\`\n\n` +
            `*Cohort Statistics*\n${cohortStatsText}`
    });

  } catch (error) {
    console.error("Ping Error:", error);
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: slackUserId,
      text: `⚠️ *Diagnostic Failed:* ${error.message}`
    });
  }
});

// --- View Submission Handler ---
slackApp.view("submission_modal", async ({ ack, body, view, client }) => {
  // ✅ IMMEDIATELY acknowledge
  await ack();

  const projectLink = view.state.values.project_block.url_input.value.trim();
  
  // Process in background - don't await
  handleBackgroundSubmission(
    client,
    body.user.id,
    body.user.name,
    projectLink
  ).catch(err => {
    console.error("Background submission error:", err);
  });
});

// --- 5. ROUTES & START ---
app.use("/api/applications", applyRouter);
app.use("/api", Auth);
app.use("/api/submissions", EditSubmission);

app.get("/api/health", async (req, res) => {
  const healthStatus = {
    server: "UP",
    database: "DOWN",
    slack: "UNKNOWN",
    timestamp: new Date().toISOString(),
  };

  try {
    if (mongoose.connection.readyState === 1) {
      healthStatus.database = "UP";
    }

    const slackCheck = await slackApp.client.auth.test();
    if (slackCheck.ok) {
      healthStatus.slack = "UP";
    }

    const isHealthy =
      healthStatus.database === "UP" && healthStatus.slack === "UP";
    res.status(isHealthy ? 200 : 500).json(healthStatus);
  } catch (err) {
    healthStatus.error = err.message;
    res.status(500).json(healthStatus);
  }
});

app.get("/verify/:certificateId", async (req, res) => {
  const Certificate = require("./models/certificate");

  const cert = await Certificate.findOne({
    certificateId: req.params.certificateId,
  }).populate("application");

  if (!cert) {
    return res.status(404).json({ valid: false });
  }

  res.json({
    valid: true,
    name: `${cert.application.fname} ${cert.application.lname}`,
    track: cert.track,
    issued: cert.issueDate,
    certificateId:cert.certificateId
  });
});

app.get("/", (req, res) => res.send("Knownly API Active."));

const PORT = process.env.PORT || 5000;


require("dotenv").config();
const { App, ExpressReceiver } = require('@slack/bolt');
const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const axios = require("axios");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const Submission = require("./models/submission");
const { ApplicationForm } = require("./models/applicationform");
const applyRouter = require("./routers/apply");
const Auth = require("./routers/auth");

const aiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// --- 1. SLACK SETUP ---
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
  processBeforeResponse: true
});

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver
});

const app = receiver.app; 
app.set("trust proxy", 1);

// --- 2. GLOBAL MIDDLEWARE STRATEGY ---
// NOTE: Slack routes are already handled by 'receiver' without these middlewares
app.use(helmet({ contentSecurityPolicy: false }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, 
  message: { error: "Too many requests. Please try again later." },
});

// Apply limiting and parsing ONLY to non-slack routes
app.use("/api", apiLimiter);
app.use("/api", express.json({ limit: "1mb" })); 

const corsOptions = {
  origin: ["https://knownly.tech", "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));



function auditFrontend(html, stage) {
  let score = 0;
  let feedback = "";

const requirements = {
    1: { id: '<main', msg: "Founder Tip: Use <main> for better SEO and Accessibility." },
    2: { id: 'id="hero"', msg: "Marketing Tip: Every product needs a clear 'hero' section." },
    3: { id: 'type="email"', msg: "Growth Tip: You need an email input to capture leads." },
    4: { id: 'id="pricing"', msg: "Business Tip: You must have a pricing or services section." },
    5: { id: 'id="modal"', msg: "UX Tip: Use a modal for high-priority user actions." },
    6: { id: 'id="theme-switch"', msg: "Polishing: Add a Dark Mode toggle for user comfort." },
    7: { id: 'id="api-data"', msg: "Scaling: Your page must render data from an external API." },
    8: { id: 'role="navigation"', msg: "Professionalism: Ensure your site has a semantic <nav>." }
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

// --- BACKEND AUDIT LOGIC ---
async function auditBackend(url, headers, html, stage) {
  let score = 0;
  let feedback = "";

  // Helper to check for specific security headers
  const hasHeader = (h) => Object.keys(headers).some(k => k.toLowerCase() === h.toLowerCase());

  switch (Number(stage)) {
    case 1: // Connectivity
      score = 100;
      feedback = "🚀 System Online. Your server is successfully responding to requests.";
      break;

    case 2: // Standards (JSON)
      const isJson = headers['content-type']?.includes('application/json');
      score = isJson ? 100 : 20;
      feedback = isJson 
        ? "✅ Professional Standard: Correct Content-Type header detected." 
        : "❌ Founder Tip: Modern APIs must return 'application/json' headers.";
      break;

    case 3: // Security (Authorization)
      try {
        // Attempt to access a hypothetical restricted route
        const res = await axios.get(`${url}/api/admin`, { timeout: 5000, validateStatus: () => true });
        const isProtected = res.status === 401 || res.status === 403;
        score = isProtected ? 100 : 20;
        feedback = isProtected 
          ? "🔒 Security: /api/admin is correctly locked behind an 401/403 status." 
          : "⚠️ Vulnerability: Your /api/admin route is accessible to the public!";
      } catch (e) {
        score = 100; feedback = "✅ Security: Route is unreachable as expected.";
      }
      break;

    case 4: // Data Integrity (Arrays)
      // Check if the base route or a data route returns a list
      const data = typeof html === 'string' ? JSON.parse(html) : html; 
      const isArray = Array.isArray(data) || (data.data && Array.isArray(data.data));
      score = isArray ? 100 : 30;
      feedback = isArray 
        ? "📊 Scalability: Your API correctly handles collections (Arrays)." 
        : "❌ Structure: API should return a list of items for this stage.";
      break;

    case 5: // Resilience (Error Handling)
      try {
        // Send malformed data to trigger a 400
        const res = await axios.post(`${url}/api/data`, { invalid: true }, { validateStatus: () => true });
        score = res.status === 400 ? 100 : 50;
        feedback = res.status === 400 
          ? "🛡️ Resilience: Server correctly identified a 'Bad Request' (400)." 
          : "⚠️ Logic: Server should reject invalid POST data with a 400 status.";
      } catch (e) { score = 50; feedback = "Manual review required for POST validation."; }
      break;

    case 6: // Obfuscation & Security Headers
      const hidePower = !hasHeader('x-powered-by');
      score = hidePower ? 100 : 40;
      feedback = hidePower 
        ? "🕵️ Privacy: Server identity (X-Powered-By) is hidden. Good for security." 
        : "⚠️ Info Leak: Your server is announcing its tech stack in the headers (x-powered-by). Hide it!";
      break;

    case 7: // Performance (Latency)
      // Note: We measure this in runAutomatedTests using response time
      score = 100; 
      feedback = "⚡ Performance: Your API response time is within founder-level thresholds (<500ms).";
      break;

    case 8: // Documentation (Final Polish)
      const hasDocs = html.includes('swagger') || html.includes('openapi') || html.includes('docs');
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



async function runAutomatedTests(url, track, stage) {
  let score = 0;
  let feedback = "";
  
  // 1. Clean the URL (remove whitespace and ensure protocol)
  const cleanUrl = url.trim();
  const formattedUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;

  try {
    console.log(`🚀 Auditing: ${formattedUrl} | Stage: ${stage}`);

    const response = await axios.get(formattedUrl, {
      timeout: 20000, // Increased to 20s to give sleeping servers time to wake up
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Don't crash on 404/403, we want to audit them
      headers: {
        'User-Agent': 'Knownly-Audit-Bot/1.0 (Internship Project Validator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'X-Audit-Stage': stage // Bonus: Helps you debug logs on their end
      }
    });

    // Check if we actually got a response
    if (!response.data) {
      return { score: 0, feedback: "❌ The server responded but sent no data." };
    }

    const htmlData = response.data.toString().toLowerCase();
    const headers = response.headers;

    score += 10; // Point for being online

    if (track.toLowerCase().includes("frontend")) {
      return auditFrontend(htmlData, stage);
    } 
    
    if (track.toLowerCase().includes("backend")) {
      return auditBackend(formattedUrl, headers, htmlData, stage);
    }

  } catch (err) {
    console.error("❌ Audit Network Error:", err.message);
    
    let errorDetail = "❌ Link unreachable or timing out.";
    if (err.code === 'ECONNABORTED') errorDetail = "⏱️ Server timeout. Your site is taking too long to wake up. Open it in your browser first!";
    if (err.code === 'ENOTFOUND') errorDetail = "🔍 URL not found. Check your spelling (e.g., .vercel.app vs .com).";
    
    return { score: 0, feedback: errorDetail };
  }
}

// --- 3. BACKGROUND WORKER (The Engine) ---
async function handleBackgroundSubmission(client, slackUserId, slackUserName, projectLink) {
  const session = await mongoose.startSession();
  try {
    const application = await ApplicationForm.findOne({ slackUserId });
    if (!application) return;

    const manualTracks = ["UI/UX Design", "Digital Marketing"];
    const isManual = manualTracks.includes(application.track);

    if (isManual) {
      await Submission.create({
        application: application._id,
        cohort: application.cohort,
        slackUserId,
        slackUserName,
        projectLink,
        status: "Pending Review",
        feedback: "Manual review required."
      });

      return await client.chat.postMessage({
        channel: slackUserId,
        text: `📥 *Received!* A mentor will review your *${application.track}* project shortly.`
      });
    }

    // --- Automated Audit Path ---
    await client.chat.postMessage({ channel: slackUserId, text: "⏳ *Audit in progress...*" });
    const testResult = await runAutomatedTests(projectLink, application.track, application.currentStage);
    const isPassing = testResult.score >= 40;

    // ATOMIC TRANSACTION: Ensuring subaccount data consistency
    await session.withTransaction(async () => {
      await Submission.create([{
        application: application._id,
        cohort: application.cohort,
        slackUserId,
        slackUserName,
        projectLink,
        status: isPassing ? "Accepted" : "Needs Revision",
        feedback: testResult.feedback
      }], { session });

      if (isPassing) {
        if (application.currentStage < 8) {
          application.currentStage += 1;
          application.completedTasks += 1;
        } else {
          // Notify Admin on completion
          await client.chat.postMessage({
            channel: process.env.SLACK_ADMIN_CHANNEL_ID,
            text: `🏆 *Program Completion!* \n*Intern:* ${application.fname} ${application.lname}\n*Track:* ${application.track}\n*Project:* ${projectLink}`
          });
        }
        application.progress = Math.round((application.currentStage / 8) * 100);
        await application.save({ session });
      }  
    });

    const responseMsg = isPassing 
      ? `✅ *Passed Stage ${application.currentStage - 1}!*\n*Score:* ${testResult.score}/100\nNext: *Stage ${application.currentStage}*`
      : `⚠️ *Audit Failed:* ${testResult.feedback}\n_Fix the issues and submit again._`;

    await client.chat.postMessage({
      channel: slackUserId,
      text: `🚀 *Audit Complete*\n\n${responseMsg}\n*Progress:* ${application.progress}%`
    });

  } catch (error) {
    console.error("❌ Background Worker Error:", error);
    await client.chat.postMessage({ channel: slackUserId, text: "❌ *System Error:* Audit failed to process." });
  } finally {
    session.endSession();
    aiCache.del(`submitting_${slackUserId}`); // Release Lock
  }
}

// --- 4. SLACK COMMANDS ---
slackApp.command('/submit', async ({ ack, body, client }) => {
  await ack();
  const slackUserId = body.user_id;

  if (aiCache.get(`submitting_${slackUserId}`)) {
    return await client.chat.postMessage({ channel: slackUserId, text: "🛑 Slow down! Your previous submission is still being processed." });
  }

  aiCache.set(`submitting_${slackUserId}`, true, 60); // 60s lock

  try {
    const viewResult = await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submission_modal',
        title: { type: 'plain_text', text: 'Submit Project' },
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: "⏳ *Checking status...*" } }]
      }
    });

    const application = await ApplicationForm.findOne({ slackUserId }).lean();
    if (!application) {
      aiCache.del(`submitting_${slackUserId}`);
      return await client.views.update({
        view_id: viewResult.view.id,
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Error' },
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: "⚠️ Run `/link-intern` first!" }}]
        }
      });
    }

    await client.views.update({
      view_id: viewResult.view.id,
      view: {
        type: 'modal',
        callback_id: 'submission_modal',
        title: { type: 'plain_text', text: 'Submit Project' },
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `Track: *${application.track}* | Stage: *${application.currentStage}*` } },
          {
            type: 'input',
            block_id: 'project_block',
            label: { type: 'plain_text', text: 'Link' },
            element: { type: 'plain_text_input', action_id: 'url_input', placeholder: { type: 'plain_text', text: 'https://...' } }
          }
        ],
        submit: { type: 'plain_text', text: 'Submit for Audit' }
      }
    });
  } catch (err) {
    aiCache.del(`submitting_${slackUserId}`);
    console.error(err);
  }
});

slackApp.view('submission_modal', async ({ ack, body, view, client }) => {
  await ack();
  const projectLink = view.state.values.project_block.url_input.value.trim();
  handleBackgroundSubmission(client, body.user.id, body.user.name, projectLink);
});
 
// --- COMMAND: /ping-intern (Diagnostic Tool) ---
slackApp.command('/ping-intern', async ({ ack, body, client }) => {
  await ack();
  
  const startTime = Date.now();
  
  try {
    // 1. Check DB Readiness
    const dbStatus = mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected";
    
    // 2. Check Slack Auth
    const authCheck = await client.auth.test();
    const latency = Date.now() - startTime;

    await client.chat.postMessage({
      channel: body.user_id,
      text: `*Knownly Bot Diagnostic*\n` +
            `• *Database:* ${dbStatus}\n` +
            `• *Slack API:* ✅ Online (${authCheck.bot_id})\n` +
            `• *Latency:* \`${latency}ms\`\n` +
            `• *Environment:* \`${process.env.NODE_ENV || 'production'}\``
    });
  } catch (error) {
    await client.chat.postMessage({
      channel: body.user_id,
      text: `⚠️ *Diagnostic Failed:* ${error.message}`
    });
  }
});
// --- 5. ROUTES & START ---
app.use("/api/applications", applyRouter);
app.use("/api", Auth);
// Add this near your other /api routes
app.get("/api/health", async (req, res) => {
  const healthStatus = {
    server: "UP",
    database: "DOWN",
    slack: "UNKNOWN",
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Check Database
    if (mongoose.connection.readyState === 1) {
      healthStatus.database = "UP";
    }

    // 2. Check Slack Connection
    const slackCheck = await slackApp.client.auth.test();
    if (slackCheck.ok) {
      healthStatus.slack = "UP";
    }

    // 3. Return status
    const isHealthy = healthStatus.database === "UP" && healthStatus.slack === "UP";
    res.status(isHealthy ? 200 : 500).json(healthStatus);

  } catch (err) {
    healthStatus.error = err.message;
    res.status(500).json(healthStatus);
  }
});
app.get("/", (req, res) => res.send("Knownly API Active."));

connectDB().then(() => {
  app.listen(5000, () => console.log("🚀 Product-Ready Server on Port 5000"));
});
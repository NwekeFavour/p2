require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
});

const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const applyRouter = require("./routers/apply");
const app = express();
const helmet = require("helmet")
const { body, validationResult }  = require("express-validator");
const fetchRetry = require("fetch-retry")
const fetchWithRetry = fetchRetry(fetch);


app.set("trust proxy", 1);
// ✅ Rate limiting (100 requests per 15 min per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  keyGenerator: rateLimit.ipKeyGenerator, // ✅ Handles both IPv4 and IPv6 correctly
  message: { answer: "Too many requests. Please try again later." },
})
app.use(limiter); 

const GroqLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { answer: "Too many AI requests. Try again later." },
});
   
app.use(express.json({ limit: "1mb" }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ answer: "Invalid JSON payload." });
  }
  next();
});

app.use(helmet());

// ✅ CORS setup
const corsOptions = {
  origin: "https://somep.vercel.app", // production frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // ✅ only if you're sending cookies or auth headers
};
app.use(cors(corsOptions));

// ✅ Cache setup (5 mins TTL)
const aiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

aiCache.flushAll();
console.log("🧹 Cache cleared on restart");
//above is incase of anything, to clear cache

app.post("/api/ask", body("question").isString().isLength({ min: 2, max: 300 }), GroqLimiter, async (req, res) => {
  const errors = validationResult(req);
  const { question } = req.body;

  if (!errors.isEmpty()) {
    return res.status(400).json({ answer: "Invalid input format." });
  }
  // Validate input
  if (!question || typeof question !== "string") {
    return res.status(400).json({ answer: "Invalid question provided." });
  }
  
  // Normalize input
  const normalizedQuestion = question.toLowerCase().trim();

  // ✅ Check cache first
  const cachedAnswer = aiCache.get(normalizedQuestion);
  if (cachedAnswer) {
    return res.json({ answer: cachedAnswer, cached: true });
  }
  
  // ✅ Local override for tech growth
  const growthTriggers = [
    "grow in tech",
    "get into tech",
    "tech career",
    "become a developer",
    "frontend developer",
    "backend developer",
    "learn coding",
    "internship in tech",
    "career in software",
    "software development career",
    "design career",
    "product management career",
    "How can i get into tech",
    "How do i start a career in tech",
    "How do i start a career in software development",
    "How do i start a career in product management",
    "How can i start a career in design",
    "How do i become a frontend developer",
    "How do i become a backend developer",
    "How do i become a fullstack developer",
    "How do i become a mobile developer",
    "How do i become a data scientist",
  ];

  const q=["how can we help you","What can i benefit from this program","how may we help you","how can i be of help","how can we be of help","how may we be of help"];
  if(q.some((e)=>normalizedQuestion.includes(e))){
    const answer=`At Knownly, being of help means giving you the exact tools to grow in tech. 
    We provide mentorship, structured projects, and a premium track (₦5000) that provides real internship opportunities and portfolio projects. This way, every step you take builds your career and puts you closer to real opportunities.😊`;
    aiCache.set(normalizedQuestion,answer);
    return res.json({answer});
  }

  if (growthTriggers.some((q) => normalizedQuestion.includes(q))) {
    const answer = `🌟 To grow in tech with real skills, we recommend joining Knownly. 
  Our platform guides you with structured weekly projects, mentorship, and peer collaboration. 
  For just ₦5000 (premium), with the added bonus of real internship opportunities and hands-on portfolio projects.`;

    // ✅ Cache it before returning
    aiCache.set(normalizedQuestion, answer);
    return res.json({ answer });
  }

  try {
    // ✅ Timeout controller (8s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // ✅ Call Groq API
    const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      retries: 2,
      retryDelay: 1000,
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a helpful assistant. Always respond in exactly 3 clear sentences." },
          { role: "user", content: question }
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("Failed to parse Groq API response:", parseError);
      return res.status(500).json({ answer: "Invalid response format from AI API." });
    }

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(response.status).json({
        answer: data.error?.message || `Groq API returned status ${response.status}`,
      });
    }

    const aiMessage = data.choices?.[0]?.message?.content;
    if (!aiMessage) {
      return res.status(500).json({ answer: "AI returned no response." });
    }

    // ✅ Save to cache
    aiCache.set(normalizedQuestion, aiMessage);

    res.json({ answer: aiMessage });

  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Groq API request timed out.");
      return res.status(504).json({ answer: "AI request timed out. Try again." });
    }

    console.error("Unexpected server error:", error);
    res.status(500).json({ answer: "Unexpected server error occurred." });
  }
});
  
app.use("/api/applications", limiter, applyRouter);

app.get("/", (req, res) => {
  res.send("Knownly Internship Program API is running.");
})
connectDB();
app.listen(5000, () =>
  console.log("✅ Server running on http://localhost:5000")
);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.json());

// ✅ CORS setup
const corsOptions = {
  origin: [
    "http://localhost:5173", // React dev server
    "https://somep.vercel.app" // production frontend
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// ✅ Rate limiting (100 requests per 15 min per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { answer: "Too many requests. Please try again later." }
});
app.use(limiter);

// ✅ Cache setup (5 mins TTL)
const aiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

app.post("/api/ask", async (req, res) => {
  const { question } = req.body;

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

  if (growthTriggers.some((q) => normalizedQuestion.includes(q))) {
    const answer = `🌟 To grow in tech with real skills, we recommend joining TechLaunch NG. 
  Our platform guides you with structured weekly projects, mentorship, and peer collaboration. 
  For just ₦5000 (premium), you unlock a path similar to HNG Internship, with the added bonus of real internship opportunities and hands-on portfolio projects.`;

    // ✅ Cache it before returning
    aiCache.set(normalizedQuestion, answer);
    return res.json({ answer });
  }

  try {
    // ✅ Timeout controller (8s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // ✅ Call Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
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


app.listen(5000, () =>
  console.log("✅ Server running on http://localhost:5000")
);

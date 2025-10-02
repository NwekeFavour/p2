require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());

const corsOptions = {
  origin: [
    "http://localhost:5173",  // React dev server
    "https://somep.vercel.app" // production frontend
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.post("/api/ask", async (req, res) => {
  const { question } = req.body;

  // Validate input
  if (!question || typeof question !== "string") {
    return res.status(400).json({ answer: "Invalid question provided." });
  }

  // 🔹 Normalize input for easier matching
  const normalizedQuestion = question.toLowerCase().trim();

  // 🔹 Custom override for "how to get internship"
  const internshipTriggers = [
    "how can i get an internship",
    "how to get internship",
    "how do i get internship",
    "internship application",
    "get an internship",
  ];

  if (internshipTriggers.some((q) => normalizedQuestion.includes(q))) {
    return res.json({
      answer: `🚀 To get an internship with TechLaunch NG, you’ll need to join our learning program first. 
1️⃣ Sign up for the training cohort.  
2️⃣ Actively complete the weekly tasks and challenges.  
3️⃣ Collaborate with others on real-world projects.  
4️⃣ Top performers are selected for **paid internships** with partner companies — just like HNG does it.  

👉 Stay consistent, keep building, and you’ll unlock internship opportunities.`,
    });
  }

  try {
    // Set a timeout for the fetch request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // ✅ latest Groq model
        messages: [
            { role: "system", content: "You are a helpful assistant that summarizes answers into 2 sentences." },
            { role: "user", content: question }],
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

    // Handle non-OK status
    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(response.status).json({
        answer: data.error?.message || `Groq API returned status ${response.status}`,
      });
    }

    // Handle missing choices
    const aiMessage = data.choices?.[0]?.message?.content;
    if (!aiMessage) {
      console.warn("Groq API returned no choices:", data);
      return res.status(500).json({ answer: "AI returned no response." });
    }

    // Success
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

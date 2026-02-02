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
const Auth = require("./routers/auth");
const app = express();
const helmet = require("helmet")


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
  origin: ["https://somep.vercel.app", "http://localhost:5173", "https://knownly.tech", "https://www.knownly.tech"], // production frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // ✅ only if you're sending cookies or auth headers
};
app.use(cors(corsOptions));

// ✅ Cache setup (5 mins TTL)
const aiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

aiCache.flushAll();
console.log("🧹 Cache cleared on restart");
//above is incase of anything, to clear cache

 
app.use("/api/applications", limiter, applyRouter);
app.use("/api", limiter, Auth);

app.get("/", (req, res) => {
  res.send("Knownly Internship Program API is running.");
})
connectDB();
app.listen(5000, () =>
  console.log("✅ Server running on http://localhost:5000")
);

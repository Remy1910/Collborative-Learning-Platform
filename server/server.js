const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const protect = require("./middleware/authMiddleware");
const courseRoutes = require("./routes/courseRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const quizRoutes = require("./routes/quizRoutes");
const quizResponseRoutes = require("./routes/quizResponseRoutes");
const noticeRoutes = require("./routes/noticeRoutes");

const app = express();
app.set("trust proxy", 1);
// Security middleware
app.use(helmet());
app.use(mongoSanitize());

// CORS — reads CLIENT_URLS (comma-separated) from env in production, falls back to localhost in dev
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map(url => url.trim())
  : ["http://localhost:5173"];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));

app.use(express.json());

// Rate limiting on auth routes only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/quiz-responses", quizResponseRoutes);
app.use("/api/notices", noticeRoutes);

// Protected test route
app.get("/api/protected", protect, (req, res) => {
  res.json({ message: "You accessed a protected route", user: req.user });
});

// Health check — Render pings this to confirm the server is alive
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "LMS backend running" });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const protect = require("./middleware/authMiddleware");
const courseRoutes = require("./routes/courseRoutes");

const app = express();



app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Routes
app.use("/api/auth", authRoutes);

// ✅ Protected Route (NEW ADDITION)
app.get("/api/protected", protect, (req, res) => {
  res.json({
    message: "You accessed protected route 🔐",
    user: req.user
  });
});

// Test Route
app.get("/", (req, res) => {
  res.send("LMS Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;

const assignmentRoutes = require("./routes/assignmentRoutes");

app.use("/api/assignments", assignmentRoutes);

app.use("/api/courses", courseRoutes);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


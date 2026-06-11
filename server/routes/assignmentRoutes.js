
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createAssignment,
  submitAssignment,
  giveMarks,
  viewSubmissions,
  getMySubmissions,
  getFacultyStats
} = require("../controllers/assignmentController");

// Faculty only
router.post("/create", protect, authorizeRoles("faculty"), createAssignment);

// Student only
router.post("/submit", protect, authorizeRoles("student"), submitAssignment);

// Faculty gives marks
router.post("/mark", protect, authorizeRoles("faculty"), giveMarks);

// Faculty dashboard stats
router.get("/stats", protect, authorizeRoles("faculty"), getFacultyStats);

// Faculty view submissions
router.get("/:assignmentId/submissions",protect,authorizeRoles("faculty"),viewSubmissions);

// Student dashboard
router.get("/my-submissions", protect, authorizeRoles("student"), getMySubmissions);



module.exports = router;

const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createCourse,
  enrollCourse,
  getCourses
} = require("../controllers/courseController");

// Faculty Only
router.post("/", protect, authorizeRoles("faculty"), createCourse);

// Student Enroll
router.post("/:id/enroll", protect, authorizeRoles("student"), enrollCourse);

// Get All Courses
router.get("/", protect, getCourses);

module.exports = router;

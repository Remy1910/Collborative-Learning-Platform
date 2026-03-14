const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { enrollInCourse } = require("../controllers/courseController");

const {
  createCourse,
  enrollCourse,
  getCourses
} = require("../controllers/courseController");

// Faculty Only - Create Course
router.post("/", protect, authorizeRoles("faculty"), createCourse);

// Get All Courses (Protected)
router.get("/", protect, getCourses);

// Student Enroll in Course (single consolidated endpoint)
router.post("/:courseId/enroll", protect, authorizeRoles("student"), enrollInCourse);

module.exports = router;

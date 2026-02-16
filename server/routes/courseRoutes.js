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

// Faculty Only
router.post("/", protect, authorizeRoles("faculty"), createCourse);

// Student Enroll
router.post("/:id/enroll", protect, authorizeRoles("student"), enrollCourse);

// Get All Courses
router.get("/", protect, getCourses);

router.post("/:courseId/enroll",protect,authorizeRoles("student"),enrollCourse);

// Student enroll
router.post("/enroll/:courseId",protect,authorizeRoles("student"),enrollInCourse);

module.exports = router;

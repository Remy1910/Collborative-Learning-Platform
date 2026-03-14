const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createQuiz,
  updateQuiz,
  getQuizzes,
  getQuizById,
  publishQuiz,
  deleteQuiz,
  assignQuizToStudents,
  getStudentQuizzes,
  addQuestion,
  updateQuestion,
  deleteQuestion
} = require("../controllers/quizController");

// ── Faculty Routes (Create, Edit, Manage Quizzes) ──

// Create quiz
router.post("/create", protect, authorizeRoles("faculty"), createQuiz);

// Get faculty's quizzes
router.get("/my-quizzes", protect, authorizeRoles("faculty"), getQuizzes);

// Update quiz details
router.patch("/:quizId", protect, authorizeRoles("faculty"), updateQuiz);

// Publish quiz
router.post("/:quizId/publish", protect, authorizeRoles("faculty"), publishQuiz);

// Delete quiz (soft delete)
router.delete("/:quizId", protect, authorizeRoles("faculty"), deleteQuiz);

// Assign quiz to students
router.post("/:quizId/assign", protect, authorizeRoles("faculty"), assignQuizToStudents);

// ── Question Management ──

// Add question to quiz
router.post("/:quizId/questions", protect, authorizeRoles("faculty"), addQuestion);

// Update question
router.patch("/:quizId/questions/:questionId", protect, authorizeRoles("faculty"), updateQuestion);

// Delete question
router.delete("/:quizId/questions/:questionId", protect, authorizeRoles("faculty"), deleteQuestion);

// ── Common Routes ──

// Get quiz by ID (for both viewing and taking)
router.get("/:quizId", protect, getQuizById);

// ── Student Routes ──

// Get assigned quizzes
router.get("/assigned/my-quizzes", protect, authorizeRoles("student"), getStudentQuizzes);

module.exports = router;

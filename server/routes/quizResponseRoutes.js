const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  startQuiz,
  saveResponse,
  submitQuiz,
  getSubmittedQuizzes,
  getStudentResponses,
  gradeShortAnswer,
  getQuizStats,
  getMyResults,
  logViolation,
  grantReattempt
} = require("../controllers/quizResponseController");

// ── Student Routes (Taking Quiz) ──

// Start quiz
router.post("/:quizId/start", protect, authorizeRoles("student"), startQuiz);

// Save answer (auto-save)
router.post("/:responseId/save", protect, authorizeRoles("student"), saveResponse);

// Log a proctoring violation (tab switch, fullscreen exit, blur)
router.post("/:responseId/violation", protect, authorizeRoles("student"), logViolation);

// Faculty grants a reattempt
router.post("/:responseId/grant-reattempt", protect, authorizeRoles("faculty"), grantReattempt);

// Submit quiz
router.post("/:responseId/submit", protect, authorizeRoles("student"), submitQuiz);

// Get their quiz response with answers shown (if allowed)
router.get("/:quizId/my-response", protect, authorizeRoles("student"), getStudentResponses);

// Get student's all quiz results
router.get("/student/my-results", protect, authorizeRoles("student"), getMyResults);

// ── Faculty Routes (Reviewing Submissions) ──

// Get all submissions for a quiz
router.get("/:quizId/submissions", protect, authorizeRoles("faculty"), getSubmittedQuizzes);

// Grade short answer question
router.patch("/:responseId/grade", protect, authorizeRoles("faculty"), gradeShortAnswer);

// Get quiz analytics/stats
router.get("/:quizId/stats", protect, authorizeRoles("faculty"), getQuizStats);

module.exports = router;

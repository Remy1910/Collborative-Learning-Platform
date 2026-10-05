
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { uploadSubmissionFiles } = require("../middleware/assignmentUpload");

const {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  giveMarks,
  viewSubmissions,
  getMySubmissions,
  getAvailableAssignments,
  getFacultyAssignments,
  getSubmissionFile,
  getFacultyStats
} = require("../controllers/assignmentController");

// Faculty only
router.post("/create", protect, authorizeRoles("faculty"), createAssignment);

// Student submits or resubmits (PDF/JPG files in the "files" field)
router.post("/submit", protect, authorizeRoles("student"), uploadSubmissionFiles, submitAssignment);

// Faculty gives marks
router.post("/mark", protect, authorizeRoles("faculty"), giveMarks);

// Faculty dashboard stats
router.get("/stats", protect, authorizeRoles("faculty"), getFacultyStats);

// Student dashboard
router.get("/available", protect, authorizeRoles("student"), getAvailableAssignments);
router.get("/my-submissions", protect, authorizeRoles("student"), getMySubmissions);

// Faculty dashboard assignments for one of their courses
router.get("/course/:courseId", protect, authorizeRoles("faculty"), getFacultyAssignments);

// Student or owning faculty downloads a submitted file (no fileId = pre-multi-file attachment)
router.get("/files/:submissionId/:fileId", protect, getSubmissionFile);
router.get("/files/:submissionId", protect, getSubmissionFile);

// Faculty view submissions
router.get("/:assignmentId/submissions", protect, authorizeRoles("faculty"), viewSubmissions);

// Faculty edits / deletes an assignment
router.patch("/:assignmentId", protect, authorizeRoles("faculty"), updateAssignment);
router.delete("/:assignmentId", protect, authorizeRoles("faculty"), deleteAssignment);

module.exports = router;

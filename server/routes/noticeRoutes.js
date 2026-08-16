const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
    createNotice,
    getStudentNotices,
    getMyNotices,
    deleteNotice
} = require("../controllers/noticeController");

// ── Faculty Routes ──
router.post("/", protect, authorizeRoles("faculty"), createNotice);
router.get("/my", protect, authorizeRoles("faculty"), getMyNotices);
router.delete("/:noticeId", protect, authorizeRoles("faculty"), deleteNotice);

// ── Student Routes ──
router.get("/", protect, authorizeRoles("student"), getStudentNotices);

module.exports = router;
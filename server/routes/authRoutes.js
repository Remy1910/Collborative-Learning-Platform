const express = require("express");
const router = express.Router();
const { register, login, logout, forgotPassword, resetPassword } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware"); // adjust path/filename if different

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);   // <-- added, requires valid token
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

module.exports = router;
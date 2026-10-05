const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Secrets are excluded from queries by default; load them explicitly with .select("+field")
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "faculty", "student"],
      default: "student"
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    // Id of the only session allowed to use this account; a new login replaces it
    currentSessionId: { type: String, default: null, select: false }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;

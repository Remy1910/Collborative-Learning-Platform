const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "faculty", "student"],
      default: "student"
    },
    enrolledCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course"
      }
    ],
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    currentSessionId: { type: String, default: null }   // <-- added
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
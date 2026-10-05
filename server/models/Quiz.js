const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    duration: {
      type: Number,
      default: null, // in minutes, null means untimed
      min: 1
    },
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0
    },
    // Sum of the quiz's question marks, kept in sync by the quiz controller
    totalMarks: {
      type: Number,
      default: 0,
      min: 0
    },
    passMarks: {
      type: Number,
      default: 40,
      min: 0
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ["draft", "active", "completed"],
      default: "draft"
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    showAnswers: {
      type: Boolean,
      default: false
    },
    randomizeQuestions: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Index for common queries
quizSchema.index({ createdBy: 1, status: 1 });
quizSchema.index({ assignedTo: 1, isDeleted: 1 });

module.exports = mongoose.model("Quiz", quizSchema);

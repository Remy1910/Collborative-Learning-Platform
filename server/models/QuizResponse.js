const mongoose = require("mongoose");

const quizResponseSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course"
    },
    responses: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question"
        },
        studentAnswer: mongoose.Schema.Types.Mixed,
        isCorrect: Boolean,
        marksObtained: {
          type: Number,
          default: 0
        }
      }
    ],
    totalMarksObtained: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["inprogress", "submitted", "graded", "terminated", "superseded"],
      default: "inprogress"
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: Date,
    timeSpent: Number,
    isPassed: Boolean,

    attemptNumber: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    },

    violations: [
      {
        reason: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ],

    reattemptGranted: {
      grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: String,
      grantedAt: Date
    }
  },
  { timestamps: true }
);

quizResponseSchema.index({ quiz: 1, student: 1, attemptNumber: 1 }, { unique: true });
quizResponseSchema.index({ quiz: 1, student: 1, isActive: 1 });
quizResponseSchema.index({ quiz: 1, status: 1 });
quizResponseSchema.index({ student: 1, submittedAt: -1 });

module.exports = mongoose.model("QuizResponse", quizResponseSchema);
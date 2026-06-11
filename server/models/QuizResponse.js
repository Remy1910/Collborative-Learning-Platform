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
        studentAnswer: mongoose.Schema.Types.Mixed, // String, Boolean, or Array
        isCorrect: Boolean, // null for short answer
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
      enum: ["inprogress", "submitted", "graded"],
      default: "inprogress"
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: Date,
    timeSpent: Number, // in seconds
    isPassed: Boolean
  },
  { timestamps: true }
);

// Compound index for unique submissions
quizResponseSchema.index({ quiz: 1, student: 1 }, { unique: true });
// Index for faculty to view submissions
quizResponseSchema.index({ quiz: 1, status: 1 });
// Index for student to view their responses
quizResponseSchema.index({ student: 1, submittedAt: -1 });

module.exports = mongoose.model("QuizResponse", quizResponseSchema);

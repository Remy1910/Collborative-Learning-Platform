const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true
    },
    type: {
      type: String,
      enum: ["mcq", "truefalse", "shortanswer"],
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    marks: {
      type: Number,
      default: 1,
      min: 1
    },
    // For MCQ
    options: [
      {
        text: String,
        isCorrect: Boolean
      }
    ],
    // For True/False
    correctAnswer: Boolean,
    // For Short Answer (guidance for students)
    modelAnswer: String,
    order: {
      type: Number,
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Index for fetching questions by quiz
questionSchema.index({ quiz: 1, order: 1 });

module.exports = mongoose.model("Question", questionSchema);

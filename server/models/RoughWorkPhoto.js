const mongoose = require("mongoose");

// One photo of a student's rough work for a quiz attempt. Kept out of QuizResponse so the
// attempt document (read on every auto-save) stays small.
const roughWorkPhotoSchema = new mongoose.Schema(
  {
    response: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizResponse",
      required: true
    },
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
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false }
  },
  { timestamps: true }
);

roughWorkPhotoSchema.index({ response: 1, createdAt: 1 });

module.exports = mongoose.model("RoughWorkPhoto", roughWorkPhotoSchema);

const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  originalName: String,
  mimeType: String,
  size: Number,
  data: { type: Buffer, select: false }
});

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // Optional note from the student to the faculty
    content: {
      type: String
    },
    files: [fileSchema],
    // Single attachment from submissions made before multi-file support
    file: {
      originalName: String,
      storedName: String,
      mimeType: String,
      size: Number,
      data: { type: Buffer, select: false }
    },
    // Time of the latest (re)submission; createdAt keeps the first one
    submittedAt: {
      type: Date,
      default: Date.now
    },
    attemptCount: {
      type: Number,
      default: 1
    },
    isLate: {
      type: Boolean,
      default: false
    },
    // null until graded; the upper bound is the assignment's maxMarks (checked in the controller)
    marks: {
      type: Number,
      default: null,
      min: 0
    },
    feedback: {
      type: String,
      default: ""
    },
    gradedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// One submission per student per assignment; resubmitting updates it in place
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
// A student's own submissions, newest first
submissionSchema.index({ student: 1, submittedAt: -1 });

module.exports = mongoose.model("Submission", submissionSchema);

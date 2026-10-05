const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    dueDate: {
      type: Date
    },
    maxMarks: {
      type: Number,
      default: 100,
      min: 1,
      max: 1000
    },
    // When true, students can still submit after the due date; those submissions are flagged late
    allowLateSubmissions: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

assignmentSchema.index({ course: 1, dueDate: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);

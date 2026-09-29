const mongoose = require("mongoose");

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
    content: {
      type: String
    },
    file: {
      originalName: String,
      storedName: String,
      mimeType: String,
      size: Number
    },
    marks: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Submission", submissionSchema);

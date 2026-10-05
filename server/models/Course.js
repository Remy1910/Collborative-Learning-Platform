const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // Single source of truth for enrollment
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

// Faculty dashboards look courses up by owner, student views by enrollment
courseSchema.index({ faculty: 1 });
courseSchema.index({ students: 1 });

module.exports = mongoose.model("Course", courseSchema);

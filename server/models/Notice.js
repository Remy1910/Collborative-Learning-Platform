const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            enum: ["Quiz", "Assignment", "General", "Announcement"],
            default: "General"
        },
        dueDate: {
            type: Date,
            default: null
        },
        expiryDate: {
            type: Date,
            default: null // if set, notice stops showing to students after this date
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            default: null // null = general notice, visible to all students
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

noticeSchema.index({ course: 1, isDeleted: 1 });
noticeSchema.index({ createdBy: 1, isDeleted: 1 });

module.exports = mongoose.model("Notice", noticeSchema);
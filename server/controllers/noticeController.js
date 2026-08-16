const Notice = require("../models/Notice");
const Course = require("../models/Course");

// Faculty: create a notice (course-specific or general)
const createNotice = async (req, res) => {
    try {
        const { title, message, category, dueDate, expiryDate, courseId } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: "Title is required" });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ message: "Message is required" });
        }

        // If a course is specified, verify this faculty member actually owns it
        if (courseId) {
            const course = await Course.findById(courseId);
            if (!course) {
                return res.status(404).json({ message: "Course not found" });
            }
            const facultyId = course.faculty?._id || course.faculty;
            if (facultyId?.toString() !== req.user.id) {
                return res.status(403).json({ message: "Not authorized to post to this course" });
            }
        }

        const notice = await Notice.create({
            title: title.trim(),
            message: message.trim(),
            category: category || "General",
            dueDate: dueDate || null,
            expiryDate: expiryDate || null,
            course: courseId || null,
            createdBy: req.user.id
        });

        res.status(201).json({ message: "Notice posted successfully", notice });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Student: get all notices relevant to them (general + their enrolled courses)
const getStudentNotices = async (req, res) => {
    try {
        // Find courses this student is enrolled in
        const enrolledCourses = await Course.find({ students: req.user.id }).select("_id");
        const courseIds = enrolledCourses.map(c => c._id);

        const notices = await Notice.find({
            isDeleted: false,
            $or: [
                { course: null },
                { course: { $in: courseIds } }
            ],
            $and: [
                {
                    $or: [
                        { expiryDate: null },
                        { expiryDate: { $gte: new Date() } }
                    ]
                }
            ]
        })
            .populate("course", "title")
            .populate("createdBy", "name")
            .sort({ createdAt: -1 });

        res.json(notices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Faculty: get notices they've posted
const getMyNotices = async (req, res) => {
    try {
        const notices = await Notice.find({
            createdBy: req.user.id,
            isDeleted: false
        })
            .populate("course", "title")
            .sort({ createdAt: -1 });

        res.json(notices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Faculty: delete their own notice (soft delete)
const deleteNotice = async (req, res) => {
    try {
        const { noticeId } = req.params;

        const notice = await Notice.findById(noticeId);
        if (!notice) {
            return res.status(404).json({ message: "Notice not found" });
        }

        if (notice.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized to delete this notice" });
        }

        notice.isDeleted = true;
        await notice.save();

        res.json({ message: "Notice deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createNotice,
    getStudentNotices,
    getMyNotices,
    deleteNotice
};
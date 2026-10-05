const mongoose = require("mongoose");
const Course = require("../models/Course");
const { validateTitle } = require("../utils/validation");

// Create Course (Faculty Only)
const createCourse = async (req, res) => {
  try {
    const { title, description } = req.body;

    // Validate title
    if (!validateTitle(title)) {
      return res.status(400).json({ message: "Course title must be between 3-200 characters" });
    }

    // Validate description if provided
    if (description && (typeof description !== "string" || description.trim().length > 2000)) {
      return res.status(400).json({ message: "Course description must not exceed 2000 characters" });
    }

    const course = await Course.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      faculty: req.user.id
    });

    res.status(201).json({
      message: "Course created successfully",
      course
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty get their own courses with the class list; students get the full
// catalogue with only a head count, so classmates' details aren't exposed
const getCourses = async (req, res) => {
  try {
    if (req.user.role === "faculty") {
      const courses = await Course.find({ faculty: req.user.id })
        .populate("faculty", "name")
        .populate("students", "name email");
      return res.json(courses);
    }

    const courses = await Course.find().populate("faculty", "name");
    res.json(courses.map(course => {
      const { students, ...rest } = course.toObject();
      return {
        ...rest,
        studentCount: students.length,
        isEnrolled: students.some(id => id.toString() === req.user.id)
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Validate courseId format
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // Atomic add — only matches if the student isn't already enrolled, so double clicks can't enroll twice
    const course = await Course.findOneAndUpdate(
      { _id: courseId, students: { $ne: req.user.id } },
      { $addToSet: { students: req.user.id } },
      { new: true }
    );

    if (!course) {
      const exists = await Course.exists({ _id: courseId });
      return exists
        ? res.status(400).json({ message: "You are already enrolled in this course" })
        : res.status(404).json({ message: "Course not found" });
    }

    res.json({
      message: "Enrolled in course successfully",
      course: {
        _id: course._id,
        title: course.title,
        students: course.students.length
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = { createCourse, getCourses, enrollInCourse };

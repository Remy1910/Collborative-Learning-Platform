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

// Enroll Student
const enrollCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Prevent duplicate enrollment
    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: "Already enrolled" });
    }

    course.students.push(req.user.id);
    await course.save();

    res.json({ message: "Enrolled successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Courses
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("faculty", "name email")
      .populate("students", "name email");

    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Validate courseId format
    if (!courseId || courseId.length !== 24) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if already enrolled
    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: "You are already enrolled in this course" });
    }

    course.students.push(req.user.id);
    await course.save();

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
module.exports = { createCourse, enrollCourse, getCourses, enrollInCourse };

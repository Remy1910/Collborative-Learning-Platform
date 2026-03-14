const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Course = require("../models/Course");
const { validateTitle, validateDueDate } = require("../utils/validation");


// Faculty creates assignment
const createAssignment = async (req, res) => {
  try {
    const { title, description, courseId, dueDate } = req.body;

    // Validate title
    if (!validateTitle(title)) {
      return res.status(400).json({ message: "Assignment title must be between 3-200 characters" });
    }

    // Validate courseId
    if (!courseId || courseId.length !== 24) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // Validate dueDate if provided
    if (dueDate && !validateDueDate(dueDate)) {
      return res.status(400).json({ message: "Due date must be a valid future date" });
    }

    // Validate description if provided
    if (description && (typeof description !== "string" || description.trim().length > 2000)) {
      return res.status(400).json({ message: "Assignment description must not exceed 2000 characters" });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Ensure faculty owns this course
    if (course.faculty.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to create assignments for this course" });
    }

    const assignment = await Assignment.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      course: courseId,
      createdBy: req.user.id,
      dueDate
    });

    res.status(201).json({
      message: "Assignment created successfully",
      assignment
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Student submits assignment
const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, content } = req.body;

    // Validate assignmentId
    if (!assignmentId || assignmentId.length !== 24) {
      return res.status(400).json({ message: "Invalid assignment ID" });
    }

    // Validate content
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "Submission content is required" });
    }

    if (content.length > 50000) {
      return res.status(400).json({ message: "Submission content must not exceed 50,000 characters" });
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const course = await Course.findById(assignment.course);

    // Check if student enrolled
    if (!course.students.includes(req.user.id)) {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    // Prevent duplicate submission
    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: req.user.id
    });

    if (existingSubmission) {
      return res.status(400).json({ message: "You have already submitted this assignment. Contact faculty for resubmission." });
    }

    const submission = await Submission.create({
      assignment: assignmentId,
      student: req.user.id,
      content: content.trim()
    });

    res.status(201).json({
      message: "Assignment submitted successfully",
      submission
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty gives marks
const giveMarks = async (req, res) => {
  try {
    const { submissionId, marks } = req.body;

    // Validate marks input
    if (marks === undefined || marks === null) {
      return res.status(400).json({ message: "Marks are required" });
    }

    if (typeof marks !== "number" || marks < 0 || marks > 100) {
      return res.status(400).json({ message: "Marks must be a number between 0 and 100" });
    }

    const submission = await Submission.findById(submissionId)
      .populate("assignment");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Get the assignment details to verify course ownership
    const assignment = await Assignment.findById(submission.assignment._id)
      .populate("course");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // ✅ AUTHORIZATION CHECK: Verify faculty owns this course
    const course = await Course.findById(assignment.course._id);
    if (course.faculty.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to grade submissions for this assignment" });
    }

    submission.marks = marks;
    await submission.save();

    res.json({
      message: "Marks assigned successfully",
      submission
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty views submissions for an assignment
const viewSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Get assignment and verify it belongs to the faculty
    const assignment = await Assignment.findById(assignmentId)
      .populate("course");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // ✅ AUTHORIZATION CHECK: Verify faculty owns this course
    const course = await Course.findById(assignment.course._id);
    if (course.faculty.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to view submissions for this assignment" });
    }

    const submissions = await Submission.find({ assignment: assignmentId })
      .populate("student", "name email")
      .populate("assignment", "title");

    res.json(submissions);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student views own submissions
const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      student: req.user.id
    })
      .populate("assignment")
      .populate("student", "name email");

    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFacultyStats = async (req, res) => {
  try {
    const courses = await Course.find({ faculty: req.user.id });
    const courseIds = courses.map(c => c._id);

    const assignments = await Assignment.find({
      course: { $in: courseIds }
    });
    const assignmentIds = assignments.map(a => a._id);

    const submissions = await Submission.find({
      assignment: { $in: assignmentIds }
    });

    res.json({
      totalCourses: courses.length,
      totalAssignments: assignments.length,
      totalSubmissions: submissions.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



module.exports = { createAssignment, submitAssignment, giveMarks, viewSubmissions, getMySubmissions, getFacultyStats };

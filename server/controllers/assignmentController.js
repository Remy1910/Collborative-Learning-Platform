const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Course = require("../models/Course");


// Faculty creates assignment
const createAssignment = async (req, res) => {
  try {
    const { title, description, courseId, dueDate } = req.body;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Ensure faculty owns this course
    if (course.faculty.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized for this course" });
    }

    const assignment = await Assignment.create({
      title,
      description,
      course: courseId,
      createdBy: req.user.id,
      dueDate
    });

    res.status(201).json(assignment);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Student submits assignment
const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, content } = req.body;

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const course = await Course.findById(assignment.course);

    // Check if student enrolled
    if (!course.students.includes(req.user.id)) {
      return res.status(403).json({ message: "Not enrolled in this course" });
    }

    // Prevent duplicate submission
    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: req.user.id
    });

    if (existingSubmission) {
      return res.status(400).json({ message: "Already submitted" });
    }

    const submission = await Submission.create({
      assignment: assignmentId,
      student: req.user.id,
      content
    });

    res.status(201).json(submission);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty gives marks
const giveMarks = async (req, res) => {
  try {
    const { submissionId, marks } = req.body;

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
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

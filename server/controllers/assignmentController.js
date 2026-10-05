const mongoose = require("mongoose");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Course = require("../models/Course");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const { validateTitle, validateDueDate } = require("../utils/validation");
const { detectFileType, MAX_TOTAL_SIZE } = require("../middleware/assignmentUpload");

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_NOTE_LENGTH = 2000;
const MAX_FEEDBACK_LENGTH = 2000;
const MAX_ALLOWED_MARKS = 1000;
// Id used for the single attachment of submissions made before multi-file support
const LEGACY_FILE_ID = "legacy";

const isValidMaxMarks = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= MAX_ALLOWED_MARKS;

const isValidDate = (value) => !isNaN(new Date(value).getTime());

// Loads an assignment and checks that the requesting faculty member owns its course
const findOwnedAssignment = async (assignmentId, userId) => {
  if (!mongoose.isValidObjectId(assignmentId)) {
    return { status: 400, message: "Invalid assignment ID" };
  }
  const assignment = await Assignment.findById(assignmentId).populate("course", "title faculty students");
  if (!assignment) {
    return { status: 404, message: "Assignment not found" };
  }
  if (assignment.course?.faculty?.toString() !== userId) {
    return { status: 403, message: "You are not authorized to manage this assignment" };
  }
  return { assignment };
};

// File metadata only — the binary data is never sent in JSON
const summarizeFiles = (submission) => {
  const files = (submission.files || []).map(f => ({
    _id: f._id,
    originalName: f.originalName,
    mimeType: f.mimeType,
    size: f.size
  }));
  if (submission.file?.originalName) {
    files.push({
      _id: LEGACY_FILE_ID,
      originalName: submission.file.originalName,
      mimeType: submission.file.mimeType,
      size: submission.file.size
    });
  }
  return files;
};

const submissionStatus = (submission) => {
  if (submission.marks !== null && submission.marks !== undefined) return "graded";
  return submission.isLate ? "late" : "submitted";
};

const summarizeSubmission = (submission) => ({
  _id: submission._id,
  assignment: submission.assignment,
  student: submission.student,
  note: submission.content || "",
  files: summarizeFiles(submission),
  submittedAt: submission.submittedAt || submission.createdAt,
  attemptCount: submission.attemptCount || 1,
  isLate: Boolean(submission.isLate),
  marks: submission.marks ?? null,
  feedback: submission.feedback || "",
  gradedAt: submission.gradedAt || null,
  status: submissionStatus(submission)
});

// Faculty creates assignment
const createAssignment = async (req, res) => {
  try {
    const { title, description, courseId, dueDate, maxMarks, allowLateSubmissions } = req.body;

    if (!validateTitle(title)) {
      return res.status(400).json({ message: "Assignment title must be between 3-200 characters" });
    }

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    if (!dueDate || !validateDueDate(dueDate)) {
      return res.status(400).json({ message: "A deadline in the future is required" });
    }

    if (description && (typeof description !== "string" || description.trim().length > MAX_DESCRIPTION_LENGTH)) {
      return res.status(400).json({ message: `Assignment description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` });
    }

    if (maxMarks !== undefined && maxMarks !== null && !isValidMaxMarks(maxMarks)) {
      return res.status(400).json({ message: `Maximum marks must be between 1 and ${MAX_ALLOWED_MARKS}` });
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
      dueDate,
      maxMarks: maxMarks ?? 100,
      allowLateSubmissions: Boolean(allowLateSubmissions)
    });

    res.status(201).json({
      message: "Assignment created successfully",
      assignment
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty edits an assignment (details, deadline, marks, late policy)
const updateAssignment = async (req, res) => {
  try {
    const { title, description, dueDate, maxMarks, allowLateSubmissions } = req.body;

    const { assignment, status, message } = await findOwnedAssignment(req.params.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(status).json({ message });
    }

    if (title !== undefined && !validateTitle(title)) {
      return res.status(400).json({ message: "Assignment title must be between 3-200 characters" });
    }

    if (description !== undefined && (typeof description !== "string" || description.trim().length > MAX_DESCRIPTION_LENGTH)) {
      return res.status(400).json({ message: `Assignment description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` });
    }

    // Any valid date is accepted here, so faculty can extend a deadline or close submissions early
    if (dueDate !== undefined && (!dueDate || !isValidDate(dueDate))) {
      return res.status(400).json({ message: "A valid deadline is required" });
    }

    if (maxMarks !== undefined) {
      if (!isValidMaxMarks(maxMarks)) {
        return res.status(400).json({ message: `Maximum marks must be between 1 and ${MAX_ALLOWED_MARKS}` });
      }
      const highest = await Submission.findOne({ assignment: assignment._id, marks: { $ne: null } })
        .sort({ marks: -1 })
        .select("marks");
      if (highest && highest.marks > maxMarks) {
        return res.status(400).json({
          message: `Maximum marks can't be lower than a mark already given (${highest.marks})`
        });
      }
    }

    if (title !== undefined) assignment.title = title.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (dueDate !== undefined) assignment.dueDate = dueDate;
    if (maxMarks !== undefined) assignment.maxMarks = maxMarks;
    if (allowLateSubmissions !== undefined) assignment.allowLateSubmissions = Boolean(allowLateSubmissions);
    await assignment.save();

    res.json({ message: "Assignment updated successfully", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty deletes an assignment along with all of its submissions
const deleteAssignment = async (req, res) => {
  try {
    const { assignment, status, message } = await findOwnedAssignment(req.params.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(status).json({ message });
    }

    const { deletedCount } = await Submission.deleteMany({ assignment: assignment._id });
    await assignment.deleteOne();

    res.json({ message: "Assignment deleted successfully", deletedSubmissions: deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student submits (or resubmits) an assignment as PDF/JPG files
const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, content } = req.body;
    const files = req.files || [];

    if (!mongoose.isValidObjectId(assignmentId)) {
      return res.status(400).json({ message: "Invalid assignment ID" });
    }

    if (files.length === 0) {
      return res.status(400).json({ message: "Attach at least one PDF or JPG file" });
    }

    const note = typeof content === "string" ? content.trim() : "";
    if (note.length > MAX_NOTE_LENGTH) {
      return res.status(400).json({ message: `Your note must not exceed ${MAX_NOTE_LENGTH} characters` });
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({ message: "Files must be 12 MB or smaller in total" });
    }

    // The extension and declared type were checked on upload; confirm the contents match
    const storedFiles = [];
    for (const f of files) {
      const detectedType = detectFileType(f.buffer);
      if (!detectedType) {
        return res.status(400).json({ message: `"${f.originalname}" is not a valid PDF or JPG file` });
      }
      storedFiles.push({
        originalName: f.originalname,
        mimeType: detectedType,
        size: f.size,
        data: f.buffer
      });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const course = await Course.findById(assignment.course);

    // Check if student enrolled
    if (!course || !course.students.some(id => id.toString() === req.user.id)) {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    const isLate = Boolean(assignment.dueDate) && new Date() > assignment.dueDate;
    if (isLate && !assignment.allowLateSubmissions) {
      return res.status(400).json({ message: "The deadline for this assignment has passed" });
    }

    let submission = await Submission.findOne({ assignment: assignmentId, student: req.user.id });

    if (submission) {
      // Grading locks the submission so the mark always matches what was graded
      if (submission.marks !== null && submission.marks !== undefined) {
        return res.status(400).json({ message: "This assignment has already been graded and can't be resubmitted" });
      }

      submission.files = storedFiles;
      submission.file = undefined;
      submission.content = note;
      submission.submittedAt = new Date();
      submission.attemptCount = (submission.attemptCount || 1) + 1;
      submission.isLate = isLate;
      await submission.save();

      return res.json({
        message: "Assignment resubmitted successfully",
        submission: summarizeSubmission(submission)
      });
    }

    try {
      submission = await Submission.create({
        assignment: assignmentId,
        student: req.user.id,
        content: note,
        files: storedFiles,
        submittedAt: new Date(),
        isLate
      });
    } catch (error) {
      // Two submissions racing for the same assignment — the unique index lets only one through
      if (error.code === 11000) {
        return res.status(409).json({ message: "A submission is already being processed. Please refresh and try again." });
      }
      throw error;
    }

    res.status(201).json({
      message: "Assignment submitted successfully",
      submission: summarizeSubmission(submission)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty gives marks (and optional feedback); can be called again to change the grade
const giveMarks = async (req, res) => {
  try {
    const { submissionId, marks, feedback } = req.body;

    if (!mongoose.isValidObjectId(submissionId)) {
      return res.status(400).json({ message: "Invalid submission ID" });
    }

    if (typeof marks !== "number" || !Number.isFinite(marks) || marks < 0) {
      return res.status(400).json({ message: "Marks must be a non-negative number" });
    }

    if (feedback !== undefined && feedback !== null &&
      (typeof feedback !== "string" || feedback.trim().length > MAX_FEEDBACK_LENGTH)) {
      return res.status(400).json({ message: `Feedback must not exceed ${MAX_FEEDBACK_LENGTH} characters` });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const { assignment, status, message } = await findOwnedAssignment(submission.assignment.toString(), req.user.id);
    if (!assignment) {
      return res.status(status).json({ message });
    }

    if (marks > assignment.maxMarks) {
      return res.status(400).json({ message: `Marks must be between 0 and ${assignment.maxMarks}` });
    }

    submission.marks = marks;
    submission.feedback = typeof feedback === "string" ? feedback.trim() : submission.feedback;
    submission.gradedAt = new Date();
    await submission.save();

    res.json({
      message: "Marks assigned successfully",
      submission: summarizeSubmission(submission)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty views every enrolled student's submission status for an assignment
const viewSubmissions = async (req, res) => {
  try {
    const { assignment, status, message } = await findOwnedAssignment(req.params.assignmentId, req.user.id);
    if (!assignment) {
      return res.status(status).json({ message });
    }

    const [students, submissions] = await Promise.all([
      User.find({ _id: { $in: assignment.course.students } }).select("name email").sort({ name: 1 }),
      Submission.find({ assignment: assignment._id }).populate("student", "name email")
    ]);

    const submissionsByStudent = new Map(
      submissions.filter(s => s.student).map(s => [s.student._id.toString(), s])
    );

    const rows = students.map(student => {
      const submission = submissionsByStudent.get(student._id.toString());
      submissionsByStudent.delete(student._id.toString());
      if (submission) return summarizeSubmission(submission);
      return {
        _id: `pending-${student._id}`,
        student,
        status: "not_submitted",
        files: [],
        marks: null
      };
    });

    // Keep work from students who have since left the course
    submissionsByStudent.forEach(submission => rows.push(summarizeSubmission(submission)));

    res.json({
      assignment: {
        _id: assignment._id,
        title: assignment.title,
        dueDate: assignment.dueDate,
        maxMarks: assignment.maxMarks,
        allowLateSubmissions: assignment.allowLateSubmissions
      },
      submissions: rows
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Browsers can render these inline; everything else (docx, xlsx, zip, etc.)
// gets forced as a real download, since an "inline" header for a type the
// browser can't display just opens a blank tab with nothing visible.
const INLINE_RENDERABLE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"];

const contentDisposition = (mimeType, originalName) => {
  const type = INLINE_RENDERABLE_TYPES.includes(mimeType) ? "inline" : "attachment";
  const name = originalName || "file";
  const asciiName = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

const sendStoredFile = (res, file, legacyStoredName) => {
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(file.mimeType, file.originalName));
  if (file.data) {
    return res.send(file.data);
  }
  if (legacyStoredName) {
    const legacyPath = path.join(__dirname, "..", "uploads", path.basename(legacyStoredName));
    if (fs.existsSync(legacyPath)) return res.sendFile(legacyPath);
  }
  res.removeHeader("Content-Disposition");
  return res.status(404).json({ message: "Attachment is no longer available" });
};

// Authenticated download of one file from a submission (the student who made it or the course's faculty)
const getSubmissionFile = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const fileId = req.params.fileId || LEGACY_FILE_ID;

    if (!mongoose.isValidObjectId(submissionId)) {
      return res.status(400).json({ message: "Invalid submission ID" });
    }

    const submission = await Submission.findById(submissionId)
      .select("+files.data +file.data")
      .populate({ path: "assignment", select: "course", populate: { path: "course", select: "faculty" } });

    if (!submission) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const isStudent = submission.student.toString() === req.user.id;
    const isFaculty = submission.assignment?.course?.faculty?.toString() === req.user.id;
    if (!isStudent && !isFaculty) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (fileId === LEGACY_FILE_ID) {
      if (!submission.file?.originalName) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      return sendStoredFile(res, submission.file, submission.file.storedName);
    }

    const file = mongoose.isValidObjectId(fileId) ? submission.files.id(fileId) : null;
    if (!file) {
      return res.status(404).json({ message: "Attachment not found" });
    }
    return sendStoredFile(res, file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Backward-compatible handler for links created before attachments moved to MongoDB.
const getLegacySubmissionFile = async (req, res) => {
  try {
    const submission = await Submission.findOne({ "file.storedName": req.params.storedName })
      .select("file +file.data");

    if (!submission?.file) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    return sendStoredFile(res, submission.file, submission.file.storedName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student views own submissions
const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate("assignment", "title dueDate maxMarks course")
      .sort({ submittedAt: -1 });

    res.json(submissions.map(summarizeSubmission));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student views assignments for courses they are enrolled in, each with their own submission (if any)
const getAvailableAssignments = async (req, res) => {
  try {
    const courses = await Course.find({ students: req.user.id }).select("_id");
    const assignments = await Assignment.find({
      course: { $in: courses.map(course => course._id) }
    })
      .populate("course", "title")
      .sort({ dueDate: 1, createdAt: -1 });

    const submissions = await Submission.find({
      student: req.user.id,
      assignment: { $in: assignments.map(assignment => assignment._id) }
    });
    const submissionByAssignment = new Map(
      submissions.map(submission => [submission.assignment.toString(), submission])
    );

    res.json(assignments.map(assignment => {
      const submission = submissionByAssignment.get(assignment._id.toString());
      return {
        ...assignment.toObject(),
        submission: submission ? summarizeSubmission(submission) : null
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty views assignments belonging to one of their courses, with submission counts
const getFacultyAssignments = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    const course = await Course.findOne({ _id: req.params.courseId, faculty: req.user.id });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const assignments = await Assignment.find({ course: course._id })
      .populate("course", "title")
      .sort({ dueDate: 1, createdAt: -1 });

    const counts = await Submission.aggregate([
      { $match: { assignment: { $in: assignments.map(a => a._id) } } },
      {
        $group: {
          _id: "$assignment",
          submitted: { $sum: 1 },
          graded: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$marks", null] }, null] }, 1, 0] } },
          late: { $sum: { $cond: ["$isLate", 1, 0] } }
        }
      }
    ]);
    const countsByAssignment = new Map(counts.map(c => [c._id.toString(), c]));

    res.json(assignments.map(assignment => {
      const c = countsByAssignment.get(assignment._id.toString());
      return {
        ...assignment.toObject(),
        totalStudents: course.students.length,
        submittedCount: c?.submitted || 0,
        gradedCount: c?.graded || 0,
        lateCount: c?.late || 0
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFacultyStats = async (req, res) => {
  try {
    const courses = await Course.find({ faculty: req.user.id }).select("_id");
    const assignments = await Assignment.find({ course: { $in: courses.map(c => c._id) } }).select("_id");
    const assignmentIds = assignments.map(a => a._id);

    const [totalSubmissions, pendingGrading] = await Promise.all([
      Submission.countDocuments({ assignment: { $in: assignmentIds } }),
      Submission.countDocuments({ assignment: { $in: assignmentIds }, marks: null })
    ]);

    res.json({
      totalCourses: courses.length,
      totalAssignments: assignments.length,
      totalSubmissions,
      pendingGrading
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  giveMarks,
  viewSubmissions,
  getMySubmissions,
  getAvailableAssignments,
  getFacultyAssignments,
  getSubmissionFile,
  getLegacySubmissionFile,
  getFacultyStats
};

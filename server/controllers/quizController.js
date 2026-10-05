const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const Question = require("../models/Question");
const QuizResponse = require("../models/QuizResponse");
const Course = require("../models/Course");

const QUESTION_TYPES = ["mcq", "truefalse", "shortanswer"];

const isNonNegativeNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

// Keeps totalQuestions/totalMarks in step with the quiz's live questions,
// so percentages and pass/fail are always measured against the real maximum
const syncQuizTotals = async (quiz) => {
  const questions = await Question.find({ quiz: quiz._id, isDeleted: false }).select("marks");
  quiz.totalQuestions = questions.length;
  quiz.totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  await quiz.save();
};

// Returns an error message, or null if the question data is valid for its type
const validateQuestionData = ({ type, marks, options, correctAnswer }) => {
  if (!QUESTION_TYPES.includes(type)) return "Invalid question type";

  if (marks !== undefined && (typeof marks !== "number" || !Number.isFinite(marks) || marks < 1)) {
    return "Marks must be a number of at least 1";
  }

  if (type === "mcq") {
    if (!Array.isArray(options) || options.length < 2) return "MCQ must have at least 2 options";
    if (options.some(opt => typeof opt?.text !== "string" || !opt.text.trim())) return "MCQ options cannot be empty";
    // Auto-grading compares against a single correct option
    if (options.filter(opt => opt.isCorrect).length !== 1) return "MCQ must have exactly one correct option";
  }

  if (type === "truefalse" && typeof correctAnswer !== "boolean") {
    return "True/False must have correct answer";
  }

  return null;
};

// Faculty creates a new quiz
const createQuiz = async (req, res) => {
  try {
    const { title, subject, description, duration, dueDate, passMarks, courseId } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ message: "Title and subject are required" });
    }

    if (duration !== undefined && duration !== null && (!isNonNegativeNumber(duration) || duration < 1)) {
      return res.status(400).json({ message: "Duration must be at least 1 minute" });
    }

    if (passMarks !== undefined && passMarks !== null && !isNonNegativeNumber(passMarks)) {
      return res.status(400).json({ message: "Pass marks must be a non-negative number" });
    }

    if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      if (course.faculty.toString() !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to use this course" });
      }
    }

    // totalMarks is derived from the questions as they are added
    const quiz = await Quiz.create({
      title,
      subject,
      description,
      duration,
      dueDate,
      totalMarks: 0,
      passMarks: passMarks ?? 40,
      course: courseId || undefined,
      createdBy: req.user.id,
      status: "draft"
    });

    res.status(201).json({
      message: "Quiz created successfully",
      quiz
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty updates quiz details
const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, subject, description, duration, dueDate, passMarks } = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify faculty ownership
    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this quiz" });
    }

    if (quiz.isPublished) {
      return res.status(400).json({ message: "Cannot edit published quiz" });
    }

    if (passMarks !== undefined && !isNonNegativeNumber(passMarks)) {
      return res.status(400).json({ message: "Pass marks must be a non-negative number" });
    }

    // Only overwrite fields that were actually sent
    const updates = { title, subject, description, duration, dueDate, passMarks };
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) quiz[key] = value;
    });
    await quiz.save();

    res.json({ message: "Quiz updated successfully", quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty gets their quizzes
const getQuizzes = async (req, res) => {
  try {
    const { status, subject } = req.query;
    let filter = { createdBy: req.user.id, isDeleted: false };

    if (status) filter.status = status;
    if (subject) filter.subject = subject;

    const quizzes = await Quiz.find(filter)
      .select("title subject description status totalQuestions totalMarks dueDate createdAt isPublished")
      .sort({ createdAt: -1 });

    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get quiz by ID (for editing or taking)
const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email");

    if (!quiz || quiz.isDeleted) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (req.user.role === "faculty" && quiz.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.user.role === "student" && (
      !quiz.isPublished || !quiz.assignedTo.some(assigned =>
        (assigned._id || assigned).toString() === req.user.id
      )
    )) {
      return res.status(403).json({ message: "This quiz is not assigned to you" });
    }

    const questions = await Question.find({ quiz: quizId, isDeleted: false }).sort({ order: 1 });

    const quizObject = quiz.toObject();
    if (req.user.role === "student") {
      // Students don't need the class list
      delete quizObject.assignedTo;
    }

    const visibleQuestions = req.user.role === "student"
      ? questions.map(question => {
        const visible = question.toObject();
        if (visible.options) visible.options = visible.options.map(option => ({ text: option.text }));
        delete visible.correctAnswer;
        delete visible.modelAnswer;
        return visible;
      })
      : questions;

    res.json({
      ...quizObject,
      questions: visibleQuestions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty publishes a quiz
const publishQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.isDeleted) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (quiz.isPublished) {
      return res.status(400).json({ message: "Quiz is already published" });
    }

    await syncQuizTotals(quiz);

    if (quiz.totalQuestions === 0) {
      return res.status(400).json({ message: "Quiz must have at least one question" });
    }

    if (quiz.passMarks > quiz.totalMarks) {
      return res.status(400).json({
        message: `Pass marks (${quiz.passMarks}) cannot exceed the quiz total of ${quiz.totalMarks} marks`
      });
    }

    quiz.isPublished = true;
    quiz.status = "active";
    await quiz.save();

    res.json({ message: "Quiz published successfully", quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty soft-deletes a quiz
const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    quiz.isDeleted = true;
    await quiz.save();

    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty assigns quiz to students
const assignQuizToStudents = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: "Student IDs required" });
    }

    const requestedIds = [...new Set(studentIds.map(String))];
    if (requestedIds.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.isDeleted) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Faculty may only assign to students enrolled in one of their own courses
    const courses = await Course.find({ faculty: req.user.id, students: { $in: requestedIds } }).select("students");
    const enrolledIds = new Set(courses.flatMap(course => course.students.map(String)));
    if (requestedIds.some(id => !enrolledIds.has(id))) {
      return res.status(400).json({ message: "Quizzes can only be assigned to students enrolled in your courses" });
    }

    // Compare as strings — a Set of ObjectIds would never dedupe
    quiz.assignedTo = [...new Set([...quiz.assignedTo.map(String), ...requestedIds])];
    await quiz.save();

    res.json({ message: "Quiz assigned successfully", quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student gets their assigned quizzes
const getStudentQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({
      assignedTo: req.user.id,
      isPublished: true,
      isDeleted: false
    })
      .select("title subject status totalQuestions totalMarks duration dueDate createdAt")
      .populate("createdBy", "name")
      .sort({ dueDate: 1 });

    // Only the active attempt matters — superseded ones are replaced by a granted reattempt
    const responses = await QuizResponse.find({
      quiz: { $in: quizzes.map(quiz => quiz._id) },
      student: req.user.id,
      isActive: true
    }).select("quiz status totalMarksObtained");
    const responseByQuiz = new Map(responses.map(response => [response.quiz.toString(), response]));

    const quizzesWithStatus = quizzes.map(quiz => {
      const response = responseByQuiz.get(quiz._id.toString());
      const isFinished = response && response.status !== "inprogress";
      return {
        ...quiz.toObject(),
        submissionStatus: response ? response.status : "notStarted",
        score: isFinished ? response.totalMarksObtained : null
      };
    });

    res.json(quizzesWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty adds question to quiz
const addQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { type, questionText, marks, options, correctAnswer, modelAnswer } = req.body;

    if (!type || !questionText) {
      return res.status(400).json({ message: "Type and question text required" });
    }

    const validationError = validateQuestionData({ type, marks, options, correctAnswer });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.isDeleted) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (quiz.isPublished) {
      return res.status(400).json({ message: "Cannot add questions to published quiz" });
    }

    const order = await Question.countDocuments({ quiz: quizId, isDeleted: false });

    const question = await Question.create({
      quiz: quizId,
      type,
      questionText,
      marks: marks || 1,
      options: type === "mcq" ? options.map(opt => ({ text: opt.text.trim(), isCorrect: Boolean(opt.isCorrect) })) : undefined,
      correctAnswer: type === "truefalse" ? correctAnswer : undefined,
      modelAnswer: type === "shortanswer" ? modelAnswer : undefined,
      order
    });

    await syncQuizTotals(quiz);

    res.status(201).json({
      message: "Question added successfully",
      question
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty updates question
const updateQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const { type, questionText, marks, options, correctAnswer, modelAnswer } = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Changing a question after students have answered it would silently regrade them
    if (quiz.isPublished) {
      return res.status(400).json({ message: "Cannot edit questions of a published quiz" });
    }

    const existing = await Question.findOne({ _id: questionId, quiz: quizId, isDeleted: false });
    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    const merged = {
      type: type ?? existing.type,
      questionText: questionText ?? existing.questionText,
      marks: marks ?? existing.marks,
      options: options ?? existing.options,
      correctAnswer: correctAnswer ?? existing.correctAnswer,
      modelAnswer: modelAnswer ?? existing.modelAnswer
    };

    const validationError = validateQuestionData(merged);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    Object.assign(existing, merged);
    const question = await existing.save();

    await syncQuizTotals(quiz);

    res.json({ message: "Question updated successfully", question });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty deletes question
const deleteQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (quiz.isPublished) {
      return res.status(400).json({ message: "Cannot delete questions from a published quiz" });
    }

    const question = await Question.findOneAndUpdate(
      { _id: questionId, quiz: quizId },
      { isDeleted: true },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    await syncQuizTotals(quiz);

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createQuiz,
  updateQuiz,
  getQuizzes,
  getQuizById,
  publishQuiz,
  deleteQuiz,
  assignQuizToStudents,
  getStudentQuizzes,
  addQuestion,
  updateQuestion,
  deleteQuestion
};

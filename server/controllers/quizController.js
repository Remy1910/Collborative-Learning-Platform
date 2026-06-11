const Quiz = require("../models/Quiz");
const Question = require("../models/Question");
const User = require("../models/User");
const QuizResponse = require("../models/QuizResponse");

// Faculty creates a new quiz
const createQuiz = async (req, res) => {
  try {
    const { title, subject, description, duration, dueDate, totalMarks, passMarks } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ message: "Title and subject are required" });
    }

    const quiz = await Quiz.create({
      title,
      subject,
      description,
      duration,
      dueDate,
      totalMarks: totalMarks || 100,
      passMarks: passMarks || 40,
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
    const { title, subject, description, duration, dueDate, totalMarks, passMarks } = req.body;

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

    Object.assign(quiz, { title, subject, description, duration, dueDate, totalMarks, passMarks });
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
      .select("title subject status totalQuestions totalMarks dueDate createdAt isPublished")
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

    const questions = await Question.find({ quiz: quizId, isDeleted: false }).sort({ order: 1 });

    res.json({
      ...quiz.toObject(),
      questions
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
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const questionCount = await Question.countDocuments({ quiz: quizId, isDeleted: false });
    if (questionCount === 0) {
      return res.status(400).json({ message: "Quiz must have at least one question" });
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

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    quiz.assignedTo = [...new Set([...quiz.assignedTo, ...studentIds])];
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

    // Get student's submission status for each quiz
    const quizzesWithStatus = await Promise.all(
      quizzes.map(async (quiz) => {
        const response = await QuizResponse.findOne({
          quiz: quiz._id,
          student: req.user.id
        });
        return {
          ...quiz.toObject(),
          submissionStatus: response ? response.status : "notStarted",
          score: response ? response.totalMarksObtained : null
        };
      })
    );

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

    if (!["mcq", "truefalse", "shortanswer"].includes(type)) {
      return res.status(400).json({ message: "Invalid question type" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (quiz.isPublished) {
      return res.status(400).json({ message: "Cannot add questions to published quiz" });
    }

    // Validate question data
    if (type === "mcq") {
      if (!options || options.length < 2) {
        return res.status(400).json({ message: "MCQ must have at least 2 options" });
      }
      if (!options.some(opt => opt.isCorrect)) {
        return res.status(400).json({ message: "At least one option must be correct" });
      }
    }

    if (type === "truefalse" && correctAnswer === undefined) {
      return res.status(400).json({ message: "True/False must have correct answer" });
    }

    const order = await Question.countDocuments({ quiz: quizId, isDeleted: false });

    const question = await Question.create({
      quiz: quizId,
      type,
      questionText,
      marks: marks || 1,
      options: type === "mcq" ? options : undefined,
      correctAnswer: type === "truefalse" ? correctAnswer : undefined,
      modelAnswer,
      order
    });

    // Update quiz question count
    quiz.totalQuestions = await Question.countDocuments({ quiz: quizId, isDeleted: false });
    await quiz.save();

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

    const question = await Question.findByIdAndUpdate(
      questionId,
      { type, questionText, marks, options, correctAnswer, modelAnswer },
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

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

    const question = await Question.findByIdAndUpdate(
      questionId,
      { isDeleted: true },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Update question count
    quiz.totalQuestions = await Question.countDocuments({ quiz: quizId, isDeleted: false });
    await quiz.save();

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

const QuizResponse = require("../models/QuizResponse");
const Quiz = require("../models/Quiz");
const Question = require("../models/Question");
const User = require("../models/User");

// Student starts a quiz
const startQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isPublished) {
      return res.status(404).json({ message: "Quiz not found or not published" });
    }

    if (!quiz.assignedTo.some(id => id.toString() === req.user.id)) {
      return res.status(403).json({ message: "This quiz is not assigned to you" });
    }

    // Check if there's already an active attempt (in progress, submitted, graded, or terminated)
    let response = await QuizResponse.findOne({
      quiz: quizId,
      student: req.user.id,
      isActive: true
    });

    if (response) {
      // Resume an in-progress attempt
      if (response.status === "inprogress") {
        return res.json({ message: "Quiz resumed", response });
      }
      // Already finished (submitted/graded/terminated) — no automatic restart.
      // A new attempt can only be created via a faculty-granted reattempt.
      return res.status(400).json({
        message: "You have already completed this quiz. Contact your instructor if you believe this is an error.",
        response
      });
    }

    // No active attempt exists — this is a fresh attempt (attemptNumber 1, or first attempt after being granted a reattempt)
    // Figure out the correct attemptNumber by checking the highest existing attempt for this quiz+student
    const lastAttempt = await QuizResponse.findOne({
      quiz: quizId,
      student: req.user.id
    }).sort({ attemptNumber: -1 });

    const nextAttemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    const questions = await Question.find({ quiz: quizId, isDeleted: false })
      .select("_id type questionText marks options correctAnswer modelAnswer order")
      .sort({ order: 1 });

    const responses = questions.map(q => ({
      question: q._id,
      studentAnswer: null,
      isCorrect: null,
      marksObtained: 0
    }));

    response = await QuizResponse.create({
      quiz: quizId,
      student: req.user.id,
      responses,
      status: "inprogress",
      startedAt: new Date(),
      attemptNumber: nextAttemptNumber,
      isActive: true
    });

    res.status(201).json({
      message: "Quiz started successfully",
      response,
      questions: questions.map(q => ({
        _id: q._id,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks,
        options: q.options,
        order: q.order
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student saves an answer (auto-save)
const saveResponse = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { questionId, studentAnswer } = req.body;

    const response = await QuizResponse.findById(responseId);
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (response.status !== "inprogress") {
      return res.status(400).json({ message: "Quiz already submitted" });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Find answer in responses array
    const answerIndex = response.responses.findIndex(
      r => r.question.toString() === questionId
    );

    if (answerIndex === -1) {
      return res.status(404).json({ message: "Question not in this quiz" });
    }

    // Auto-grade MCQ and True/False
    let isCorrect = null;
    let marksObtained = 0;

    if (question.type === "mcq") {
      isCorrect = studentAnswer === question.options.find(o => o.isCorrect)?.text;
      if (isCorrect) marksObtained = question.marks;
    } else if (question.type === "truefalse") {
      isCorrect = studentAnswer === question.correctAnswer;
      if (isCorrect) marksObtained = question.marks;
    }
    // Short answer questions are not auto-graded

    response.responses[answerIndex] = {
      question: questionId,
      studentAnswer,
      isCorrect,
      marksObtained
    };

    await response.save();

    res.json({ message: "Answer saved", response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student's proctoring violation gets logged server-side (tamper-resistant against refresh)
const logViolation = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Violation reason is required" });
    }

    const response = await QuizResponse.findById(responseId);
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (response.status !== "inprogress") {
      // Quiz already finished (submitted/terminated/graded) — nothing to log against
      return res.status(400).json({ message: "Quiz is not in progress" });
    }

    const MAX_VIOLATIONS = 3;

    response.violations.push({
      reason: reason.trim(),
      timestamp: new Date()
    });

    const violationCount = response.violations.length;
    let terminated = false;

    if (violationCount >= MAX_VIOLATIONS) {
      // Server-side auto-termination — this is the authoritative decision, not the frontend's
      let totalMarks = 0;
      response.responses.forEach(r => {
        totalMarks += r.marksObtained || 0;
      });

      response.totalMarksObtained = totalMarks;
      response.status = "terminated";
      response.submittedAt = new Date();
      response.timeSpent = Math.round((Date.now() - response.startedAt) / 1000);

      // isPassed requires the quiz's passMarks — fetch it
      const quiz = await Quiz.findById(response.quiz).select("passMarks");
      response.isPassed = quiz ? totalMarks >= quiz.passMarks : false;

      terminated = true;
    }

    await response.save();

    res.json({
      message: terminated
        ? "Maximum violations reached — quiz has been auto-submitted"
        : "Violation logged",
      violationCount,
      maxViolations: MAX_VIOLATIONS,
      terminated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student submits completed quiz
const submitQuiz = async (req, res) => {
  try {
    const { responseId } = req.params;

    const response = await QuizResponse.findById(responseId)
      .populate("quiz")
      .populate("responses.question");

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (response.status !== "inprogress") {
      return res.status(400).json({ message: "Quiz already submitted" });
    }

    // Calculate total marks
    let totalMarks = 0;
    response.responses.forEach(r => {
      totalMarks += r.marksObtained || 0;
    });

    // Check if passed
    const quiz = response.quiz;
    const isPassed = totalMarks >= quiz.passMarks;

    response.totalMarksObtained = totalMarks;
    response.status = "submitted";
    response.submittedAt = new Date();
    response.timeSpent = Math.round((Date.now() - response.startedAt) / 1000); // in seconds
    response.isPassed = isPassed;

    await response.save();

    // Auto-grade short answers (mark as submitted, faculty grades later)
    const shortAnswerCount = response.responses.filter(
      r => r.question?.type === "shortanswer"
    ).length;

    const responseObject = response.toObject();
    const percentageScore = (totalMarks / quiz.totalMarks) * 100;

    res.json({
      message: "Quiz submitted successfully",
      score: totalMarks,
      totalMarks: quiz.totalMarks,
      percentage: percentageScore.toFixed(2),
      isPassed,
      hasShortAnswers: shortAnswerCount > 0,
      response: responseObject
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty views submissions for a quiz
const getSubmittedQuizzes = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const submissions = await QuizResponse.find({
      quiz: quizId,
      status: { $in: ["submitted", "graded", "terminated"] },
      isActive: true
    })
      .populate("student", "name email")
      .select("student totalMarksObtained status submittedAt isPassed")
      .sort({ submittedAt: -1 });

    const totalStudents = quiz.assignedTo.length;
    const submitted = submissions.length;
    const avgScore = submissions.length > 0
      ? (submissions.reduce((sum, s) => sum + s.totalMarksObtained, 0) / submissions.length).toFixed(2)
      : 0;

    res.json({
      totalStudents,
      submitted,
      pending: totalStudents - submitted,
      avgScore,
      submissions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student views their quiz response
const getStudentResponses = async (req, res) => {
  try {
    const { quizId } = req.params;

    const response = await QuizResponse.findOne({
      quiz: quizId,
      student: req.user.id,
      isActive: true
    })
      .populate("quiz", "title showAnswers")
      .populate("responses.question", "type questionText marks options correctAnswer modelAnswer");

    if (!response) {
      return res.status(404).json({ message: "No submission found" });
    }

    // Hide correct answers if quiz doesn't allow showing answers
    if (!response.quiz.showAnswers && response.status === "submitted") {
      response.responses.forEach(r => {
        if (r.question) {
          if (r.question.type === "mcq") r.question.options = r.question.options.map(o => ({ text: o.text }));
          if (r.question.type === "truefalse") r.question.correctAnswer = null;
        }
      });
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty grades short answer questions
const gradeShortAnswer = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { questionId, marksObtained } = req.body;

    if (typeof marksObtained !== "number" || marksObtained < 0) {
      return res.status(400).json({ message: "Invalid marks" });
    }

    const response = await QuizResponse.findById(responseId)
      .populate("quiz")
      .populate("responses.question");

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    const quiz = response.quiz;
    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const answerIndex = response.responses.findIndex(
      r => r.question._id.toString() === questionId
    );

    if (answerIndex === -1) {
      return res.status(404).json({ message: "Answer not found" });
    }

    const maxMarks = response.responses[answerIndex].question.marks;
    if (marksObtained > maxMarks) {
      return res.status(400).json({ message: `Marks cannot exceed ${maxMarks}` });
    }

    response.responses[answerIndex].marksObtained = marksObtained;
    response.responses[answerIndex].isCorrect = marksObtained > 0;

    // Recalculate total marks
    response.totalMarksObtained = response.responses.reduce(
      (sum, r) => sum + (r.marksObtained || 0),
      0
    );

    // Check if passed
    response.isPassed = response.totalMarksObtained >= quiz.passMarks;
    response.status = "graded";

    await response.save();

    res.json({
      message: "Answer graded successfully",
      response
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty gets quiz analytics
const getQuizStats = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const submissions = await QuizResponse.find({
      quiz: quizId,
      status: { $in: ["submitted", "graded"] },
      isActive: true
    });

    const totalAssigned = quiz.assignedTo.length;
    const totalSubmitted = submissions.length;
    const totalPassed = submissions.filter(s => s.isPassed).length;

    const scores = submissions.map(s => s.totalMarksObtained);
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(2) : 0;
    const highestScore = Math.max(...scores, 0);
    const lowestScore = Math.min(...scores, scores.length > 0 ? scores[0] : 0);

    // Score distribution (0-20%, 20-40%, etc.)
    const distribution = [0, 0, 0, 0, 0];
    scores.forEach(score => {
      const percentage = (score / quiz.totalMarks) * 100;
      if (percentage <= 20) distribution[0]++;
      else if (percentage <= 40) distribution[1]++;
      else if (percentage <= 60) distribution[2]++;
      else if (percentage <= 80) distribution[3]++;
      else distribution[4]++;
    });

    res.json({
      totalAssigned,
      totalSubmitted,
      submissionRate: totalAssigned > 0 ? ((totalSubmitted / totalAssigned) * 100).toFixed(2) : 0,
      totalPassed,
      passRate: totalSubmitted > 0 ? ((totalPassed / totalSubmitted) * 100).toFixed(2) : 0,
      avgScore,
      highestScore,
      lowestScore,
      scoreDistribution: {
        labels: ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"],
        data: distribution
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student gets their quiz results
const getMyResults = async (req, res) => {
  try {
    const results = await QuizResponse.find({
      student: req.user.id,
      status: { $in: ["submitted", "graded"] },
      isActive: true
    })
      .populate("quiz", "title subject totalMarks")
      .select("quiz totalMarksObtained isPassed submittedAt")
      .sort({ submittedAt: -1 });

    const formattedResults = results.map(r => ({
      quizId: r.quiz._id,
      quizTitle: r.quiz.title,
      subject: r.quiz.subject,
      score: r.totalMarksObtained,
      maxScore: r.quiz.totalMarks,
      percentage: ((r.totalMarksObtained / r.quiz.totalMarks) * 100).toFixed(2),
      passed: r.isPassed,
      submittedAt: r.submittedAt
    }));

    res.json(formattedResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Faculty grants a student a fresh attempt (e.g. after a tech glitch or wrongful auto-termination)
const grantReattempt = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "A reason is required to grant a reattempt" });
    }

    const oldResponse = await QuizResponse.findById(responseId).populate("quiz");
    if (!oldResponse) {
      return res.status(404).json({ message: "Quiz response not found" });
    }

    const quiz = oldResponse.quiz;
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to grant a reattempt for this quiz" });
    }

    if (oldResponse.status === "inprogress") {
      return res.status(400).json({ message: "This attempt is still in progress and cannot be reattempted yet" });
    }

    if (!oldResponse.isActive) {
      return res.status(400).json({ message: "This attempt has already been superseded" });
    }

    // Supersede the old attempt — the student's next "Start Quiz" click will create
    // a fresh QuizResponse via startQuiz(), with the correct attemptNumber and startedAt.
    oldResponse.isActive = false;
    oldResponse.status = "superseded";
    await oldResponse.save();

    res.json({
      message: "Reattempt granted — the student can now restart this quiz.",
      quizId: quiz._id,
      studentId: oldResponse.student
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  startQuiz,
  saveResponse,
  submitQuiz,
  getSubmittedQuizzes,
  getStudentResponses,
  gradeShortAnswer,
  getQuizStats,
  getMyResults,
  logViolation,
  grantReattempt
};

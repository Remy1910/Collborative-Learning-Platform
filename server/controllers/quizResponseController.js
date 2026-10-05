const QuizResponse = require("../models/QuizResponse");
const Quiz = require("../models/Quiz");
const Question = require("../models/Question");

const MAX_VIOLATIONS = 3;
// Allowance for network latency between the client timer hitting zero and its auto-submit/save arriving
const DURATION_GRACE_SECONDS = 30;
const FINISHED_STATUSES = ["submitted", "graded", "terminated"];

const elapsedSeconds = (response) =>
  Math.round((Date.now() - new Date(response.startedAt).getTime()) / 1000);

const isPastTimeLimit = (response, quiz) =>
  Boolean(quiz?.duration) && elapsedSeconds(response) > quiz.duration * 60 + DURATION_GRACE_SECONDS;

const percentageOf = (score, total) =>
  total > 0 ? Number(((score / total) * 100).toFixed(2)) : 0;

// Totals up the attempt and closes it with the given status
const finalizeResponse = (response, quiz, status) => {
  const totalMarks = response.responses.reduce((sum, r) => sum + (r.marksObtained || 0), 0);
  const elapsed = elapsedSeconds(response);

  response.totalMarksObtained = totalMarks;
  response.status = status;
  response.submittedAt = new Date();
  response.timeSpent = quiz?.duration ? Math.min(elapsed, quiz.duration * 60) : elapsed;
  response.isPassed = quiz ? totalMarks >= quiz.passMarks : false;
};

// Questions as a student may see them — no answer key
const toStudentQuestion = (q) => ({
  _id: q._id,
  type: q.type,
  questionText: q.questionText,
  marks: q.marks,
  options: (q.options || []).map(o => ({ text: o.text })),
  order: q.order
});

// An in-progress attempt without per-answer grading, so students can't probe correctness mid-quiz
const toStudentInProgressResponse = (response) => {
  const obj = response.toObject();
  obj.responses = obj.responses.map(({ question, studentAnswer }) => ({ question, studentAnswer }));
  delete obj.totalMarksObtained;
  delete obj.isPassed;
  return obj;
};

const loadStudentQuestions = async (quizId) => {
  const questions = await Question.find({ quiz: quizId, isDeleted: false }).sort({ order: 1 });
  return questions.map(toStudentQuestion);
};

// Student starts a quiz
const startQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isPublished || quiz.isDeleted) {
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
      if (response.status === "inprogress") {
        // Time ran out while the student was away — close the attempt with what was saved
        if (isPastTimeLimit(response, quiz)) {
          finalizeResponse(response, quiz, "submitted");
          await response.save();
          return res.status(400).json({
            message: "The time limit for this quiz has expired. Your saved answers have been submitted."
          });
        }

        return res.json({
          message: "Quiz resumed",
          response: toStudentInProgressResponse(response),
          questions: await loadStudentQuestions(quizId)
        });
      }
      // Already finished (submitted/graded/terminated) — no automatic restart.
      // A new attempt can only be created via a faculty-granted reattempt.
      return res.status(400).json({
        message: "You have already completed this quiz. Contact your instructor if you believe this is an error."
      });
    }

    // No active attempt exists — this is a fresh attempt (attemptNumber 1, or first attempt after being granted a reattempt)
    const lastAttempt = await QuizResponse.findOne({
      quiz: quizId,
      student: req.user.id
    }).sort({ attemptNumber: -1 });

    // Faculty-granted reattempts are allowed past the due date
    if (!lastAttempt && quiz.dueDate && new Date() > quiz.dueDate) {
      return res.status(400).json({ message: "The due date for this quiz has passed" });
    }

    const nextAttemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    const questions = await Question.find({ quiz: quizId, isDeleted: false }).sort({ order: 1 });

    try {
      response = await QuizResponse.create({
        quiz: quizId,
        student: req.user.id,
        responses: questions.map(q => ({
          question: q._id,
          studentAnswer: null,
          isCorrect: null,
          marksObtained: 0
        })),
        status: "inprogress",
        startedAt: new Date(),
        attemptNumber: nextAttemptNumber,
        isActive: true
      });
    } catch (error) {
      // Another "start" request for this quiz won the race — the unique index allows one active attempt
      if (error.code === 11000) {
        return res.status(409).json({ message: "This quiz is already being started. Please try again." });
      }
      throw error;
    }

    res.status(201).json({
      message: "Quiz started successfully",
      response: toStudentInProgressResponse(response),
      questions: questions.map(toStudentQuestion)
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

    const response = await QuizResponse.findById(responseId).populate("quiz", "duration");
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (response.status !== "inprogress") {
      return res.status(400).json({ message: "Quiz already submitted" });
    }

    if (isPastTimeLimit(response, response.quiz)) {
      return res.status(400).json({ message: "The time limit for this quiz has expired" });
    }

    const question = await Question.findOne({ _id: questionId, quiz: response.quiz._id });
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

    // Don't echo grading back — the student would learn which answers are correct
    res.json({ message: "Answer saved" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Student's proctoring violation gets logged server-side (tamper-resistant against refresh)
const logViolation = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || !reason.trim()) {
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

    response.violations.push({
      reason: reason.trim().slice(0, 200),
      timestamp: new Date()
    });

    const violationCount = response.violations.length;
    let terminated = false;

    if (violationCount >= MAX_VIOLATIONS) {
      // Server-side auto-termination — this is the authoritative decision, not the frontend's
      const quiz = await Quiz.findById(response.quiz).select("passMarks duration");
      finalizeResponse(response, quiz, "terminated");
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

    // Submitting after the time limit is still accepted — late saves were already rejected,
    // so only answers given in time count
    const quiz = response.quiz;
    finalizeResponse(response, quiz, "submitted");
    await response.save();

    const hasShortAnswers = response.responses.some(r => r.question?.type === "shortanswer");

    res.json({
      message: "Quiz submitted successfully",
      score: response.totalMarksObtained,
      totalMarks: quiz.totalMarks,
      percentage: percentageOf(response.totalMarksObtained, quiz.totalMarks),
      isPassed: response.isPassed,
      hasShortAnswers
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
      status: { $in: FINISHED_STATUSES },
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
      totalMarks: quiz.totalMarks,
      submissions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty views one attempt in full, including the answer key, for review and grading
const getResponseDetails = async (req, res) => {
  try {
    const response = await QuizResponse.findById(req.params.responseId)
      .populate("quiz", "title createdBy totalMarks passMarks")
      .populate("student", "name email")
      .populate("responses.question", "type questionText marks options correctAnswer modelAnswer");

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.quiz?.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(response);
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

    const result = response.toObject();
    const inProgress = result.status === "inprogress";
    const revealAnswers = Boolean(result.quiz?.showAnswers) && !inProgress;

    result.responses = result.responses.map(r => {
      const item = { ...r };
      if (item.question && !revealAnswers) {
        item.question = {
          ...item.question,
          options: (item.question.options || []).map(o => ({ text: o.text }))
        };
        delete item.question.correctAnswer;
        delete item.question.modelAnswer;
      }
      if (inProgress) {
        delete item.isCorrect;
        delete item.marksObtained;
      }
      return item;
    });

    if (inProgress) {
      delete result.totalMarksObtained;
      delete result.isPassed;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Faculty grades short answer questions
const gradeShortAnswer = async (req, res) => {
  try {
    const { responseId } = req.params;
    const { questionId, marksObtained } = req.body;

    if (typeof marksObtained !== "number" || !Number.isFinite(marksObtained) || marksObtained < 0) {
      return res.status(400).json({ message: "Invalid marks" });
    }

    const response = await QuizResponse.findById(responseId)
      .populate("quiz")
      .populate("responses.question");

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    const quiz = response.quiz;
    if (!quiz || quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!response.isActive || !FINISHED_STATUSES.includes(response.status)) {
      return res.status(400).json({ message: "Only finished, current attempts can be graded" });
    }

    const answer = response.responses.find(
      r => r.question && r.question._id.toString() === questionId
    );

    if (!answer) {
      return res.status(404).json({ message: "Answer not found" });
    }

    if (answer.question.type !== "shortanswer") {
      return res.status(400).json({ message: "Only short answer questions are graded manually" });
    }

    const maxMarks = answer.question.marks;
    if (marksObtained > maxMarks) {
      return res.status(400).json({ message: `Marks cannot exceed ${maxMarks}` });
    }

    answer.marksObtained = marksObtained;
    answer.isCorrect = marksObtained > 0;
    answer.isGraded = true;

    // Recalculate total marks
    response.totalMarksObtained = response.responses.reduce(
      (sum, r) => sum + (r.marksObtained || 0),
      0
    );
    response.isPassed = response.totalMarksObtained >= quiz.passMarks;

    // Mark the attempt graded once every short answer has been reviewed.
    // Terminated attempts keep their status so the proctoring outcome stays visible.
    const allGraded = response.responses
      .filter(r => r.question?.type === "shortanswer")
      .every(r => r.isGraded);
    if (allGraded && response.status === "submitted") {
      response.status = "graded";
    }

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
      status: { $in: FINISHED_STATUSES },
      isActive: true
    });

    const totalAssigned = quiz.assignedTo.length;
    const totalSubmitted = submissions.length;
    const totalPassed = submissions.filter(s => s.isPassed).length;

    const scores = submissions.map(s => s.totalMarksObtained);
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(2) : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Score distribution (0-20%, 20-40%, etc.)
    const distribution = [0, 0, 0, 0, 0];
    scores.forEach(score => {
      const percentage = percentageOf(score, quiz.totalMarks);
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
      totalMarks: quiz.totalMarks,
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
      status: { $in: FINISHED_STATUSES },
      isActive: true
    })
      .populate("quiz", "title subject totalMarks")
      .select("quiz totalMarksObtained isPassed submittedAt status")
      .sort({ submittedAt: -1 });

    const formattedResults = results
      .filter(r => r.quiz)
      .map(r => ({
        quizId: r.quiz._id,
        quizTitle: r.quiz.title,
        subject: r.quiz.subject,
        score: r.totalMarksObtained,
        maxScore: r.quiz.totalMarks,
        percentage: percentageOf(r.totalMarksObtained, r.quiz.totalMarks),
        passed: r.isPassed,
        status: r.status,
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

    if (!reason || typeof reason !== "string" || !reason.trim()) {
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
    oldResponse.reattemptGranted = {
      grantedBy: req.user.id,
      reason: reason.trim(),
      grantedAt: new Date()
    };
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
  getResponseDetails,
  getStudentResponses,
  gradeShortAnswer,
  getQuizStats,
  getMyResults,
  logViolation,
  grantReattempt
};

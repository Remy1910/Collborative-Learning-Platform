import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { quizAPI } from "../utils/api";
import "../styles/dashboard.css";

// Icons
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

function QuizTaker() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [response, setResponse] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Load quiz and start it
  useEffect(() => {
    const startQuiz = async () => {
      try {
        setLoading(true);

        // Get quiz details
        const quizData = await quizAPI.getQuizById(quizId);
        setQuiz(quizData);

        // Start quiz response
        const responseData = await quizAPI.startQuiz(quizId);
        setResponse(responseData.response);

        // Set timer if quiz has duration
        if (quizData.duration) {
          setTimeLeft(quizData.duration * 60); // Convert to seconds
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    startQuiz();
  }, [quizId]);

  // Timer effect
  useEffect(() => {
    if (!timeLeft || timeLeft <= 0 || !response) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, response]);

  const currentQuestion = quiz?.questions[currentQuestionIndex];

  const handleAnswerChange = async (newAnswer) => {
    if (!response || !currentQuestion) return;

    // Update local state
    const updatedResponses = [...response.responses];
    updatedResponses[currentQuestionIndex].studentAnswer = newAnswer;
    setResponse({ ...response, responses: updatedResponses });

    // Save to server
    try {
      await quizAPI.saveResponse(response._id, {
        questionId: currentQuestion._id,
        studentAnswer: newAnswer,
      });
    } catch (err) {
      console.error("Error saving response:", err);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setShowSubmitConfirm(false);
    try {
      setSubmitting(true);
      const resultData = await quizAPI.submitQuiz(response._id);
      setResult(resultData);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="quiz-taker">
        <div className="loading-state">Loading quiz...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="quiz-taker">
        <div className="error-banner">{error}</div>
        <button onClick={() => navigate("/student/dashboard")}>Back to Dashboard</button>
      </div>
    );
  }

  // Result screen
  if (result) {
    const passStatus = result.isPassed;
    return (
      <div className="quiz-taker">
        <div className="result-screen">
          <div className={`result-icon ${passStatus ? "passed" : "failed"}`}>
            {passStatus ? "✓" : "✗"}
          </div>
          <h2>{passStatus ? "Congratulations!" : "Quiz Completed"}</h2>
          <p className="result-message">
            {passStatus ? "You have passed the quiz!" : "You need to score higher to pass."}
          </p>

          <div className="score-box">
            <div className="score-display">
              <div className="score-big">{result.score}/{result.totalMarks}</div>
              <div className="score-percentage">{result.percentage}%</div>
            </div>
          </div>

          {result.hasShortAnswers && (
            <div className="info-box">
              ⓘ Your short answer responses will be reviewed by your instructor.
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => navigate("/student/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-taker">
      {/* Header */}
      <div className="quiz-header">
        <h1>{quiz.title}</h1>
        {timeLeft !== null && (
          <div className={`timer ${timeLeft < 300 ? "warning" : ""}`}>
            <IconClock /> {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="quiz-container">
        {/* Progress */}
        <div className="quiz-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`,
              }}
            />
          </div>
          <p className="progress-text">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </p>
        </div>

        {/* Main Content */}
        <div className="quiz-main">
          {/* Question Section */}
          <div className="question-section">
            <h2>{currentQuestion.questionText}</h2>
            <p className="question-marks">({currentQuestion.marks} mark{currentQuestion.marks > 1 ? "s" : ""})</p>

            {/* MCQ */}
            {currentQuestion.type === "mcq" && (
              <div className="options-container">
                {currentQuestion.options.map((option, idx) => (
                  <label key={idx} className="option">
                    <input
                      type="radio"
                      name="mcq"
                      value={option.text}
                      checked={response.responses[currentQuestionIndex].studentAnswer === option.text}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {/* True/False */}
            {currentQuestion.type === "truefalse" && (
              <div className="true-false-container">
                <button
                  className={`btn-tf ${
                    response.responses[currentQuestionIndex].studentAnswer === true ? "selected" : ""
                  }`}
                  onClick={() => handleAnswerChange(true)}
                >
                  True
                </button>
                <button
                  className={`btn-tf ${
                    response.responses[currentQuestionIndex].studentAnswer === false ? "selected" : ""
                  }`}
                  onClick={() => handleAnswerChange(false)}
                >
                  False
                </button>
              </div>
            )}

            {/* Short Answer */}
            {currentQuestion.type === "shortanswer" && (
              <div className="short-answer-container">
                <textarea
                  className="answer-textarea"
                  placeholder="Type your answer here..."
                  value={response.responses[currentQuestionIndex].studentAnswer || ""}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  rows="6"
                />
                {currentQuestion.modelAnswer && (
                  <p className="model-answer">
                    💡 <strong>Hint:</strong> {currentQuestion.modelAnswer}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="quiz-nav">
            <button
              className="btn-secondary"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <IconArrowLeft /> Previous
            </button>

            <button className="btn-secondary" onClick={() => setShowSubmitConfirm(true)}>
              <IconCheck /> Submit Quiz
            </button>

            <button
              className="btn-secondary"
              onClick={handleNext}
              disabled={currentQuestionIndex === quiz.questions.length - 1}
            >
              Next <IconArrowRight />
            </button>
          </div>
        </div>

        {/* Question Tracker Sidebar */}
        <aside className="quiz-sidebar">
          <h3>Questions</h3>
          <div className="question-tracker">
            {quiz.questions.map((q, idx) => (
              <button
                key={idx}
                className={`tracker-btn ${idx === currentQuestionIndex ? "current" : ""} ${
                  response.responses[idx]?.studentAnswer ? "answered" : ""
                }`}
                onClick={() => setCurrentQuestionIndex(idx)}
                title={q.questionText}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="tracker-legend">
            <div className="legend-item">
              <div className="legend-dot answered" /> Answered
            </div>
            <div className="legend-item">
              <div className="legend-dot unanswered" /> Unanswered
            </div>
          </div>
        </aside>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Submit Quiz?</h2>
            <p>Are you sure you want to submit your quiz? You cannot make changes after submission.</p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                Continue Quiz
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmitQuiz}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizTaker;

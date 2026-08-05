import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { quizAPI } from "../utils/api";
import { useQuizProctoring } from "../hooks/useQuizProctoring";
import "../styles/dashboard.css";

// ── Icons ──────────────────────────────────────────────────────────────────
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
);
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

function QuizTaker() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  // Quiz meta + questions array
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);   // flat array from server
  const [responseId, setResponseId] = useState(null);

  // Local answers map: { [questionId]: answerValue }
  const [answers, setAnswers] = useState({});

  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [savingIdx, setSavingIdx] = useState(null); // question idx being auto-saved

  // ── Proctoring gate: quiz doesn't actually start loading until the
  // student clicks "Begin Quiz", since fullscreen requires a user gesture ──
  const [started, setStarted] = useState(false);
  const [terminated, setTerminated] = useState(false);

  // ── Load quiz & start response ───────────────────────────────────────────
  useEffect(() => {
    if (!started) return;
    const init = async () => {
      try {
        setLoading(true);

        // 1. Get quiz details + questions
        const quizData = await quizAPI.getQuizById(quizId);
        setQuiz(quizData);

        // 2. Start (or resume) the quiz response
        const startData = await quizAPI.startQuiz(quizId);
        const resp = startData.response;
        setResponseId(resp._id);

        // Build questions list — server may return them in startData.questions
        // or they're already in quizData.questions
        const qs = startData.questions || quizData.questions || [];
        setQuestions(qs);

        // Rebuild local answers from existing response
        const localAnswers = {};
        if (resp.responses) {
          resp.responses.forEach(r => {
            if (r.question && r.studentAnswer !== null && r.studentAnswer !== undefined) {
              const qId = r.question._id || r.question;
              localAnswers[qId] = r.studentAnswer;
            }
          });
        }
        setAnswers(localAnswers);

        // Timer
        if (quizData.duration) {
          const elapsed = resp.startedAt
            ? Math.floor((Date.now() - new Date(resp.startedAt).getTime()) / 1000)
            : 0;
          const remaining = quizData.duration * 60 - elapsed;
          setTimeLeft(Math.max(0, remaining));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [quizId, started]);

  // ── Proctoring ─────────────────────────────────────────────────────────
  const handleTerminated = useCallback(() => {
    setTerminated(true);
  }, []);

  const {
    violations,
    maxViolations,
    warning,
    clearWarning,
    requestFullscreen,
    exitFullscreen,
  } = useQuizProctoring({
    responseId,
    active: started && !result && !terminated,
    onTerminated: handleTerminated,
  });

  const handleBegin = async () => {
    await requestFullscreen();
    setStarted(true);
  };

  // Leave fullscreen once the quiz is over, one way or another
  useEffect(() => {
    if (result || terminated) {
      exitFullscreen();
    }
  }, [result, terminated, exitFullscreen]);

  // ── Submit handler (memoised to be safe in timer callback) ───────────────
  const handleSubmitQuiz = useCallback(async () => {
    if (!responseId) return;
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const resultData = await quizAPI.submitQuiz(responseId);
      setResult(resultData);
      setTimeLeft(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [responseId]);

  // ── Timer countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft, result, handleSubmitQuiz]);

  // ── Save answer to server ──────────────────────────────────────────────
  const saveAnswer = async (questionId, value) => {
    if (!responseId) return;
    try {
      await quizAPI.saveResponse(responseId, { questionId, studentAnswer: value });
    } catch {
      // silent — we still have local state
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    // Debounce auto-save — save immediately for radio clicks, debounced for text
    saveAnswer(questionId, value);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const answeredCount = questions.filter(q => {
    const a = answers[q._id];
    return a !== null && a !== undefined && a !== "";
  }).length;

  // ── Pre-quiz proctoring gate ─────────────────────────────────────────────
  if (!started) {
    return (
      <div className="quiz-taker">
        <div style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto" }}>
          <div className="result-screen">
            <div style={{ fontSize: "3rem" }}>🔒</div>
            <h2>This quiz is proctored</h2>
            <p className="result-message">
              You must stay in fullscreen for the entire quiz. Switching tabs,
              minimizing the window, or exiting fullscreen counts as a violation.
              After 3 violations, your quiz will be automatically submitted.
            </p>
            <button
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}
              onClick={handleBegin}
            >
              Enter Fullscreen &amp; Begin Quiz
            </button>
            <button
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
              onClick={() => navigate("/student/dashboard")}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── States ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="quiz-taker">
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>Loading quiz…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-taker">
        <div style={{ padding: "2rem" }}>
          <div className="error-banner">{error}</div>
          <button className="btn-secondary" style={{ marginTop: "1rem" }} onClick={() => navigate("/student/dashboard")}>
            <IconArrowLeft /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Result Screen ─────────────────────────────────────────────────────────
  if (result) {
    const passed = result.isPassed;
    return (
      <div className="quiz-taker">
        <div className="quiz-header">
          <h1>{quiz?.title}</h1>
        </div>
        <div style={{ padding: "2rem" }}>
          <div className="result-screen">
            <div className={`result-icon ${passed ? "passed" : "failed"}`}>
              {passed ? "✓" : "✗"}
            </div>
            <h2>{passed ? "Congratulations! 🎉" : "Quiz Completed"}</h2>
            <p className="result-message">
              {passed ? "You have passed the quiz!" : "Better luck next time. Keep practising!"}
            </p>

            <div className="score-box">
              <div className="score-display">
                <div className="score-big">{result.score} / {result.totalMarks}</div>
                <div className="score-percentage">{result.percentage}%</div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <div className="progress-bar" style={{ height: "12px" }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${result.percentage}%`,
                      background: passed
                        ? "linear-gradient(90deg,#059669,#10b981)"
                        : "linear-gradient(90deg,#dc2626,#ef4444)"
                    }}
                  />
                </div>
              </div>
            </div>

            {result.hasShortAnswers && (
              <div className="info-box">
                ⓘ Your short-answer questions will be reviewed by your instructor. Your final marks
                may change after grading.
              </div>
            )}

            <button
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
              onClick={() => navigate("/student/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Terminated screen (auto-submitted after 3 proctoring violations) ────
  if (terminated) {
    return (
      <div className="quiz-taker">
        <div className="quiz-header">
          <h1>{quiz?.title}</h1>
        </div>
        <div style={{ padding: "2rem" }}>
          <div className="result-screen">
            <div className="result-icon failed">✗</div>
            <h2>Quiz Auto-Submitted</h2>
            <p className="result-message">
              Your quiz was automatically submitted after {maxViolations} proctoring
              violations. If you believe this was a mistake or caused by a technical
              issue, contact your instructor — they can grant you a reattempt.
            </p>
            <button
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
              onClick={() => navigate("/student/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="quiz-taker">
        <div className="loading-state">
          <span>No questions found for this quiz.</span>
          <button className="btn-secondary" onClick={() => navigate("/student/dashboard")}>Back</button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const currentAnswer = answers[currentQ._id];

  // ── Main Quiz UI ──────────────────────────────────────────────────────────
  return (
    <div className="quiz-taker">
      {/* Header */}
      <div className="quiz-header">
        <div>
          <h1>{quiz.title}</h1>
          <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.7)" }}>
            {quiz.subject} • {questions.length} questions
          </span>
        </div>
        {timeLeft !== null && (
          <div className={`timer ${timeLeft < 300 ? "warning" : ""}`}>
            <IconClock /> {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Progress bar (top) */}
      <div style={{ padding: "0.75rem 2rem 0", background: "white", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
            {answeredCount} / {questions.length} answered
          </span>
        </div>
        <div className="progress-bar" style={{ height: "6px", marginBottom: 0 }}>
          <div
            className="progress-fill"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="quiz-container">
        {/* ── Main Question Area ── */}
        <div>
          <div className="quiz-main">
            {/* Question */}
            <div className="question-section">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <div style={{
                  background: "#2563eb", color: "#fff", borderRadius: "50%",
                  width: "32px", height: "32px", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "0.85rem", fontWeight: "700", flexShrink: 0
                }}>
                  {currentIdx + 1}
                </div>
                <span style={{ fontSize: "0.78rem", color: "#64748b", background: "#f1f5f9", padding: "0.2rem 0.6rem", borderRadius: "100px", textTransform: "uppercase", fontWeight: "600" }}>
                  {currentQ.type === "mcq" ? "Multiple Choice" : currentQ.type === "truefalse" ? "True / False" : "Short Answer"}
                </span>
                <span style={{ fontSize: "0.78rem", color: "#059669", background: "#d1fae5", padding: "0.2rem 0.6rem", borderRadius: "100px", fontWeight: "600", marginLeft: "auto" }}>
                  {currentQ.marks} mark{currentQ.marks !== 1 ? "s" : ""}
                </span>
              </div>

              <h2 style={{ fontSize: "1.2rem", lineHeight: "1.5", marginBottom: "0.25rem" }}>
                {currentQ.questionText}
              </h2>
              <p className="question-marks" style={{ marginBottom: "1.5rem" }}>
                Select the best answer below
              </p>

              {/* ── MCQ ── */}
              {currentQ.type === "mcq" && (
                <div className="options-container">
                  {currentQ.options?.map((opt, idx) => {
                    const optVal = opt.text;
                    const isSelected = currentAnswer === optVal;
                    return (
                      <label
                        key={idx}
                        className="option"
                        style={isSelected ? { borderColor: "#2563eb", background: "#dbeafe" } : {}}
                      >
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "50%",
                          border: isSelected ? "6px solid #2563eb" : "2px solid #cbd5e1",
                          flexShrink: 0, cursor: "pointer", transition: "all .15s",
                          background: isSelected ? "#2563eb" : "white",
                          boxShadow: isSelected ? "0 0 0 3px rgba(37,99,235,.15)" : "none"
                        }} />
                        <span style={{ fontWeight: isSelected ? "600" : "400" }}>{optVal}</span>
                        <input
                          type="radio"
                          name={`q-${currentQ._id}`}
                          value={optVal}
                          checked={isSelected}
                          onChange={() => handleAnswerChange(currentQ._id, optVal)}
                          style={{ display: "none" }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* ── True/False ── */}
              {currentQ.type === "truefalse" && (
                <div className="true-false-container">
                  {[true, false].map(val => {
                    const isSelected = currentAnswer === val;
                    return (
                      <button
                        key={String(val)}
                        className={`btn-tf ${isSelected ? "selected" : ""}`}
                        onClick={() => handleAnswerChange(currentQ._id, val)}
                        type="button"
                      >
                        {val ? "✓ True" : "✗ False"}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Short Answer ── */}
              {currentQ.type === "shortanswer" && (
                <div className="short-answer-container">
                  <textarea
                    className="answer-textarea"
                    placeholder="Type your answer here..."
                    value={currentAnswer || ""}
                    onChange={e => handleAnswerChange(currentQ._id, e.target.value)}
                    rows="6"
                  />
                  {currentQ.modelAnswer && (
                    <div className="model-answer">
                      💡 <strong>Hint:</strong> {currentQ.modelAnswer}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Navigation ── */}
            <div className="quiz-nav">
              <button
                className="btn-secondary"
                onClick={() => setCurrentIdx(i => i - 1)}
                disabled={currentIdx === 0}
              >
                <IconArrowLeft /> Previous
              </button>

              <button
                className="btn-danger"
                style={{ background: "#dc2626", color: "#fff", border: "none", padding: "0.65rem 1.4rem", borderRadius: "8px" }}
                onClick={() => setShowConfirm(true)}
                disabled={submitting}
              >
                <IconCheck /> {submitting ? "Submitting…" : "Submit Quiz"}
              </button>

              <button
                className="btn-secondary"
                onClick={() => setCurrentIdx(i => i + 1)}
                disabled={currentIdx === questions.length - 1}
              >
                Next <IconArrowRight />
              </button>
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="quiz-sidebar">
          <h3>Question Map</h3>
          <div className="question-tracker">
            {questions.map((q, idx) => {
              const a = answers[q._id];
              const isAnswered = a !== null && a !== undefined && a !== "";
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q._id}
                  className={`tracker-btn ${isCurrent ? "current" : ""} ${isAnswered ? "answered" : ""}`}
                  onClick={() => setCurrentIdx(idx)}
                  title={q.questionText}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="tracker-legend">
            <div className="legend-item">
              <div className="legend-dot answered" /> Answered ({answeredCount})
            </div>
            <div className="legend-item">
              <div className="legend-dot unanswered" /> Unanswered ({questions.length - answeredCount})
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", padding: "0.85rem", background: "#f8fafc", borderRadius: "8px", fontSize: "0.82rem", color: "#64748b" }}>
            <div style={{ fontWeight: "600", color: "#334155", marginBottom: "0.4rem" }}>Quiz Info</div>
            <div>Subject: {quiz.subject}</div>
            {quiz.duration && <div>Duration: {quiz.duration} min</div>}
            <div>Total Marks: {quiz.totalMarks}</div>
            <div>Pass Marks: {quiz.passMarks}</div>
          </div>
        </aside>
      </div>

      {/* ── Proctoring Warning Modal ── */}
      {warning && !terminated && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Proctoring Warning</h2>
            </div>
            <div className="modal-body">
              <p style={{ textAlign: "center", color: "#64748b", marginBottom: "1rem" }}>
                {warning.reason}.
              </p>
              <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#78350f", textAlign: "center" }}>
                Violation {warning.count} of {maxViolations}. One more and your quiz will
                be automatically submitted.
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={async () => {
                  clearWarning();
                  await requestFullscreen();
                }}
              >
                Return to Fullscreen &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Confirmation Modal ── */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Quiz?</h2>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <div style={{ fontSize: "3rem" }}>📝</div>
              </div>
              <p style={{ textAlign: "center", color: "#64748b", marginBottom: "1rem" }}>
                You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              </p>
              {answeredCount < questions.length && (
                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#78350f" }}>
                  ⚠️ You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount !== 1 ? "s" : ""}. Once submitted, you cannot change your answers.
                </div>
              )}
              <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                Are you sure you want to submit?
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowConfirm(false)} disabled={submitting}>
                Continue Quiz
              </button>
              <button
                className="btn-primary"
                style={{ background: "#dc2626" }}
                onClick={handleSubmitQuiz}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizTaker;

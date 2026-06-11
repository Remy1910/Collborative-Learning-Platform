import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI, courseAPI } from "../utils/api";
import "../styles/dashboard.css";

// ── Icons ──────────────────────────────────────────────────────────────────
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);

function Spinner() { return <div className="spinner-ring" />; }

// Question type configs
const QTYPES = [
  { value: "mcq",          label: "Multiple Choice (MCQ)",  icon: "◉" },
  { value: "truefalse",    label: "True / False",           icon: "⇄" },
  { value: "shortanswer",  label: "Short Answer",            icon: "✏️" },
];

function QuizBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [quizId, setQuizId] = useState(null);
  const [courses, setCourses] = useState([]);

  // Step 1: Quiz Details
  const [quizDetails, setQuizDetails] = useState({
    title: "",
    subject: "",
    description: "",
    duration: "",
    dueDate: "",
    totalMarks: 100,
    passMarks: 40,
    courseId: "",
  });

  // Step 2: Questions
  const [questions, setQuestions] = useState([]);
  const defaultQuestion = {
    type: "mcq",
    questionText: "",
    marks: 1,
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    correctAnswer: null,
    modelAnswer: "",
  };
  const [currentQuestion, setCurrentQuestion] = useState(defaultQuestion);
  const [editingIdx, setEditingIdx] = useState(null); // index of question being edited in list

  useEffect(() => {
    courseAPI.getCourses()
      .then(data => {
        const userId = localStorage.getItem("userId");
        const mine = Array.isArray(data) ? data.filter(c => !c.faculty?._id || c.faculty?._id === userId || c.faculty === userId) : [];
        setCourses(mine);
      })
      .catch(() => {});
  }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

  // ── Step 1 ─────────────────────────────────────────────────────────────
  const handleDetailChange = (field, value) => {
    setQuizDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateQuiz = async () => {
    setError("");
    if (!quizDetails.title.trim()) { setError("Quiz title is required"); return; }
    if (!quizDetails.subject.trim()) { setError("Subject is required"); return; }

    try {
      setLoading(true);
      const payload = {
        title: quizDetails.title.trim(),
        subject: quizDetails.subject.trim(),
        description: quizDetails.description,
        duration: quizDetails.duration ? parseInt(quizDetails.duration) : null,
        dueDate: quizDetails.dueDate || null,
        totalMarks: parseInt(quizDetails.totalMarks) || 100,
        passMarks: parseInt(quizDetails.passMarks) || 40,
      };
      if (quizDetails.courseId) payload.courseId = quizDetails.courseId;

      const response = await quizAPI.createQuiz(payload);
      setQuizId(response.quiz._id);
      setStep(2);
      showMsg("Quiz created! Now add questions.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Question helpers ────────────────────────────────────────────────────
  const handleQuestionChange = (field, value) => {
    setCurrentQuestion(prev => {
      // reset type-specific fields on type change
      if (field === "type") {
        return {
          ...prev,
          type: value,
          options: value === "mcq"
            ? [{ text:"",isCorrect:false },{ text:"",isCorrect:false },{ text:"",isCorrect:false },{ text:"",isCorrect:false }]
            : prev.options,
          correctAnswer: null,
          modelAnswer: "",
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...currentQuestion.options];
    // For radio-style correct (single correct), uncheck others if checking this one
    if (field === "isCorrect" && value === true) {
      newOptions.forEach((o, i) => { newOptions[i] = { ...o, isCorrect: i === index }; });
    } else {
      newOptions[index] = { ...newOptions[index], [field]: value };
    }
    setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    if (currentQuestion.options.length >= 6) return;
    setCurrentQuestion(prev => ({ ...prev, options: [...prev.options, { text: "", isCorrect: false }] }));
  };

  const removeOption = (index) => {
    setCurrentQuestion(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const validateQuestion = () => {
    if (!currentQuestion.questionText.trim()) { setError("Question text is required"); return false; }
    if (currentQuestion.type === "mcq") {
      if (currentQuestion.options.filter(o => o.text.trim()).length < 2) { setError("At least 2 option texts are required"); return false; }
      if (!currentQuestion.options.some(o => o.isCorrect)) { setError("Mark at least one option as correct"); return false; }
    }
    if (currentQuestion.type === "truefalse" && currentQuestion.correctAnswer === null) {
      setError("Select the correct answer (True or False)"); return false;
    }
    return true;
  };

  const handleAddQuestion = async () => {
    setError("");
    if (!validateQuestion()) return;

    try {
      setLoading(true);
      await quizAPI.addQuestion(quizId, {
        type: currentQuestion.type,
        questionText: currentQuestion.questionText,
        marks: parseInt(currentQuestion.marks) || 1,
        options:       currentQuestion.type === "mcq"         ? currentQuestion.options.filter(o => o.text.trim()) : undefined,
        correctAnswer: currentQuestion.type === "truefalse"   ? currentQuestion.correctAnswer : undefined,
        modelAnswer:   currentQuestion.type === "shortanswer" ? currentQuestion.modelAnswer : undefined,
      });

      setQuestions(prev => [...prev, { ...currentQuestion }]);
      setCurrentQuestion(defaultQuestion);
      setError("");
      showMsg("Question added!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocalQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePublishQuiz = async () => {
    setError("");
    if (questions.length === 0) { setError("Add at least one question before publishing"); return; }

    try {
      setLoading(true);
      await quizAPI.publishQuiz(quizId);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    navigate("/faculty/dashboard");
  };

  // ── Progress bar ────────────────────────────────────────────────────────
  const steps = ["Quiz Details", "Add Questions", "Published!"];

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-logo">🎯</div>
          <div>
            <h1>Quiz Builder</h1>
            <span className="header-sub">Faculty Portal</span>
          </div>
        </div>
        <button className="btn-logout" onClick={() => navigate("/faculty/dashboard")}>
          <IconBack /> Back to Dashboard
        </button>
      </header>

      {/* Step Indicator */}
      <div className="step-indicator">
        {steps.map((s, i) => (
          <div key={s} className={`step-item ${step > i ? "done" : ""} ${step === i + 1 ? "active" : ""}`}>
            <div className="step-circle">{step > i + 1 ? <IconCheck /> : i + 1}</div>
            <span className="step-label">{s}</span>
            {i < steps.length - 1 && <div className="step-line" />}
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        {/* Alerts */}
        {error   && <div className="alert alert-error"   onClick={() => setError("")}  >{error}   <span>✕</span></div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess("")}>{success} <span>✕</span></div>}

        {/* ══ STEP 1: QUIZ DETAILS ════════════════════════════════════════ */}
        {step === 1 && (
          <div className="builder-form-card">
            <div className="builder-card-header">
              <h2>Step 1: Quiz Details</h2>
              <p>Fill in the details for your new quiz</p>
            </div>

            <div className="builder-form-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Quiz Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Chapter 5 Final Exam"
                    value={quizDetails.title}
                    onChange={e => handleDetailChange("title", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <input
                    type="text"
                    placeholder="e.g., Mathematics"
                    value={quizDetails.subject}
                    onChange={e => handleDetailChange("subject", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description / Instructions</label>
                <textarea
                  placeholder="Write instructions or a description for this quiz..."
                  value={quizDetails.description}
                  onChange={e => handleDetailChange("description", e.target.value)}
                  rows="4"
                />
              </div>

              {courses.length > 0 && (
                <div className="form-group">
                  <label>Link to Course (optional)</label>
                  <select
                    value={quizDetails.courseId}
                    onChange={e => handleDetailChange("courseId", e.target.value)}
                  >
                    <option value="">— No course link —</option>
                    {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave blank for untimed"
                    value={quizDetails.duration}
                    onChange={e => handleDetailChange("duration", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="datetime-local"
                    value={quizDetails.dueDate}
                    onChange={e => handleDetailChange("dueDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Total Marks</label>
                  <input
                    type="number"
                    min="1"
                    value={quizDetails.totalMarks}
                    onChange={e => handleDetailChange("totalMarks", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Pass Marks</label>
                  <input
                    type="number"
                    min="0"
                    value={quizDetails.passMarks}
                    onChange={e => handleDetailChange("passMarks", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions builder-actions">
              <button className="btn-secondary" onClick={() => navigate("/faculty/dashboard")}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateQuiz} disabled={loading}>
                {loading ? <Spinner /> : <><span>Next: Add Questions</span> <IconArrowRight /></>}
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 2: ADD QUESTIONS ════════════════════════════════════════ */}
        {step === 2 && (
          <div className="builder-step2">
            {/* Left: added questions */}
            <div className="questions-panel">
              <div className="questions-panel-header">
                <h3>Questions ({questions.length})</h3>
                <span className="text-muted small">
                  {questions.reduce((a, q) => a + (parseInt(q.marks) || 0), 0)} marks total
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="empty-questions">
                  <div style={{ fontSize: "2.5rem" }}>❓</div>
                  <p>No questions yet.<br />Add your first question →</p>
                </div>
              ) : (
                <div className="questions-list">
                  {questions.map((q, idx) => (
                    <div key={idx} className="question-item">
                      <div className="question-item-header">
                        <span className="q-number">Q{idx + 1}</span>
                        <span className="q-type-tag">{QTYPES.find(t => t.value === q.type)?.icon} {q.type.toUpperCase()}</span>
                        <span className="q-marks">{q.marks}M</span>
                        <button
                          className="q-delete"
                          onClick={() => handleDeleteLocalQuestion(idx)}
                          title="Remove question"
                        >
                          <IconTrash />
                        </button>
                      </div>
                      <p className="question-item-text">{q.questionText}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Publish section */}
              <div className="publish-box">
                <div className="publish-stats">
                  <div><strong>{questions.length}</strong> <span>Questions</span></div>
                  <div><strong>{questions.reduce((a, q) => a + (parseInt(q.marks) || 0), 0)}</strong> <span>Marks</span></div>
                </div>
                <button
                  className="btn-primary"
                  style={{ width: "100%" }}
                  onClick={handlePublishQuiz}
                  disabled={loading || questions.length === 0}
                >
                  {loading ? <Spinner /> : <><IconSend /> Publish Quiz</>}
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: "100%", marginTop: "0.5rem" }}
                  onClick={handleSaveDraft}
                >
                  Save as Draft
                </button>
              </div>
            </div>

            {/* Right: question form */}
            <div className="question-form-panel">
              <h3>Add New Question</h3>

              {/* Type selector */}
              <div className="qtype-selector">
                {QTYPES.map(type => (
                  <button
                    key={type.value}
                    className={`qtype-btn ${currentQuestion.type === type.value ? "active" : ""}`}
                    onClick={() => handleQuestionChange("type", type.value)}
                    type="button"
                  >
                    <span className="qtype-icon">{type.icon}</span>
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label>Question Text *</label>
                <textarea
                  placeholder="Enter your question here..."
                  value={currentQuestion.questionText}
                  onChange={e => handleQuestionChange("questionText", e.target.value)}
                  rows="3"
                />
              </div>

              <div className="form-group form-group-inline">
                <label>Marks</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={currentQuestion.marks}
                  onChange={e => handleQuestionChange("marks", e.target.value)}
                  style={{ maxWidth: "120px" }}
                />
              </div>

              {/* MCQ Options */}
              {currentQuestion.type === "mcq" && (
                <div className="options-section">
                  <label>Answer Options *</label>
                  <p className="options-hint">Click the circle to mark the correct answer</p>
                  {currentQuestion.options.map((option, idx) => (
                    <div key={idx} className="option-input-row">
                      <button
                        className={`correct-toggle ${option.isCorrect ? "correct" : ""}`}
                        type="button"
                        onClick={() => handleOptionChange(idx, "isCorrect", true)}
                        title="Mark as correct"
                      >
                        {option.isCorrect ? <IconCheck /> : <span>{idx + 1}</span>}
                      </button>
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={option.text}
                        onChange={e => handleOptionChange(idx, "text", e.target.value)}
                      />
                      {currentQuestion.options.length > 2 && (
                        <button className="option-delete" onClick={() => removeOption(idx)} type="button">
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  ))}
                  {currentQuestion.options.length < 6 && (
                    <button className="btn-secondary btn-small" onClick={addOption} type="button">
                      <IconPlus /> Add Option
                    </button>
                  )}
                </div>
              )}

              {/* True/False */}
              {currentQuestion.type === "truefalse" && (
                <div className="tf-section">
                  <label>Correct Answer *</label>
                  <div className="tf-buttons">
                    <button
                      className={`tf-btn ${currentQuestion.correctAnswer === true ? "selected" : ""}`}
                      onClick={() => handleQuestionChange("correctAnswer", true)}
                      type="button"
                    >
                      ✓ True
                    </button>
                    <button
                      className={`tf-btn ${currentQuestion.correctAnswer === false ? "selected" : ""}`}
                      onClick={() => handleQuestionChange("correctAnswer", false)}
                      type="button"
                    >
                      ✗ False
                    </button>
                  </div>
                </div>
              )}

              {/* Short Answer */}
              {currentQuestion.type === "shortanswer" && (
                <div className="form-group">
                  <label>Model Answer <span className="text-muted">(optional — shown as hint)</span></label>
                  <textarea
                    placeholder="Provide an example or hint for expected answer..."
                    value={currentQuestion.modelAnswer}
                    onChange={e => handleQuestionChange("modelAnswer", e.target.value)}
                    rows="3"
                  />
                </div>
              )}

              <button
                className="btn-primary add-question-btn"
                onClick={handleAddQuestion}
                disabled={loading}
              >
                {loading ? <Spinner /> : <><IconPlus /> Add Question</>}
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 3: SUCCESS ══════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="success-screen">
            <div className="success-icon">🎉</div>
            <h2>Quiz Published Successfully!</h2>
            <p>Your quiz <strong>"{quizDetails.title}"</strong> is now live with {questions.length} question{questions.length !== 1 ? "s" : ""}.</p>
            <div className="success-stats">
              <div className="success-stat">
                <div className="s-num">{questions.length}</div>
                <div className="s-lbl">Questions</div>
              </div>
              <div className="success-stat">
                <div className="s-num">{quizDetails.totalMarks}</div>
                <div className="s-lbl">Total Marks</div>
              </div>
              <div className="success-stat">
                <div className="s-num">{quizDetails.duration || "∞"}</div>
                <div className="s-lbl">Minutes</div>
              </div>
            </div>
            <div className="success-actions">
              <button className="btn-secondary" onClick={() => { setStep(1); setQuizDetails({ title:"",subject:"",description:"",duration:"",dueDate:"",totalMarks:100,passMarks:40,courseId:"" }); setQuestions([]); setQuizId(null); }}>
                Create Another Quiz
              </button>
              <button className="btn-primary" onClick={() => navigate("/faculty/dashboard")}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default QuizBuilder;

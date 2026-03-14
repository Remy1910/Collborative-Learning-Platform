import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI } from "../utils/api";
import "../styles/dashboard.css";

// Icons
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

function QuizBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quizId, setQuizId] = useState(null);

  // Step 1: Quiz Details
  const [quizDetails, setQuizDetails] = useState({
    title: "",
    subject: "",
    description: "",
    duration: "",
    dueDate: "",
    totalMarks: 100,
    passMarks: 40,
  });

  // Step 2: Questions
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
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
  });

  // Handle Step 1: Quiz Details
  const handleDetailChange = (field, value) => {
    setQuizDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateQuiz = async () => {
    if (!quizDetails.title || !quizDetails.subject) {
      setError("Title and subject are required");
      return;
    }

    try {
      setLoading(true);
      const response = await quizAPI.createQuiz({
        title: quizDetails.title,
        subject: quizDetails.subject,
        description: quizDetails.description,
        duration: quizDetails.duration ? parseInt(quizDetails.duration) : null,
        dueDate: quizDetails.dueDate,
        totalMarks: parseInt(quizDetails.totalMarks),
        passMarks: parseInt(quizDetails.passMarks),
      });
      setQuizId(response.quiz._id);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Questions
  const handleQuestionChange = (field, value) => {
    setCurrentQuestion((prev) => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setCurrentQuestion((prev) => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setCurrentQuestion((prev) => ({
      ...prev,
      options: [...prev.options, { text: "", isCorrect: false }],
    }));
  };

  const removeOption = (index) => {
    setCurrentQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const validateQuestion = () => {
    if (!currentQuestion.questionText) {
      setError("Question text is required");
      return false;
    }

    if (currentQuestion.type === "mcq") {
      if (currentQuestion.options.length < 2) {
        setError("MCQ must have at least 2 options");
        return false;
      }
      if (!currentQuestion.options.some((o) => o.isCorrect)) {
        setError("At least one option must be marked as correct");
        return false;
      }
    }

    if (currentQuestion.type === "truefalse" && currentQuestion.correctAnswer === null) {
      setError("True/False must have a correct answer");
      return false;
    }

    return true;
  };

  const handleAddQuestion = async () => {
    if (!validateQuestion()) return;

    try {
      setLoading(true);
      await quizAPI.addQuestion(quizId, {
        type: currentQuestion.type,
        questionText: currentQuestion.questionText,
        marks: parseInt(currentQuestion.marks),
        options: currentQuestion.type === "mcq" ? currentQuestion.options : undefined,
        correctAnswer: currentQuestion.type === "truefalse" ? currentQuestion.correctAnswer : undefined,
        modelAnswer: currentQuestion.type === "shortanswer" ? currentQuestion.modelAnswer : undefined,
      });

      setQuestions((prev) => [...prev, currentQuestion]);
      setCurrentQuestion({
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
      });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishQuiz = async () => {
    if (questions.length === 0) {
      setError("Quiz must have at least one question");
      return;
    }

    try {
      setLoading(true);
      await quizAPI.publishQuiz(quizId);
      alert("Quiz published successfully!");
      navigate("/faculty/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1>🎯 Quiz Builder</h1>
        <button className="btn-logout" onClick={() => navigate("/faculty/dashboard")}>
          Back
        </button>
      </header>

      <div className="dashboard-content">
        {error && <div className="error-banner">{error}</div>}

        {/* STEP 1: Quiz Details */}
        {step === 1 && (
          <div className="quiz-builder-form">
            <h2>Step 1: Quiz Details</h2>
            <p className="step-description">Create a new quiz by filling in the details below</p>

            <div className="form-group">
              <label>Quiz Title *</label>
              <input
                type="text"
                placeholder="e.g., Chapter 5 Final Exam"
                value={quizDetails.title}
                onChange={(e) => handleDetailChange("title", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <input
                type="text"
                placeholder="e.g., Mathematics"
                value={quizDetails.subject}
                onChange={(e) => handleDetailChange("subject", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Quiz description and instructions"
                value={quizDetails.description}
                onChange={(e) => handleDetailChange("description", e.target.value)}
                rows="4"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  placeholder="Optional, leave blank for untimed"
                  value={quizDetails.duration}
                  onChange={(e) => handleDetailChange("duration", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="datetime-local"
                  value={quizDetails.dueDate}
                  onChange={(e) => handleDetailChange("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Marks</label>
                <input
                  type="number"
                  value={quizDetails.totalMarks}
                  onChange={(e) => handleDetailChange("totalMarks", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Pass Marks</label>
                <input
                  type="number"
                  value={quizDetails.passMarks}
                  onChange={(e) => handleDetailChange("passMarks", e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => navigate("/faculty/dashboard")}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateQuiz} disabled={loading}>
                {loading ? "Creating..." : "Next: Add Questions"} <IconArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Questions */}
        {step === 2 && (
          <div className="quiz-builder-questions">
            <h2>Step 2: Add Questions</h2>
            <p className="step-description">Add questions to your quiz</p>

            {/* Added Questions List */}
            {questions.length > 0 && (
              <div className="questions-added">
                <h3>Questions Added ({questions.length})</h3>
                {questions.map((q, idx) => (
                  <div key={idx} className="question-preview">
                    <div className="question-preview-header">
                      <span className="question-number">Q{idx + 1}</span>
                      <span className="question-type">{q.type.toUpperCase()}</span>
                      <span className="question-marks">{q.marks}M</span>
                    </div>
                    <p className="question-text">{q.questionText}</p>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => {
                        setQuestions((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <IconTrash /> Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Current Question Form */}
            <div className="question-form">
              <h3>Add New Question</h3>

              <div className="form-group">
                <label>Question Type *</label>
                <select
                  value={currentQuestion.type}
                  onChange={(e) => handleQuestionChange("type", e.target.value)}
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="truefalse">True / False</option>
                  <option value="shortanswer">Short Answer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Question Text *</label>
                <textarea
                  placeholder="Enter your question"
                  value={currentQuestion.questionText}
                  onChange={(e) => handleQuestionChange("questionText", e.target.value)}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Marks</label>
                <input
                  type="number"
                  min="1"
                  value={currentQuestion.marks}
                  onChange={(e) => handleQuestionChange("marks", e.target.value)}
                />
              </div>

              {/* MCQ Options */}
              {currentQuestion.type === "mcq" && (
                <div className="options-section">
                  <label>Options *</label>
                  {currentQuestion.options.map((option, idx) => (
                    <div key={idx} className="option-input">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={option.text}
                        onChange={(e) => handleOptionChange(idx, "text", e.target.value)}
                      />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={option.isCorrect}
                          onChange={(e) => handleOptionChange(idx, "isCorrect", e.target.checked)}
                        />
                        Correct
                      </label>
                      {currentQuestion.options.length > 2 && (
                        <button
                          className="btn-small btn-danger"
                          onClick={() => removeOption(idx)}
                          type="button"
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  ))}
                  {currentQuestion.options.length < 6 && (
                    <button className="btn-secondary" onClick={addOption} type="button">
                      <IconPlus /> Add Option
                    </button>
                  )}
                </div>
              )}

              {/* True/False */}
              {currentQuestion.type === "truefalse" && (
                <div className="form-group">
                  <label>Correct Answer *</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        name="tfAnswer"
                        checked={currentQuestion.correctAnswer === true}
                        onChange={() => handleQuestionChange("correctAnswer", true)}
                      />
                      True
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="tfAnswer"
                        checked={currentQuestion.correctAnswer === false}
                        onChange={() => handleQuestionChange("correctAnswer", false)}
                      />
                      False
                    </label>
                  </div>
                </div>
              )}

              {/* Short Answer */}
              {currentQuestion.type === "shortanswer" && (
                <div className="form-group">
                  <label>Model Answer (hints for students)</label>
                  <textarea
                    placeholder="Provide hints or expected answer outline"
                    value={currentQuestion.modelAnswer}
                    onChange={(e) => handleQuestionChange("modelAnswer", e.target.value)}
                    rows="3"
                  />
                </div>
              )}

              <div className="form-actions">
                <button className="btn-secondary" onClick={handleAddQuestion} disabled={loading}>
                  <IconPlus /> {loading ? "Adding..." : "Add Question"}
                </button>
              </div>
            </div>

            {/* Publish Actions */}
            <div className="publish-section">
              <h3>Quiz Complete?</h3>
              <p>You have added {questions.length} question{questions.length !== 1 ? "s" : ""}</p>
              <div className="form-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  <IconArrowLeft /> Edit Details
                </button>
                <button
                  className="btn-primary"
                  onClick={handlePublishQuiz}
                  disabled={loading || questions.length === 0}
                >
                  <IconCheck /> Publish Quiz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizBuilder;

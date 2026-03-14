import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI } from "../utils/api";
import "../styles/dashboard.css";

// Icons
const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconFileText = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
);

const IconAward = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="7"/><polyline points="8 14 12 17 16 14"/><line x1="12" y1="17" x2="12" y2="23"/><line x1="9" y1="20" x2="15" y2="20"/>
  </svg>
);

const IconLogOut = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

function StudentDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      if (activeTab === "dashboard") {
        const quizzesData = await quizAPI.getAssignedQuizzes();
        setQuizzes(quizzesData);
      } else if (activeTab === "results") {
        const resultsData = await quizAPI.getMyResults();
        setResults(resultsData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeTab]);

  const handleStartQuiz = (quizId) => {
    navigate(`/quiz/${quizId}/take`);
  };

  const handleLogOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  const getUpcomingQuizzes = () => {
    const now = new Date();
    return quizzes.filter(q => new Date(q.dueDate) > now && q.submissionStatus === "notStarted");
  };

  const getSubmittedQuizzes = () => {
    return quizzes.filter(q => q.submissionStatus !== "notStarted");
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1>📖 Student Dashboard</h1>
        <button className="btn-logout" onClick={handleLogOut}>
          <IconLogOut /> Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <IconHome /> Dashboard
        </button>
        <button
          className={`tab ${activeTab === "my-quizzes" ? "active" : ""}`}
          onClick={() => setActiveTab("my-quizzes")}
        >
          <IconFileText /> My Quizzes
        </button>
        <button
          className={`tab ${activeTab === "results" ? "active" : ""}`}
          onClick={() => setActiveTab("results")}
        >
          <IconAward /> Results
        </button>
      </div>

      {/* Error message */}
      {error && <div className="error-banner">{error}</div>}

      {/* Tab Content */}
      <div className="dashboard-content">
        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <div className="tab-content">
            <h2>Dashboard</h2>

            <div className="dashboard-section">
              <h3>📌 Upcoming Quizzes</h3>
              {loading ? (
                <p>Loading...</p>
              ) : getUpcomingQuizzes().length === 0 ? (
                <p className="empty-state">No upcoming quizzes</p>
              ) : (
                <div className="quiz-cards">
                  {getUpcomingQuizzes().map((quiz) => (
                    <div key={quiz._id} className="quiz-card">
                      <div className="quiz-card-header">
                        <h4>{quiz.title}</h4>
                        <span className="badge badge-upcoming">Upcoming</span>
                      </div>
                      <p className="quiz-subject">{quiz.subject}</p>
                      <div className="quiz-details">
                        <span>
                          <IconClock /> Due: {new Date(quiz.dueDate).toLocaleDateString()}
                        </span>
                        <span>{quiz.duration ? `${quiz.duration} min` : "Untimed"}</span>
                      </div>
                      <button
                        className="btn-primary"
                        onClick={() => handleStartQuiz(quiz._id)}
                      >
                        <IconPlay /> Start Quiz
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-section" style={{ marginTop: "2rem" }}>
              <h3>📊 Recent Scores</h3>
              {results.slice(0, 3).map((result) => (
                <div key={result.quizId} className="score-item">
                  <div className="score-info">
                    <h5>{result.quizTitle}</h5>
                    <p className="score-date">{new Date(result.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="score-display">
                    <div className="score-value">{result.score}/{result.maxScore}</div>
                    <div className="score-percentage">{result.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MY QUIZZES TAB */}
        {activeTab === "my-quizzes" && (
          <div className="tab-content">
            <h2>My Quizzes</h2>

            <div className="quiz-list">
              {loading ? (
                <p>Loading...</p>
              ) : quizzes.length === 0 ? (
                <p className="empty-state">No quizzes assigned yet</p>
              ) : (
                quizzes.map((quiz) => (
                  <div key={quiz._id} className="quiz-row">
                    <div className="quiz-row-info">
                      <h4>{quiz.title}</h4>
                      <p className="quiz-subject">{quiz.subject} • {quiz.totalMarks} marks</p>
                    </div>
                    <div className="quiz-row-status">
                      <span className={`status-badge status-${quiz.submissionStatus}`}>
                        {quiz.submissionStatus === "notStarted"
                          ? "Not Started"
                          : quiz.submissionStatus === "inprogress"
                          ? "In Progress"
                          : "Submitted"}
                      </span>
                      {quiz.score && <span className="quiz-score">{quiz.score} / {quiz.totalMarks}</span>}
                    </div>
                    {quiz.submissionStatus === "notStarted" && (
                      <button
                        className="btn-primary"
                        onClick={() => handleStartQuiz(quiz._id)}
                      >
                        Start
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === "results" && (
          <div className="tab-content">
            <h2>Results</h2>

            {loading ? (
              <p>Loading...</p>
            ) : results.length === 0 ? (
              <p className="empty-state">No quiz results yet</p>
            ) : (
              <div className="results-list">
                {results.map((result) => (
                  <div key={result.quizId} className="result-card">
                    <div className="result-header">
                      <h4>{result.quizTitle}</h4>
                      <span className={`badge ${result.passed ? "badge-pass" : "badge-fail"}`}>
                        {result.passed ? "✓ Passed" : "✗ Failed"}
                      </span>
                    </div>
                    <p className="result-subject">{result.subject}</p>
                    <div className="result-score">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${result.percentage}%`,
                            backgroundColor: result.passed ? "#4CAF50" : "#f44336",
                          }}
                        />
                      </div>
                      <div className="result-text">
                        {result.score} / {result.maxScore} ({result.percentage}%)
                      </div>
                    </div>
                    <p className="result-date">
                      Submitted: {new Date(result.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;

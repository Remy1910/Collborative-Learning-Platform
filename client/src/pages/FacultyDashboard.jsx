import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI, courseAPI } from "../utils/api";
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

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconLogOut = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

function FacultyDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [quizzes, setQuizzes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const quizzesData = await quizAPI.getMyQuizzes();
      setQuizzes(quizzesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = () => {
    navigate("/faculty/quiz-builder");
  };

  const handleLogOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  const handleDeleteQuiz = async (quizId) => {
    if (window.confirm("Are you sure you want to delete this quiz?")) {
      try {
        await quizAPI.deleteQuiz(quizId);
        loadDashboardData();
      } catch (err) {
        alert("Error deleting quiz: " + err.message);
      }
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1>📚 Faculty Dashboard</h1>
        <button className="btn-logout" onClick={handleLogOut}>
          <IconLogOut /> Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <IconHome /> Overview
        </button>
        <button
          className={`tab ${activeTab === "quizzes" ? "active" : ""}`}
          onClick={() => setActiveTab("quizzes")}
        >
          <IconFileText /> Quizzes
        </button>
        <button
          className={`tab ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          <IconUsers /> Students
        </button>
        <button
          className={`tab ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          <IconBarChart /> Analytics
        </button>
      </div>

      {/* Error message */}
      {error && <div className="error-banner">{error}</div>}

      {/* Tab Content */}
      <div className="dashboard-content">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="tab-content">
            <h2>Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{quizzes.length}</div>
                <div className="stat-label">Total Quizzes</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{quizzes.filter(q => q.status === "active").length}</div>
                <div className="stat-label">Active Quizzes</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{quizzes.filter(q => q.status === "draft").length}</div>
                <div className="stat-label">Draft Quizzes</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{quizzes.filter(q => q.isPublished).length}</div>
                <div className="stat-label">Published</div>
              </div>
            </div>

            <h3 style={{ marginTop: "2rem" }}>Recent Quizzes</h3>
            <div className="quiz-list-preview">
              {quizzes.slice(0, 5).map((quiz) => (
                <div key={quiz._id} className="quiz-item">
                  <div className="quiz-info">
                    <h4>{quiz.title}</h4>
                    <p className="quiz-subject">{quiz.subject}</p>
                    <span className={`status-badge status-${quiz.status}`}>
                      {quiz.status}
                    </span>
                  </div>
                  <div className="quiz-meta">
                    <span>{quiz.totalQuestions} questions</span>
                    <span>{quiz.totalMarks} marks</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUIZZES TAB */}
        {activeTab === "quizzes" && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Quizzes</h2>
              <button className="btn-primary" onClick={handleCreateQuiz}>
                <IconPlus /> Create Quiz
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : quizzes.length === 0 ? (
              <p className="empty-state">No quizzes yet. Create one to get started!</p>
            ) : (
              <div className="quiz-table-wrapper">
                <table className="quiz-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Subject</th>
                      <th>Questions</th>
                      <th>Marks</th>
                      <th>Status</th>
                      <th>Published</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map((quiz) => (
                      <tr key={quiz._id}>
                        <td>{quiz.title}</td>
                        <td>{quiz.subject}</td>
                        <td>{quiz.totalQuestions}</td>
                        <td>{quiz.totalMarks}</td>
                        <td>
                          <span className={`status-badge status-${quiz.status}`}>
                            {quiz.status}
                          </span>
                        </td>
                        <td>{quiz.isPublished ? "✓" : "✗"}</td>
                        <td className="actions">
                          <button className="btn-small">Edit</button>
                          <button className="btn-small btn-danger" onClick={() => handleDeleteQuiz(quiz._id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === "students" && (
          <div className="tab-content">
            <h2>Students</h2>
            <div className="search-box">
              <input type="text" placeholder="Search students..." />
            </div>
            <p style={{ color: "#999", marginTop: "2rem" }}>Student management feature coming soon...</p>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="tab-content">
            <h2>Analytics</h2>
            <p style={{ color: "#999", marginTop: "2rem" }}>Analytics and detailed reports coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FacultyDashboard;

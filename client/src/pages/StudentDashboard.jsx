import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI, courseAPI, assignmentAPI, authAPI } from "../utils/api";
import "../styles/dashboard.css";

// ── Icons ──────────────────────────────────────────────────────────────────
const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
);
const IconBook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);
const IconQuiz = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
);
const IconClip = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
);
const IconAward = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7" /><polyline points="8 14 12 17 16 14" /><line x1="12" y1="17" x2="12" y2="23" /><line x1="9" y1="20" x2="15" y2="20" /></svg>
);
const IconLogOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);
const IconPlay = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
);
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);

function Spinner() {
  return <div className="spinner-ring" />;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal${wide ? " modal-wide" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StudentDashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Student";
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [courses, setCourses] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);

  // Loading / alerts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submitContent, setSubmitContent] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => { loadTabData(); }, [activeTab]);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3500); };

  const loadTabData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "dashboard" || activeTab === "my-quizzes") {
        const q = await quizAPI.getAssignedQuizzes().catch(() => []);
        setQuizzes(Array.isArray(q) ? q : []);
      }
      if (activeTab === "results") {
        const r = await quizAPI.getMyResults().catch(() => []);
        setResults(Array.isArray(r) ? r : []);
      }
      if (activeTab === "courses") {
        const c = await courseAPI.getCourses().catch(() => []);
        setCourses(Array.isArray(c) ? c : []);
      }
      if (activeTab === "assignments") {
        const [q, s] = await Promise.all([
          quizAPI.getAssignedQuizzes().catch(() => []),
          assignmentAPI.getMySubmissions().catch(() => []),
        ]);
        setQuizzes(Array.isArray(q) ? q : []);
        setMySubmissions(Array.isArray(s) ? s : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Also load results for dashboard quick view
  useEffect(() => {
    if (activeTab === "dashboard") {
      quizAPI.getMyResults().then(r => setResults(Array.isArray(r) ? r : [])).catch(() => { });
    }
  }, [activeTab]);

  const handleEnroll = async (courseId) => {
    setEnrolling(true);
    try {
      await courseAPI.enrollCourse(courseId);
      showMsg("Successfully enrolled in course!");
      setShowEnrollModal(false);
      // Refresh courses
      const c = await courseAPI.getCourses().catch(() => []);
      setCourses(Array.isArray(c) ? c : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!submitContent.trim()) { setError("Please enter your submission content"); return; }
    try {
      setLoading(true);
      await assignmentAPI.submitAssignment({ assignmentId: selectedAssignment._id, content: submitContent });
      showMsg("Assignment submitted successfully!");
      setShowSubmitModal(false);
      setSubmitContent("");
      loadTabData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      // ignore — token may already be invalid/expired, still clear locally
    } finally {
      ["token", "role", "userId", "userName"].forEach(k => localStorage.removeItem(k));
      navigate("/");
    }
  };

  const userId = localStorage.getItem("userId");
  const enrolledCourses = courses.filter(c =>
    c.students?.some(s => (s._id || s) === userId)
  );
  const availableCourses = courses.filter(c =>
    !c.students?.some(s => (s._id || s) === userId)
  );

  const upcomingQuizzes = quizzes.filter(q => q.submissionStatus === "notStarted");
  const submittedQuizzes = quizzes.filter(q => q.submissionStatus !== "notStarted");

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-logo">📖</div>
          <div>
            <h1>CampusLink</h1>
            <span className="header-sub">Student Portal</span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-chip">
            <div className="user-avatar" style={{ background: "#7c3aed" }}>{userName[0]?.toUpperCase()}</div>
            <span>{userName}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}><IconLogOut /> Logout</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="dashboard-tabs">
        {[
          { id: "dashboard", label: "Dashboard", icon: <IconHome /> },
          { id: "courses", label: "Courses", icon: <IconBook /> },
          { id: "my-quizzes", label: "My Quizzes", icon: <IconQuiz /> },
          { id: "assignments", label: "Assignments", icon: <IconClip /> },
          { id: "results", label: "Results", icon: <IconAward /> },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Alerts ── */}
      <div style={{ padding: "0 2rem" }}>
        {error && <div className="alert alert-error" onClick={() => setError("")}  >{error}   <span className="alert-close">✕</span></div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess("")}>{success} <span className="alert-close">✕</span></div>}
      </div>

      <div className="dashboard-content">

        {/* ══ DASHBOARD ═════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div className="tab-content">
            <div className="page-title">
              <h2>Welcome back, {userName} 👋</h2>
              <p className="page-sub">Here's your learning overview for today.</p>
            </div>

            <div className="stats-grid">
              {[
                { label: "Enrolled Courses", value: enrolledCourses.length || "—", color: "#2563eb", icon: "📚" },
                { label: "Assigned Quizzes", value: quizzes.length, color: "#7c3aed", icon: "📝" },
                { label: "Pending Quizzes", value: upcomingQuizzes.length, color: "#d97706", icon: "⏳" },
                { label: "Completed Quizzes", value: submittedQuizzes.length, color: "#059669", icon: "✅" },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ borderTop: `4px solid ${s.color}` }}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="overview-grid">
              {/* Upcoming quizzes */}
              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>⏳ Upcoming Quizzes</h3>
                  <button className="btn-link" onClick={() => setActiveTab("my-quizzes")}>View all →</button>
                </div>
                {loading ? <Spinner /> : upcomingQuizzes.length === 0 ? (
                  <div className="empty-mini">🎉 No pending quizzes</div>
                ) : (
                  <div className="mini-list">
                    {upcomingQuizzes.slice(0, 4).map(q => (
                      <div key={q._id} className="mini-item">
                        <div>
                          <div className="mini-title">{q.title}</div>
                          <div className="mini-sub">
                            {q.subject} {q.dueDate ? `• Due ${new Date(q.dueDate).toLocaleDateString()}` : ""}
                          </div>
                        </div>
                        <button className="btn-primary btn-small" onClick={() => navigate(`/quiz/${q._id}/take`)}>
                          <IconPlay /> Start
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent scores */}
              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>📊 Recent Scores</h3>
                  <button className="btn-link" onClick={() => setActiveTab("results")}>View all →</button>
                </div>
                {results.length === 0 ? (
                  <div className="empty-mini">No results yet</div>
                ) : (
                  <div className="mini-list">
                    {results.slice(0, 4).map(r => (
                      <div key={r.quizId || r._id} className="mini-item">
                        <div>
                          <div className="mini-title">{r.quizTitle}</div>
                          <div className="mini-sub">{r.subject}</div>
                        </div>
                        <div className="score-chip" style={{ background: r.passed ? "#d1fae5" : "#fee2e2", color: r.passed ? "#065f46" : "#7f1d1d" }}>
                          {r.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ COURSES ═══════════════════════════════════════════════════════ */}
        {activeTab === "courses" && (
          <div className="tab-content">
            <div className="page-title">
              <h2>Courses</h2>
              <p className="page-sub">Browse and enroll in available courses</p>
            </div>

            {loading ? <Spinner /> : (
              <>
                {/* Enrolled courses */}
                <div className="section-header">
                  <h3>📚 My Enrolled Courses ({enrolledCourses.length})</h3>
                </div>
                {enrolledCourses.length === 0 ? (
                  <div className="empty-mini" style={{ marginBottom: "2rem" }}>You haven't enrolled in any courses yet.</div>
                ) : (
                  <div className="course-grid" style={{ marginBottom: "2.5rem" }}>
                    {enrolledCourses.map(c => (
                      <div key={c._id} className="course-card enrolled">
                        <div className="course-card-top">
                          <div className="course-icon">📖</div>
                          <span className="badge badge-active">Enrolled ✓</span>
                        </div>
                        <h3 className="course-title">{c.title}</h3>
                        <p className="course-desc">{c.description || "No description."}</p>
                        <div className="course-stats">
                          <div className="course-stat">
                            <span className="course-stat-num">{c.students?.length || 0}</span>
                            <span className="course-stat-lbl">Peers</span>
                          </div>
                          <div className="course-stat">
                            <span className="course-stat-num">{c.faculty?.name || "Faculty"}</span>
                            <span className="course-stat-lbl">Instructor</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Available courses */}
                <div className="section-header">
                  <h3>🔍 Available Courses ({availableCourses.length})</h3>
                </div>
                {availableCourses.length === 0 ? (
                  <div className="empty-mini">No new courses available right now.</div>
                ) : (
                  <div className="course-grid">
                    {availableCourses.map(c => (
                      <div key={c._id} className="course-card">
                        <div className="course-card-top">
                          <div className="course-icon">📖</div>
                          <span className="badge badge-draft">Available</span>
                        </div>
                        <h3 className="course-title">{c.title}</h3>
                        <p className="course-desc">{c.description || "No description."}</p>
                        <div className="course-stats">
                          <div className="course-stat">
                            <span className="course-stat-num">{c.students?.length || 0}</span>
                            <span className="course-stat-lbl">Enrolled</span>
                          </div>
                          <div className="course-stat">
                            <span className="course-stat-num">{c.faculty?.name || "Faculty"}</span>
                            <span className="course-stat-lbl">Instructor</span>
                          </div>
                        </div>
                        <div className="course-actions">
                          <button
                            className="btn-primary"
                            style={{ width: "100%" }}
                            onClick={() => handleEnroll(c._id)}
                            disabled={enrolling}
                          >
                            {enrolling ? <Spinner /> : "Enroll Now"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ MY QUIZZES ════════════════════════════════════════════════════ */}
        {activeTab === "my-quizzes" && (
          <div className="tab-content">
            <div className="page-title">
              <h2>My Quizzes</h2>
              <p className="page-sub">All quizzes assigned to you</p>
            </div>

            {loading ? <Spinner /> : quizzes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No quizzes assigned</h3>
                <p>Your instructor hasn't assigned any quizzes yet.</p>
              </div>
            ) : (
              <>
                {/* Pending */}
                {upcomingQuizzes.length > 0 && (
                  <>
                    <h3 className="section-label">⏳ Pending ({upcomingQuizzes.length})</h3>
                    <div className="quiz-cards" style={{ marginBottom: "2rem" }}>
                      {upcomingQuizzes.map(q => (
                        <div key={q._id} className="quiz-card">
                          <div className="quiz-card-header">
                            <h4>{q.title}</h4>
                            <span className="badge badge-warning">Pending</span>
                          </div>
                          <p className="quiz-subject">{q.subject}</p>
                          <div className="quiz-details">
                            {q.dueDate && (
                              <span><IconClock /> Due: {new Date(q.dueDate).toLocaleDateString()}</span>
                            )}
                            <span>⏱ {q.duration ? `${q.duration} min` : "Untimed"}</span>
                            <span>📊 {q.totalMarks} marks</span>
                          </div>
                          <button
                            className="btn-primary"
                            style={{ width: "100%", marginTop: "1rem" }}
                            onClick={() => navigate(`/quiz/${q._id}/take`)}
                          >
                            <IconPlay /> Start Quiz
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Submitted */}
                {submittedQuizzes.length > 0 && (
                  <>
                    <h3 className="section-label">✅ Submitted ({submittedQuizzes.length})</h3>
                    <div className="quiz-list">
                      {submittedQuizzes.map(q => (
                        <div key={q._id} className="quiz-row">
                          <div className="quiz-row-info">
                            <h4>{q.title}</h4>
                            <p className="quiz-subject">{q.subject} • {q.totalMarks} marks</p>
                          </div>
                          <div className="quiz-row-status">
                            <span className={`badge badge-${q.submissionStatus === "submitted" ? "active" : "draft"}`}>
                              {q.submissionStatus === "submitted" ? "Submitted" : "In Progress"}
                            </span>
                            {q.score != null && (
                              <span className="quiz-score">{q.score} / {q.totalMarks}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ ASSIGNMENTS ═══════════════════════════════════════════════════ */}
        {activeTab === "assignments" && (
          <div className="tab-content">
            <div className="page-title">
              <h2>Assignments</h2>
              <p className="page-sub">Submit your assignments and track your grades</p>
            </div>

            {loading ? <Spinner /> : mySubmissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No assignments yet</h3>
                <p>Your instructor hasn't assigned any assignments yet. Enroll in courses to see assignments.</p>
              </div>
            ) : (
              <div className="assignment-list-student">
                {mySubmissions.map(sub => (
                  <div key={sub._id} className="assignment-card-student">
                    <div className="assignment-left">
                      <div className="assignment-icon">📋</div>
                      <div>
                        <h4>{sub.assignment?.title || "Assignment"}</h4>
                        <p className="assignment-course">{sub.assignment?.course?.title || ""}</p>
                        <p className="assignment-date">
                          Submitted: {new Date(sub.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="assignment-right">
                      {sub.marks !== null && sub.marks !== undefined ? (
                        <div className="grade-display">
                          <div className="grade-num">{sub.marks}<span>/100</span></div>
                          <div className={`grade-label ${sub.marks >= 40 ? "pass" : "fail"}`}>
                            {sub.marks >= 40 ? "Passed" : "Failed"}
                          </div>
                        </div>
                      ) : (
                        <span className="badge badge-warning">Awaiting Grade</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ RESULTS ═══════════════════════════════════════════════════════ */}
        {activeTab === "results" && (
          <div className="tab-content">
            <div className="page-title">
              <h2>Quiz Results</h2>
              <p className="page-sub">Your quiz performance history</p>
            </div>

            {loading ? <Spinner /> : results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <h3>No results yet</h3>
                <p>Complete a quiz to see your results here.</p>
                <button className="btn-primary" onClick={() => setActiveTab("my-quizzes")}>
                  Go to My Quizzes
                </button>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="results-summary">
                  <div className="summary-stat">
                    <div className="summary-val">{results.length}</div>
                    <div className="summary-lbl">Total Taken</div>
                  </div>
                  <div className="summary-stat">
                    <div className="summary-val">{results.filter(r => r.passed).length}</div>
                    <div className="summary-lbl">Passed</div>
                  </div>
                  <div className="summary-stat">
                    <div className="summary-val">
                      {results.length ? Math.round(results.reduce((a, r) => a + (r.percentage || 0), 0) / results.length) : 0}%
                    </div>
                    <div className="summary-lbl">Avg Score</div>
                  </div>
                </div>

                <div className="results-list">
                  {results.map(r => (
                    <div key={r.quizId || r._id} className="result-card">
                      <div className="result-header">
                        <div>
                          <h4>{r.quizTitle}</h4>
                          <p className="result-subject">{r.subject}</p>
                        </div>
                        <span className={`badge ${r.passed ? "badge-active" : "badge-fail"}`}>
                          {r.passed ? "✓ Passed" : "✗ Failed"}
                        </span>
                      </div>

                      <div className="result-score">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${r.percentage || 0}%`,
                              background: r.passed
                                ? "linear-gradient(90deg,#059669,#10b981)"
                                : "linear-gradient(90deg,#dc2626,#ef4444)"
                            }}
                          />
                        </div>
                        <div className="result-text">
                          {r.score} / {r.maxScore} ({r.percentage}%)
                        </div>
                      </div>

                      <p className="result-date">
                        <IconClock /> Submitted: {new Date(r.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* ── Submit Assignment Modal ── */}
      {showSubmitModal && selectedAssignment && (
        <Modal title={`Submit: ${selectedAssignment.title}`} onClose={() => setShowSubmitModal(false)} wide>
          <div className="modal-body">
            {selectedAssignment.description && (
              <div className="assignment-desc-box">
                <strong>Instructions:</strong>
                <p>{selectedAssignment.description}</p>
              </div>
            )}
            <div className="form-group">
              <label>Your Answer / Work *</label>
              <textarea
                placeholder="Type your submission here..."
                value={submitContent}
                onChange={e => setSubmitContent(e.target.value)}
                rows="10"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowSubmitModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmitAssignment} disabled={loading}>
              {loading ? <Spinner /> : <><IconSend /> Submit</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default StudentDashboard;

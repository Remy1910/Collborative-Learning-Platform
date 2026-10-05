import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI, courseAPI, assignmentAPI, authAPI, noticeAPI, openSubmissionFile } from "../utils/api";
import {
  ACCEPTED_FILE_TYPES, MAX_FILES, formatDateTime, formatFileSize, isPastDeadline, timeUntil, validateSubmissionFiles
} from "../utils/assignments";
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
  const [assignments, setAssignments] = useState([]);
  const [notices, setNotices] = useState([]);

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
  const [submitFiles, setSubmitFiles] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => { loadTabData(); }, [activeTab]);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3500); };

  // silent: refresh in the background without the loading spinner or clearing alerts
  const loadTabData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      if (activeTab === "dashboard" || activeTab === "my-quizzes") {
        const q = await quizAPI.getAssignedQuizzes().catch(() => []);
        setQuizzes(Array.isArray(q) ? q : []);
      }
      if (activeTab === "results") {
        const r = await quizAPI.getMyResults().catch(() => []);
        setResults(Array.isArray(r) ? r : []);
      }
      // The dashboard's "Enrolled Courses" card needs the course list too
      if (activeTab === "courses" || activeTab === "dashboard") {
        const c = await courseAPI.getCourses().catch(() => []);
        setCourses(Array.isArray(c) ? c : []);
      }
      if (activeTab === "assignments") {
        const a = await assignmentAPI.getAvailableAssignments().catch(() => []);
        setAssignments(Array.isArray(a) ? a : []);
      }
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Refetch when the student comes back to this window, so courses, quizzes and
  // assignments that faculty created in the meantime show up without a reload
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") loadTabData({ silent: true });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [activeTab]);

  // Also load results and notices for dashboard quick view
  useEffect(() => {
    if (activeTab === "dashboard") {
      quizAPI.getMyResults().then(r => setResults(Array.isArray(r) ? r : [])).catch(() => { });
      noticeAPI.getNotices().then(n => setNotices(Array.isArray(n) ? n : [])).catch(() => { });
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

  const openSubmitModal = (assignment) => {
    setSelectedAssignment(assignment);
    setSubmitContent("");
    setSubmitFiles([]);
    setSubmitError("");
    setShowSubmitModal(true);
  };

  // Adds picked/dropped files to the selection, skipping duplicates by name+size
  const addSubmitFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const merged = [...submitFiles];
    incoming.forEach(f => {
      if (!merged.some(m => m.name === f.name && m.size === f.size)) merged.push(f);
    });
    setSubmitError(validateSubmissionFiles(merged));
    setSubmitFiles(merged);
  };

  const removeSubmitFile = (index) => {
    const remaining = submitFiles.filter((_, i) => i !== index);
    setSubmitFiles(remaining);
    setSubmitError(remaining.length ? validateSubmissionFiles(remaining) : "");
  };

  const handleSubmitAssignment = async () => {
    const validationError = validateSubmissionFiles(submitFiles);
    if (validationError) { setSubmitError(validationError); return; }
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("assignmentId", selectedAssignment._id);
      formData.append("content", submitContent);
      submitFiles.forEach(f => formData.append("files", f));
      const res = await assignmentAPI.submitAssignment(formData);
      showMsg(res.message || "Assignment submitted successfully!");
      setShowSubmitModal(false);
      setSubmitContent("");
      setSubmitFiles([]);
      loadTabData();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFile = async (submissionId, fileId) => {
    try {
      await openSubmissionFile(submissionId, fileId);
    } catch (err) {
      setError(err.message);
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

  const enrolledCourses = courses.filter(c => c.isEnrolled);
  const availableCourses = courses.filter(c => !c.isEnrolled);

  // In-progress attempts stay in the pending list so they can be resumed
  const upcomingQuizzes = quizzes.filter(q => ["notStarted", "inprogress"].includes(q.submissionStatus));
  const submittedQuizzes = quizzes.filter(q => !["notStarted", "inprogress"].includes(q.submissionStatus));

  const QUIZ_STATUS_LABELS = {
    submitted: "Submitted",
    graded: "Graded",
    terminated: "Auto-submitted",
  };

  // Where each assignment stands for this student
  const assignmentState = (a) => {
    const s = a.submission;
    if (s && s.marks !== null && s.marks !== undefined) return "graded";
    const closed = isPastDeadline(a.dueDate) && !a.allowLateSubmissions;
    if (s) return closed ? "submitted-closed" : "submitted";
    return closed ? "missed" : "todo";
  };
  const ASSIGNMENT_GROUPS = [
    { id: "todo", title: "📝 To do" },
    { id: "submitted", title: "📤 Submitted — awaiting grade", match: ["submitted", "submitted-closed"] },
    { id: "graded", title: "✅ Graded" },
    { id: "missed", title: "⛔ Missed" },
  ];

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

            {/* Main content + right-side notice board */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem", alignItems: "start" }}>
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
                            <IconPlay /> {q.submissionStatus === "inprogress" ? "Resume" : "Start"}
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

              {/* Notice Board */}
              <div style={{
                background: "#fdf6e3",
                border: "1px solid #e8dcb8",
                borderRadius: "12px",
                padding: "1rem 1.1rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.9rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>📌</span>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "#334155" }}>Notice Board</h3>
                </div>

                {notices.length === 0 ? (
                  <div className="empty-mini" style={{ fontSize: "0.85rem" }}>No notices right now</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "420px", overflowY: "auto" }}>
                    {notices.map(n => (
                      <div key={n._id} style={{ borderBottom: "1px dashed #e8dcb8", paddingBottom: "0.75rem" }}>
                        <div style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.3 }}>
                          {n.title}
                        </div>
                        <div style={{ color: "#dc2626", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.3rem" }}>
                          {n.category} • {n.course?.title || "General"}
                          {n.dueDate ? ` • Due ${new Date(n.dueDate).toLocaleDateString()}` : ""}
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
                            <span className="course-stat-num">{c.studentCount || 0}</span>
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
                            <span className="course-stat-num">{c.studentCount || 0}</span>
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
                            <span className="badge badge-warning">{q.submissionStatus === "inprogress" ? "In Progress" : "Pending"}</span>
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
                            <IconPlay /> {q.submissionStatus === "inprogress" ? "Resume Quiz" : "Start Quiz"}
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
                            <span className={`badge badge-${q.submissionStatus === "terminated" ? "fail" : "active"}`}>
                              {QUIZ_STATUS_LABELS[q.submissionStatus] || q.submissionStatus}
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

            {loading ? <Spinner /> : assignments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No assignments available</h3>
                <p>Enroll in a course to see its assignments here.</p>
              </div>
            ) : (
              ASSIGNMENT_GROUPS.map(group => {
                const items = assignments.filter(a => (group.match || [group.id]).includes(assignmentState(a)));
                if (items.length === 0) return null;
                return (
                  <div key={group.id} style={{ marginBottom: "2rem" }}>
                    <h3 className="section-label">{group.title} ({items.length})</h3>
                    <div className="assignment-list-student">
                      {items.map(assignment => {
                        const submission = assignment.submission;
                        const state = assignmentState(assignment);
                        const pastDeadline = isPastDeadline(assignment.dueDate);
                        const dueSoon = !pastDeadline && assignment.dueDate &&
                          new Date(assignment.dueDate) - new Date() < 24 * 3600e3;
                        const maxMarks = assignment.maxMarks ?? 100;
                        return (
                          <div key={assignment._id} className="assignment-card-student">
                            <div className="assignment-left">
                              <div className="assignment-icon">📋</div>
                              <div>
                                <h4>{assignment.title}</h4>
                                <p className="assignment-course">{assignment.course?.title || ""} · {maxMarks} marks</p>
                                <p className="assignment-date">
                                  {assignment.dueDate ? `Deadline: ${formatDateTime(assignment.dueDate)}` : "No deadline"}
                                  {assignment.dueDate && state !== "graded" && (
                                    <span className={dueSoon ? "deadline-soon" : ""}> · {timeUntil(assignment.dueDate)}</span>
                                  )}
                                  {pastDeadline && assignment.allowLateSubmissions && state === "todo" && " · late submissions accepted"}
                                </p>
                                {assignment.description && state === "todo" && (
                                  <p className="assignment-desc">{assignment.description}</p>
                                )}
                                {submission && (
                                  <>
                                    <p className="assignment-date">
                                      Submitted {formatDateTime(submission.submittedAt)}
                                      {submission.attemptCount > 1 && ` · attempt ${submission.attemptCount}`}
                                      {submission.isLate && <span className="badge badge-warning" style={{ marginLeft: "0.4rem" }}>Late</span>}
                                    </p>
                                    <div className="file-chips">
                                      {submission.files.map(file => (
                                        <button
                                          key={file._id}
                                          type="button"
                                          className="file-chip"
                                          onClick={() => handleOpenFile(submission._id, file._id)}
                                        >
                                          {file.mimeType === "application/pdf" ? "📄" : "🖼️"} {file.originalName}
                                        </button>
                                      ))}
                                    </div>
                                    {submission.feedback && (
                                      <div className="assignment-feedback">
                                        <strong>Feedback:</strong> {submission.feedback}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="assignment-right assignment-actions">
                              {state === "graded" ? (
                                <div className="grade-display">
                                  <div className="grade-num">{submission.marks}<span>/{maxMarks}</span></div>
                                  <div className="grade-label pass" style={{ color: "var(--text-muted)" }}>
                                    {Math.round((submission.marks / maxMarks) * 100)}%
                                  </div>
                                </div>
                              ) : state === "todo" ? (
                                <button className="btn-primary" onClick={() => openSubmitModal(assignment)}>
                                  <IconSend /> Submit
                                </button>
                              ) : state === "submitted" ? (
                                <>
                                  <span className="badge badge-warning">Awaiting grade</span>
                                  <button className="btn-secondary btn-small" onClick={() => openSubmitModal(assignment)}>
                                    Resubmit
                                  </button>
                                </>
                              ) : state === "submitted-closed" ? (
                                <span className="badge badge-warning">Awaiting grade</span>
                              ) : (
                                <span className="badge badge-fail">Missed</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
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
                      {results.length ? Math.round(results.reduce((a, r) => a + (Number(r.percentage) || 0), 0) / results.length) : 0}%
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
        <Modal
          title={`${selectedAssignment.submission ? "Resubmit" : "Submit"}: ${selectedAssignment.title}`}
          onClose={() => !submitting && setShowSubmitModal(false)}
          wide
        >
          <div className="modal-body">
            {submitError && <div className="alert alert-error">{submitError}</div>}
            {selectedAssignment.description && (
              <div className="assignment-desc-box">
                <strong>Instructions:</strong>
                <p style={{ whiteSpace: "pre-line" }}>{selectedAssignment.description}</p>
              </div>
            )}
            <div className="grade-student-info">
              <strong>Deadline:</strong> {formatDateTime(selectedAssignment.dueDate) || "None"}
              {selectedAssignment.dueDate && ` (${timeUntil(selectedAssignment.dueDate)})`}
              {" · "}<strong>Marks:</strong> {selectedAssignment.maxMarks ?? 100}
              {isPastDeadline(selectedAssignment.dueDate) && (
                <><br /><span className="deadline-soon">The deadline has passed — this submission will be marked late.</span></>
              )}
            </div>
            {selectedAssignment.submission && (
              <div className="info-box" style={{ marginBottom: "1rem" }}>
                ⓘ Resubmitting replaces the {selectedAssignment.submission.files.length} file(s) you submitted
                on {formatDateTime(selectedAssignment.submission.submittedAt)}.
              </div>
            )}
            <div className="form-group">
              <label>Files * <span className="text-muted small">(PDF or JPG · up to {MAX_FILES} files · 10 MB each, 12 MB total)</span></label>
              <label
                className={`drop-zone${dragging ? " dragging" : ""}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addSubmitFiles(e.dataTransfer.files); }}
              >
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  onChange={e => { addSubmitFiles(e.target.files); e.target.value = ""; }}
                />
                📎 Click to choose files, or drag them here
              </label>
              {submitFiles.length > 0 && (
                <div className="file-chips">
                  {submitFiles.map((f, i) => (
                    <span key={`${f.name}-${f.size}`} className="file-chip" style={{ cursor: "default" }}>
                      {f.name.toLowerCase().endsWith(".pdf") ? "📄" : "🖼️"} {f.name}
                      <span className="file-chip-size">{formatFileSize(f.size)}</span>
                      <button type="button" className="file-chip-remove" onClick={() => removeSubmitFile(i)} title="Remove">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Note to your instructor <span className="text-muted small">(optional)</span></label>
              <textarea
                placeholder="Anything your instructor should know about this submission…"
                value={submitContent}
                onChange={e => setSubmitContent(e.target.value)}
                rows="3"
                maxLength={2000}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowSubmitModal(false)} disabled={submitting}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleSubmitAssignment}
              disabled={submitting || Boolean(validateSubmissionFiles(submitFiles))}
            >
              {submitting ? <><Spinner /> Uploading…</> : <><IconSend /> {selectedAssignment.submission ? "Resubmit" : "Submit"}</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default StudentDashboard;

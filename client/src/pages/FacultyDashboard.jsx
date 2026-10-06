import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizAPI, courseAPI, assignmentAPI, authAPI, noticeAPI, openSubmissionFile } from "../utils/api";
import {
  formatDateTime, formatFileSize, isPastDeadline, timeUntil, toDateTimeLocal, SUBMISSION_STATUS
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
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IconLogOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
);

// ── Modal wrapper ──────────────────────────────────────────────────────────
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

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="spinner-ring" />;
}

function FacultyDashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Faculty";
  const [activeTab, setActiveTab] = useState("overview");

  // Data
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ totalCourses: 0, totalAssignments: 0, totalSubmissions: 0, pendingGrading: 0 });

  // Loading / Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  // Assignment being edited in the create/edit modal (null = creating a new one)
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  // ── Quiz submissions ──
  const [showQuizSubmissionsModal, setShowQuizSubmissionsModal] = useState(false);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [quizSubmissionsLoading, setQuizSubmissionsLoading] = useState(false);
  const [quizStats, setQuizStats] = useState(null);

  // ── Quiz attempt review / short-answer grading ──
  const [reviewResponse, setReviewResponse] = useState(null);
  const [reviewMarks, setReviewMarks] = useState({});
  const [gradingQuestionId, setGradingQuestionId] = useState(null);

  const [quizFilter, setQuizFilter] = useState("all");
  // Bumped after creating/editing/deleting an assignment so the per-course lists refetch
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);

  // ── Notices ──
  const [notices, setNotices] = useState([]);
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: "", message: "", category: "General", dueDate: "", expiryDate: "", courseId: ""
  });

  // Forms
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const emptyAssignmentForm = { title: "", description: "", courseId: "", dueDate: "", maxMarks: "100", allowLateSubmissions: false };
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });
  const [assignCourseId, setAssignCourseId] = useState('');

  useEffect(() => { loadAll(); }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

  const loadAll = async () => {
    setLoading(true);
    // Load each section independently; a failure keeps that section's previous data and is reported
    const [qRes, cRes, sRes, nRes] = await Promise.allSettled([
      quizAPI.getMyQuizzes(),
      courseAPI.getCourses(),
      assignmentAPI.getStats(),
      noticeAPI.getMyNotices(),
    ]);
    if (qRes.status === "fulfilled") setQuizzes(Array.isArray(qRes.value) ? qRes.value : []);
    // The server only returns this faculty member's own courses
    if (cRes.status === "fulfilled") setCourses(Array.isArray(cRes.value) ? cRes.value : []);
    if (sRes.status === "fulfilled" && sRes.value) setStats(sRes.value);
    if (nRes.status === "fulfilled") setNotices(Array.isArray(nRes.value) ? nRes.value : []);
    const failure = [qRes, cRes, sRes, nRes].find(r => r.status === "rejected");
    if (failure) setError(`Couldn't load all dashboard data: ${failure.reason.message}`);
    setLoading(false);
  };

  // ── Post Notice ────────────────────────────────────────────────────────
  const handleCreateNotice = async () => {
    if (!noticeForm.title.trim()) { setError("Notice title is required"); return; }
    if (!noticeForm.message.trim()) { setError("Notice message is required"); return; }
    try {
      setLoading(true);
      await noticeAPI.createNotice({
        title: noticeForm.title,
        message: noticeForm.message,
        category: noticeForm.category,
        dueDate: noticeForm.dueDate || null,
        expiryDate: noticeForm.expiryDate || null,
        courseId: noticeForm.courseId || null,
      });
      setShowCreateNotice(false);
      setNoticeForm({ title: "", message: "", category: "General", dueDate: "", expiryDate: "", courseId: "" });
      showMsg("Notice posted successfully!");
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Notice ──────────────────────────────────────────────────────
  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm("Delete this notice?")) return;
    try {
      await noticeAPI.deleteNotice(noticeId);
      showMsg("Notice deleted.");
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Create Course ──────────────────────────────────────────────────────
  const handleCreateCourse = async () => {
    if (!courseForm.title.trim()) { setError("Course title is required"); return; }
    try {
      setLoading(true);
      await courseAPI.createCourse(courseForm);
      setShowCreateCourse(false);
      setCourseForm({ title: "", description: "" });
      showMsg("Course created successfully!");
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Create / Edit Assignment ──────────────────────────────────────────
  const openCreateAssignment = (courseId = "") => {
    setEditingAssignment(null);
    setAssignmentForm({ ...emptyAssignmentForm, courseId });
    setError("");
    setShowCreateAssignment(true);
  };

  const openEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description || "",
      courseId: assignment.course?._id || assignment.course,
      dueDate: toDateTimeLocal(assignment.dueDate),
      maxMarks: String(assignment.maxMarks ?? 100),
      allowLateSubmissions: Boolean(assignment.allowLateSubmissions),
    });
    setError("");
    setShowCreateAssignment(true);
  };

  const handleSaveAssignment = async () => {
    const maxMarks = Number(assignmentForm.maxMarks);
    if (assignmentForm.title.trim().length < 3) { setError("Assignment title must be at least 3 characters"); return; }
    if (!assignmentForm.courseId) { setError("Please select a course"); return; }
    if (!assignmentForm.dueDate) { setError("Please set a deadline"); return; }
    if (!editingAssignment && new Date(assignmentForm.dueDate) <= new Date()) { setError("The deadline must be in the future"); return; }
    if (!Number.isFinite(maxMarks) || maxMarks < 1 || maxMarks > 1000) { setError("Maximum marks must be between 1 and 1000"); return; }

    const payload = {
      title: assignmentForm.title.trim(),
      description: assignmentForm.description,
      // datetime-local has no time zone; send an exact instant so the server doesn't reinterpret it
      dueDate: new Date(assignmentForm.dueDate).toISOString(),
      maxMarks,
      allowLateSubmissions: assignmentForm.allowLateSubmissions,
    };

    try {
      setLoading(true);
      if (editingAssignment) {
        await assignmentAPI.updateAssignment(editingAssignment._id, payload);
      } else {
        await assignmentAPI.createAssignment({ ...payload, courseId: assignmentForm.courseId });
      }
      setShowCreateAssignment(false);
      setError("");
      setAssignmentForm(emptyAssignmentForm);
      setAssignmentsVersion(v => v + 1);
      showMsg(editingAssignment ? "Assignment updated!" : "Assignment created successfully!");
      setEditingAssignment(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Assignment ─────────────────────────────────────────────────
  const handleDeleteAssignment = async (assignment) => {
    const warning = assignment.submittedCount
      ? `Delete "${assignment.title}"? This also permanently deletes ${assignment.submittedCount} student submission(s) and their grades.`
      : `Delete "${assignment.title}"?`;
    if (!window.confirm(warning)) return;
    try {
      await assignmentAPI.deleteAssignment(assignment._id);
      setAssignmentsVersion(v => v + 1);
      showMsg("Assignment deleted.");
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  // ── View Submissions ──────────────────────────────────────────────────
  const handleViewSubmissions = async (assignment) => {
    try {
      const data = await assignmentAPI.getSubmissions(assignment._id);
      setSelectedAssignment({ ...assignment, ...data.assignment });
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setShowSubmissionsModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Grade Submission ──────────────────────────────────────────────────
  const openGradeModal = (submission) => {
    setSelectedSubmission(submission);
    setGradeForm({
      marks: submission.marks !== null && submission.marks !== undefined ? String(submission.marks) : "",
      feedback: submission.feedback || "",
    });
    setError("");
    setShowGradeModal(true);
  };

  const handleGrade = async () => {
    const maxMarks = selectedAssignment?.maxMarks ?? 100;
    const marks = parseFloat(gradeForm.marks);
    if (isNaN(marks) || marks < 0 || marks > maxMarks) { setError(`Marks must be between 0 and ${maxMarks}`); return; }
    try {
      setLoading(true);
      await assignmentAPI.gradeSubmission({ submissionId: selectedSubmission._id, marks, feedback: gradeForm.feedback });
      setShowGradeModal(false);
      setError("");
      setGradeForm({ marks: "", feedback: "" });
      showMsg("Marks assigned successfully!");
      setAssignmentsVersion(v => v + 1);
      handleViewSubmissions(selectedAssignment);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAttachment = async (submissionId, fileId) => {
    try {
      await openSubmissionFile(submissionId, fileId);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Assign Quiz ──────────────────────────────────────────────────────────
  const handleAssignQuiz = async () => {
    const course = courses.find(c => c._id === assignCourseId);
    if (!course || !course.students || course.students.length === 0) {
      setError('No students enrolled in the selected course'); return;
    }
    try {
      setLoading(true);
      const studentIds = course.students.map(s => s._id || s);
      await quizAPI.assignQuizToStudents(selectedQuiz._id, studentIds);
      setShowAssignModal(false);
      setAssignCourseId('');
      showMsg(`Quiz assigned to ${studentIds.length} student(s)!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── View Quiz Submissions ─────────────────────────────────────────────
  const handleViewQuizSubmissions = async (quiz) => {
    setSelectedQuiz(quiz);
    setShowQuizSubmissionsModal(true);
    setQuizSubmissionsLoading(true);
    try {
      const [data, stats] = await Promise.all([
        quizAPI.getSubmissions(quiz._id),
        quizAPI.getStats(quiz._id),
      ]);
      setQuizSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setQuizStats(stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuizSubmissionsLoading(false);
    }
  };

  // ── Review a quiz attempt ─────────────────────────────────────────────
  const handleOpenReview = async (responseId) => {
    try {
      const data = await quizAPI.getResponseDetails(responseId);
      setReviewResponse(data);
      const marks = {};
      data.responses.forEach(r => {
        if (r.question?.type === "shortanswer") marks[r.question._id] = String(r.marksObtained ?? 0);
      });
      setReviewMarks(marks);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGradeShortAnswer = async (questionId, maxMarks) => {
    const marks = parseFloat(reviewMarks[questionId]);
    if (isNaN(marks) || marks < 0 || marks > maxMarks) {
      setError(`Marks must be between 0 and ${maxMarks}`);
      return;
    }
    setGradingQuestionId(questionId);
    try {
      await quizAPI.gradeShortAnswer(reviewResponse._id, { questionId, marksObtained: marks });
      showMsg("Answer graded.");
      await handleOpenReview(reviewResponse._id);
      handleViewQuizSubmissions(selectedQuiz);
    } catch (err) {
      setError(err.message);
    } finally {
      setGradingQuestionId(null);
    }
  };

  // ── Grant Reattempt ────────────────────────────────────────────────────
  const handleGrantReattempt = async (responseId) => {
    const reason = window.prompt(
      "Reason for granting a reattempt (e.g. 'connection dropped during quiz'):"
    );
    if (!reason || !reason.trim()) return;

    try {
      await quizAPI.grantReattempt(responseId, { reason });
      showMsg("Reattempt granted — student can now retake the quiz.");
      handleViewQuizSubmissions(selectedQuiz); // refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Delete Quiz ────────────────────────────────────────────────────────
  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm("Delete this quiz permanently?")) return;
    try {
      await quizAPI.deleteQuiz(quizId);
      showMsg("Quiz deleted.");
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────
  // ── Logout ─────────────────────────────────────────────────────────────
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
  const activeQuizzes = quizzes.filter(q => q.status === "active").length;
  const draftQuizzes = quizzes.filter(q => q.status === "draft").length;
  const publishedCount = quizzes.filter(q => q.isPublished).length;

  const QUIZ_FILTERS = [
    { id: "all", label: "All", count: quizzes.length, match: () => true },
    { id: "active", label: "Active", count: activeQuizzes, match: q => q.status === "active" },
    { id: "draft", label: "Draft", count: draftQuizzes, match: q => q.status === "draft" },
    { id: "published", label: "Published", count: publishedCount, match: q => q.isPublished },
  ];
  const filteredQuizzes = quizzes.filter(QUIZ_FILTERS.find(f => f.id === quizFilter).match);

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-logo">📚</div>
          <div>
            <h1>CampusLink</h1>
            <span className="header-sub">Faculty Portal</span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-chip">
            <div className="user-avatar">{userName[0]?.toUpperCase()}</div>
            <span>{userName}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}><IconLogOut /> Logout</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="dashboard-tabs">
        {[
          { id: "overview", label: "Overview", icon: <IconHome /> },
          { id: "courses", label: "Courses", icon: <IconBook /> },
          { id: "quizzes", label: "Quizzes", icon: <IconQuiz /> },
          { id: "assignments", label: "Assignments", icon: <IconClip /> },
          { id: "students", label: "Students", icon: <IconUsers /> },
          { id: "notices", label: "Notices", icon: <IconBell /> },
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
        {error && <div className="alert alert-error" onClick={() => setError("")}  >{error}   <span>✕</span></div>}
        {success && <div className="alert alert-success" onClick={() => setSuccess("")}>{success} <span>✕</span></div>}
      </div>

      {/* ── Content ── */}
      <div className="dashboard-content">

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="tab-content">
            <div className="page-title">
              <h2>Welcome back, {userName} 👋</h2>
              <p className="page-sub">Here's what's happening with your courses today.</p>
            </div>

            <div className="stats-grid">
              {[
                { label: "Total Courses", value: courses.length, color: "#2563eb", icon: "📚" },
                { label: "Total Quizzes", value: quizzes.length, color: "#7c3aed", icon: "📝" },
                { label: "Active Quizzes", value: activeQuizzes, color: "#059669", icon: "✅" },
                { label: "Assignments", value: stats.totalAssignments, color: "#d97706", icon: "📋" },
                { label: "Submissions to Grade", value: stats.pendingGrading || 0, color: "#dc2626", icon: "🖊️" },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ borderTop: `4px solid ${s.color}` }}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="overview-grid">
              {/* Recent Quizzes */}
              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>Recent Quizzes</h3>
                  <button className="btn-link" onClick={() => setActiveTab("quizzes")}>View all →</button>
                </div>
                {loading ? <Spinner /> : quizzes.length === 0 ? (
                  <div className="empty-mini">No quizzes yet</div>
                ) : (
                  <div className="mini-list">
                    {quizzes.slice(0, 5).map(q => (
                      <div key={q._id} className="mini-item">
                        <div>
                          <div className="mini-title">{q.title}</div>
                          <div className="mini-sub">{q.subject} • {q.totalQuestions || 0} questions</div>
                        </div>
                        <span className={`badge badge-${q.status}`}>{q.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Courses */}
              <div className="overview-card">
                <div className="overview-card-header">
                  <h3>My Courses</h3>
                  <button className="btn-link" onClick={() => setActiveTab("courses")}>View all →</button>
                </div>
                {courses.length === 0 ? (
                  <div className="empty-mini">No courses yet</div>
                ) : (
                  <div className="mini-list">
                    {courses.slice(0, 5).map(c => (
                      <div key={c._id} className="mini-item">
                        <div>
                          <div className="mini-title">{c.title}</div>
                          <div className="mini-sub">{c.students?.length || 0} students enrolled</div>
                        </div>
                        <span className="badge badge-active">active</span>
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
            <div className="tab-header">
              <div>
                <h2>Courses</h2>
                <p className="page-sub">Manage your courses and enrolled students</p>
              </div>
              <button className="btn-primary" onClick={() => setShowCreateCourse(true)}>
                <IconPlus /> Create Course
              </button>
            </div>

            {loading ? <Spinner /> : courses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>No courses yet</h3>
                <p>Create your first course to get started</p>
                <button className="btn-primary" onClick={() => setShowCreateCourse(true)}>
                  <IconPlus /> Create Course
                </button>
              </div>
            ) : (
              <div className="course-grid">
                {courses.map(course => (
                  <div key={course._id} className="course-card">
                    <div className="course-card-top">
                      <div className="course-icon">📖</div>
                      <div className="course-meta-right">
                        <span className="badge badge-active">Active</span>
                      </div>
                    </div>
                    <h3 className="course-title">{course.title}</h3>
                    <p className="course-desc">{course.description || "No description provided."}</p>
                    <div className="course-stats">
                      <div className="course-stat">
                        <span className="course-stat-num">{course.students?.length || 0}</span>
                        <span className="course-stat-lbl">Students</span>
                      </div>
                      <div className="course-stat">
                        <span className="course-stat-num">{course.faculty?.name || "You"}</span>
                        <span className="course-stat-lbl">Instructor</span>
                      </div>
                    </div>
                    <div className="course-actions">
                      <button
                        className="btn-secondary btn-small"
                        onClick={() => openCreateAssignment(course._id)}
                      >
                        <IconPlus /> Add Assignment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ QUIZZES ═══════════════════════════════════════════════════════ */}
        {activeTab === "quizzes" && (
          <div className="tab-content">
            <div className="tab-header">
              <div>
                <h2>Quizzes</h2>
                <p className="page-sub">Create, manage and publish quizzes for your students</p>
              </div>
              <button className="btn-primary" onClick={() => navigate("/faculty/quiz-builder")}>
                <IconPlus /> Create Quiz
              </button>
            </div>

            <div className="filter-bar">
              <div className="filter-chips">
                {QUIZ_FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`filter-chip ${quizFilter === f.id ? "active" : ""}`}
                    onClick={() => setQuizFilter(f.id)}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>

            {loading ? <Spinner /> : quizzes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No quizzes yet</h3>
                <p>Create your first quiz to engage your students</p>
                <button className="btn-primary" onClick={() => navigate("/faculty/quiz-builder")}>
                  <IconPlus /> Create Quiz
                </button>
              </div>
            ) : (
              <div className="quiz-table-wrapper">
                <table className="quiz-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Subject</th>
                      <th>Questions</th>
                      <th>Total Marks</th>
                      <th>Status</th>
                      <th>Published</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuizzes.length === 0 && (
                      <tr><td colSpan="7" className="text-center text-muted">No quizzes match this filter</td></tr>
                    )}
                    {filteredQuizzes.map(quiz => (
                      <tr key={quiz._id}>
                        <td>
                          <div className="quiz-title-cell">{quiz.title}</div>
                          <div className="quiz-sub-cell">{quiz.description?.slice(0, 60) || ""}</div>
                        </td>
                        <td>{quiz.subject}</td>
                        <td className="text-center">{quiz.totalQuestions || quiz.questions?.length || 0}</td>
                        <td className="text-center">{quiz.totalMarks}</td>
                        <td><span className={`badge badge-${quiz.status}`}>{quiz.status}</span></td>
                        <td className="text-center">
                          {quiz.isPublished
                            ? <span className="text-success">✓ Yes</span>
                            : <span className="text-muted">✗ No</span>}
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              className="btn-small btn-primary"
                              onClick={() => { setSelectedQuiz(quiz); setShowAssignModal(true); }}
                              title="Assign to students"
                            >
                              Assign
                            </button>
                            <button
                              className="btn-small btn-secondary"
                              onClick={() => handleViewQuizSubmissions(quiz)}
                              title="View submissions"
                            >
                              Submissions
                            </button>
                            <button
                              className="btn-small btn-danger"
                              onClick={() => handleDeleteQuiz(quiz._id)}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ ASSIGNMENTS ═══════════════════════════════════════════════════ */}
        {activeTab === "assignments" && (
          <div className="tab-content">
            <div className="tab-header">
              <div>
                <h2>Assignments</h2>
                <p className="page-sub">Create and manage assignments for your courses</p>
              </div>
              <button
                className="btn-primary"
                onClick={() => openCreateAssignment()}
                disabled={courses.length === 0}
                title={courses.length === 0 ? "Create a course first" : ""}
              >
                <IconPlus /> Create Assignment
              </button>
            </div>

            {courses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No courses available</h3>
                <p>You need to create a course before adding assignments</p>
                <button className="btn-primary" onClick={() => setActiveTab("courses")}>
                  Go to Courses
                </button>
              </div>
            ) : (
              <div className="assignment-sections">
                {courses.map(course => (
                  <div key={course._id} className="assignment-course-section">
                    <div className="assignment-course-header">
                      <div>
                        <h3>{course.title}</h3>
                        <span className="page-sub">{course.students?.length || 0} students enrolled</span>
                      </div>
                      <button
                        className="btn-secondary btn-small"
                        onClick={() => openCreateAssignment(course._id)}
                      >
                        <IconPlus /> Add Assignment
                      </button>
                    </div>

                    <AssignmentList
                      courseId={course._id}
                      refreshKey={assignmentsVersion}
                      onViewSubmissions={handleViewSubmissions}
                      onEdit={openEditAssignment}
                      onDelete={handleDeleteAssignment}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ NOTICES ═══════════════════════════════════════════════════════ */}
        {activeTab === "notices" && (
          <div className="tab-content">
            <div className="tab-header">
              <div>
                <h2>Notice Board</h2>
                <p className="page-sub">Post announcements, quiz dates, and deadlines for your students</p>
              </div>
              <button className="btn-primary" onClick={() => setShowCreateNotice(true)}>
                <IconPlus /> Post Notice
              </button>
            </div>

            {loading ? <Spinner /> : notices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📌</div>
                <h3>No notices yet</h3>
                <p>Post your first notice to keep students informed</p>
                <button className="btn-primary" onClick={() => setShowCreateNotice(true)}>
                  <IconPlus /> Post Notice
                </button>
              </div>
            ) : (
              <div className="mini-list">
                {notices.map(n => (
                  <div key={n._id} className="mini-item" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div className="mini-title">{n.title}</div>
                      <div className="mini-sub" style={{ marginBottom: "0.3rem" }}>
                        {n.category} • {n.course?.title || "General"}
                        {n.dueDate ? ` • Due ${new Date(n.dueDate).toLocaleDateString()}` : ""}
                        {n.expiryDate ? ` • Expires ${new Date(n.expiryDate).toLocaleDateString()}` : ""}
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "#475569", margin: 0 }}>{n.message}</p>
                    </div>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => handleDeleteNotice(n._id)}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STUDENTS ══════════════════════════════════════════════════════ */}
        {activeTab === "students" && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Students</h2>
            </div>

            {courses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No courses yet</h3>
                <p>Create a course to see enrolled students</p>
              </div>
            ) : (
              courses.map(course => (
                <div key={course._id} className="students-section">
                  <div className="assignment-course-header">
                    <h3>{course.title}</h3>
                    <span className="badge badge-active">{course.students?.length || 0} enrolled</span>
                  </div>

                  {!course.students || course.students.length === 0 ? (
                    <div className="empty-mini">No students enrolled in this course yet</div>
                  ) : (
                    <div className="students-grid">
                      {course.students.map(student => (
                        <div key={student._id || student} className="student-card">
                          <div className="student-avatar">
                            {(student.name || "S")[0].toUpperCase()}
                          </div>
                          <div className="student-info">
                            <div className="student-name">{student.name || "Student"}</div>
                            <div className="student-email">{student.email || ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* ══ MODALS ════════════════════════════════════════════════════════ */}

      {/* Create Course Modal */}
      {showCreateCourse && (
        <Modal title="Create New Course" onClose={() => setShowCreateCourse(false)}>
          <div className="modal-body">
            <div className="form-group">
              <label>Course Title *</label>
              <input
                type="text"
                placeholder="e.g., Introduction to Computer Science"
                value={courseForm.title}
                onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Brief description of the course..."
                value={courseForm.description}
                onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                rows="4"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowCreateCourse(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateCourse} disabled={loading}>
              {loading ? <><Spinner /> Creating…</> : <><IconCheck /> Create Course</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Create / Edit Assignment Modal */}
      {showCreateAssignment && (
        <Modal
          title={editingAssignment ? "Edit Assignment" : "Create Assignment"}
          onClose={() => { setShowCreateAssignment(false); setEditingAssignment(null); }}
        >
          <div className="modal-body">
            {error && <div className="alert alert-error" onClick={() => setError("")}>{error} <span>✕</span></div>}
            <div className="form-group">
              <label>Assignment Title *</label>
              <input
                type="text"
                placeholder="e.g., Assignment 1 - Introduction"
                value={assignmentForm.title}
                onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Course *</label>
              <select
                value={assignmentForm.courseId}
                onChange={e => setAssignmentForm(f => ({ ...f, courseId: e.target.value }))}
                disabled={Boolean(editingAssignment)}
              >
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Instructions</label>
              <textarea
                placeholder="What should students do and submit?"
                value={assignmentForm.description}
                onChange={e => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
                rows="4"
                maxLength={2000}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Deadline *</label>
                <input
                  type="datetime-local"
                  value={assignmentForm.dueDate}
                  min={editingAssignment ? undefined : toDateTimeLocal(new Date())}
                  onChange={e => setAssignmentForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Maximum Marks *</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={assignmentForm.maxMarks}
                  onChange={e => setAssignmentForm(f => ({ ...f, maxMarks: e.target.value }))}
                />
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={assignmentForm.allowLateSubmissions}
                onChange={e => setAssignmentForm(f => ({ ...f, allowLateSubmissions: e.target.checked }))}
              />
              <span>Allow late submissions <span className="text-muted small">(accepted after the deadline and marked late)</span></span>
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowCreateAssignment(false); setEditingAssignment(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveAssignment} disabled={loading}>
              {loading
                ? <><Spinner /> Saving…</>
                : <><IconCheck /> {editingAssignment ? "Save Changes" : "Create Assignment"}</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Submissions Modal */}
      {showSubmissionsModal && selectedAssignment && (
        <Modal
          title={`Submissions — ${selectedAssignment.title}`}
          onClose={() => setShowSubmissionsModal(false)}
          wide
        >
          <div className="modal-body">
            <div className="grade-student-info">
              <strong>Deadline:</strong> {formatDateTime(selectedAssignment.dueDate) || "None"}
              {selectedAssignment.dueDate && ` (${timeUntil(selectedAssignment.dueDate)})`}
              {selectedAssignment.allowLateSubmissions && " · late submissions allowed"}<br />
              <strong>Submitted:</strong> {submissions.filter(s => s.status !== "not_submitted").length} of {submissions.length}
              {" · "}<strong>Graded:</strong> {submissions.filter(s => s.status === "graded").length}
              {" · "}<strong>Max marks:</strong> {selectedAssignment.maxMarks}
            </div>
            {submissions.length === 0 ? (
              <div className="empty-mini">No students are enrolled in this course.</div>
            ) : (
              <div className="submissions-list">
                {submissions.map(sub => {
                  const status = SUBMISSION_STATUS[sub.status] || SUBMISSION_STATUS.submitted;
                  return (
                    <div key={sub._id} className="submission-item">
                      <div className="submission-info">
                        <div className="student-name">
                          {sub.student?.name || "Student"}{" "}
                          <span className={`badge ${status.badge}`}>{status.label}</span>
                        </div>
                        {sub.status !== "not_submitted" && (
                          <>
                            <div className="submission-content">
                              {formatDateTime(sub.submittedAt)}
                              {sub.attemptCount > 1 && ` · attempt ${sub.attemptCount}`}
                              {sub.isLate && sub.status === "graded" && " · late"}
                            </div>
                            {sub.note && <div className="submission-content">“{sub.note}”</div>}
                            <SubmissionFiles submission={sub} onOpen={handleOpenAttachment} />
                          </>
                        )}
                      </div>
                      <div className="submission-right">
                        {sub.status === "not_submitted" ? null : sub.status === "graded" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span className="marks-badge">{sub.marks}/{selectedAssignment.maxMarks}</span>
                            <button className="btn-small btn-secondary" onClick={() => openGradeModal(sub)} title="Change grade">
                              <IconEdit />
                            </button>
                          </div>
                        ) : (
                          <button className="btn-small btn-primary" onClick={() => openGradeModal(sub)}>
                            Grade
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowSubmissionsModal(false)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Grade Modal */}
      {showGradeModal && selectedSubmission && (
        <Modal title="Grade Submission" onClose={() => setShowGradeModal(false)}>
          <div className="modal-body">
            {error && <div className="alert alert-error" onClick={() => setError("")}>{error} <span>✕</span></div>}
            <div className="grade-student-info">
              <strong>Student:</strong> {selectedSubmission.student?.name}<br />
              <strong>Submitted:</strong> {formatDateTime(selectedSubmission.submittedAt)}
              {selectedSubmission.isLate && <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>Late</span>}
              {selectedSubmission.attemptCount > 1 && ` · attempt ${selectedSubmission.attemptCount}`}
            </div>
            {selectedSubmission.note && (
              <div className="submission-preview">
                <label>Student's note</label>
                <div className="submission-text">{selectedSubmission.note}</div>
              </div>
            )}
            <div className="submission-preview" style={{ marginTop: "1rem" }}>
              <label>Files</label>
              <SubmissionFiles submission={selectedSubmission} onOpen={handleOpenAttachment} />
            </div>
            <div className="form-group" style={{ marginTop: "1.5rem" }}>
              <label>Marks (0–{selectedAssignment?.maxMarks ?? 100}) *</label>
              <input
                type="number"
                min="0"
                max={selectedAssignment?.maxMarks ?? 100}
                step="0.5"
                placeholder="Enter marks"
                value={gradeForm.marks}
                onChange={e => setGradeForm(f => ({ ...f, marks: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Feedback <span className="text-muted small">(optional, visible to the student)</span></label>
              <textarea
                rows="4"
                maxLength={2000}
                placeholder="What was good, what to improve…"
                value={gradeForm.feedback}
                onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowGradeModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleGrade} disabled={loading}>
              <IconCheck /> {selectedSubmission.status === "graded" ? "Update Grade" : "Submit Grade"}
            </button>
          </div>
        </Modal>
      )}

      {/* Assign Quiz Modal */}
      {showAssignModal && selectedQuiz && (
        <Modal title={`Assign Quiz: "${selectedQuiz.title}"`} onClose={() => setShowAssignModal(false)}>
          <div className="modal-body">
            <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1rem" }}>
              Select which course's students should receive this quiz.
            </p>
            <div className="form-group">
              <label>Select Course *</label>
              <select
                value={assignCourseId}
                onChange={e => setAssignCourseId(e.target.value)}
              >
                <option value="">— Choose a course —</option>
                {courses.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.title} ({c.students?.length || 0} students)
                  </option>
                ))}
              </select>
            </div>
            {assignCourseId && (() => {
              const c = courses.find(x => x._id === assignCourseId);
              if (!c || !c.students?.length) return (
                <div style={{ padding: "0.75rem", background: "#fef3c7", borderRadius: "8px", fontSize: "0.875rem", color: "#78350f" }}>
                  ⚠️ No students enrolled in this course yet.
                </div>
              );
              return (
                <div className="grade-student-info">
                  <strong>Will assign to {c.students.length} student(s):</strong>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem" }}>
                    {c.students.slice(0, 8).map(s => (
                      <li key={s._id || s} style={{ fontSize: "0.875rem" }}>
                        {s.name || "Student"} {s.email ? `(${s.email})` : ""}
                      </li>
                    ))}
                    {c.students.length > 8 && <li style={{ color: "#64748b" }}>+{c.students.length - 8} more…</li>}
                  </ul>
                </div>
              );
            })()}
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleAssignQuiz}
              disabled={loading || !assignCourseId}
            >
              {loading ? <Spinner /> : <><IconCheck /> Assign Quiz</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Create Notice Modal */}
      {showCreateNotice && (
        <Modal title="Post Notice" onClose={() => setShowCreateNotice(false)}>
          <div className="modal-body">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="e.g., Midterm Quiz Schedule"
                value={noticeForm.title}
                onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Message *</label>
              <textarea
                placeholder="Details about the notice..."
                value={noticeForm.message}
                onChange={e => setNoticeForm(f => ({ ...f, message: e.target.value }))}
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={noticeForm.category}
                onChange={e => setNoticeForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="General">General</option>
                <option value="Quiz">Quiz</option>
                <option value="Assignment">Assignment</option>
                <option value="Announcement">Announcement</option>
              </select>
            </div>
            <div className="form-group">
              <label>Course (leave blank for a general notice)</label>
              <select
                value={noticeForm.courseId}
                onChange={e => setNoticeForm(f => ({ ...f, courseId: e.target.value }))}
              >
                <option value="">— General (all students) —</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date (optional)</label>
              <input
                type="datetime-local"
                value={noticeForm.dueDate}
                onChange={e => setNoticeForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Expiry Date (optional — notice hides after this)</label>
              <input
                type="datetime-local"
                value={noticeForm.expiryDate}
                onChange={e => setNoticeForm(f => ({ ...f, expiryDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowCreateNotice(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateNotice} disabled={loading}>
              {loading ? <><Spinner /> Posting…</> : <><IconCheck /> Post Notice</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Quiz Submissions Modal */}
      {showQuizSubmissionsModal && selectedQuiz && (
        <Modal
          title={`Submissions — ${selectedQuiz.title}`}
          onClose={() => setShowQuizSubmissionsModal(false)}
        >
          <div className="modal-body">
            {!quizSubmissionsLoading && quizStats && (
              <div className="results-summary" style={{ marginBottom: "1rem" }}>
                <div className="summary-stat">
                  <div className="summary-val">{quizStats.totalSubmitted}/{quizStats.totalAssigned}</div>
                  <div className="summary-lbl">Submitted</div>
                </div>
                <div className="summary-stat">
                  <div className="summary-val">{quizStats.avgScore}/{quizStats.totalMarks}</div>
                  <div className="summary-lbl">Avg Score</div>
                </div>
                <div className="summary-stat">
                  <div className="summary-val">{quizStats.highestScore} / {quizStats.lowestScore}</div>
                  <div className="summary-lbl">High / Low</div>
                </div>
                <div className="summary-stat">
                  <div className="summary-val">{quizStats.passRate}%</div>
                  <div className="summary-lbl">Pass Rate</div>
                </div>
              </div>
            )}
            {quizSubmissionsLoading ? (
              <Spinner />
            ) : quizSubmissions.length === 0 ? (
              <div className="empty-mini">No submissions yet.</div>
            ) : (
              <div className="submissions-list">
                {quizSubmissions.map(sub => (
                  <div key={sub._id} className="submission-item">
                    <div className="submission-info">
                      <div className="student-name">{sub.student?.name || "Student"}</div>
                      <div className="submission-content">
                        {sub.status === "terminated" ? (
                          <span style={{ color: "#dc2626", fontWeight: 600 }}>
                            ⚠️ Auto-submitted (proctoring violations)
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>
                            {sub.status === "graded" ? "Graded" : "Submitted"}
                            {sub.submittedAt ? ` • ${new Date(sub.submittedAt).toLocaleString()}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="submission-right" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="marks-badge">
                        {sub.totalMarksObtained}/{selectedQuiz.totalMarks} {sub.isPassed ? "✓" : "✗"}
                      </span>
                      <button
                        className="btn-small btn-primary"
                        onClick={() => handleOpenReview(sub._id)}
                      >
                        Review
                      </button>
                      {sub.status === "terminated" && (
                        <button
                          className="btn-small btn-secondary"
                          onClick={() => handleGrantReattempt(sub._id)}
                        >
                          Grant Reattempt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowQuizSubmissionsModal(false)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Quiz Attempt Review Modal */}
      {reviewResponse && (
        <Modal
          title={`Review — ${reviewResponse.student?.name || "Student"}`}
          onClose={() => setReviewResponse(null)}
        >
          <div className="modal-body">
            <div className="grade-student-info">
              <strong>Score:</strong> {reviewResponse.totalMarksObtained}/{reviewResponse.quiz?.totalMarks}
              {" "}({reviewResponse.isPassed ? "passed" : "not passed"}, pass mark {reviewResponse.quiz?.passMarks})<br />
              <strong>Status:</strong> {reviewResponse.status === "terminated" ? "Auto-submitted (proctoring violations)" : reviewResponse.status}
            </div>
            <div className="submissions-list">
              {reviewResponse.responses.map((r, idx) => {
                const q = r.question;
                if (!q) return null;
                const answer = Array.isArray(r.studentAnswer) ? r.studentAnswer.join(", ") : r.studentAnswer;
                const answered = answer !== null && answer !== undefined && answer !== "";
                const correct = q.type === "mcq"
                  ? q.options?.filter(o => o.isCorrect).map(o => o.text).join(", ")
                  : q.type === "truefalse" ? String(q.correctAnswer) : null;
                return (
                  <div key={q._id} className="submission-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div className="student-name">Q{idx + 1}. {q.questionText}</div>
                    <div className="submission-content">
                      <strong>Answer:</strong> {answered ? String(answer) : <em>No answer</em>}
                    </div>
                    {correct !== null && (
                      <div className="submission-content"><strong>Correct:</strong> {correct}</div>
                    )}
                    {q.type === "shortanswer" && q.modelAnswer && (
                      <div className="submission-content"><strong>Model answer:</strong> {q.modelAnswer}</div>
                    )}
                    {q.type === "shortanswer" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <input
                          type="number"
                          min="0"
                          max={q.marks}
                          value={reviewMarks[q._id] ?? ""}
                          onChange={e => setReviewMarks(m => ({ ...m, [q._id]: e.target.value }))}
                          style={{ maxWidth: "90px" }}
                        />
                        <span className="text-muted small">/ {q.marks}</span>
                        <button
                          className="btn-small btn-primary"
                          onClick={() => handleGradeShortAnswer(q._id, q.marks)}
                          disabled={gradingQuestionId === q._id}
                        >
                          {gradingQuestionId === q._id ? "Saving…" : r.isGraded ? "Update" : "Save"}
                        </button>
                        {!r.isGraded && <span className="badge badge-warning">Needs grading</span>}
                      </div>
                    ) : (
                      <div className="submission-content">
                        <span className="marks-badge">{r.marksObtained}/{q.marks}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setReviewResponse(null)}>Close</button>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ── Sub-component: links to a submission's files ─────────────────────────
function SubmissionFiles({ submission, onOpen }) {
  if (!submission.files?.length) return <div className="submission-content">No files</div>;
  return (
    <div className="file-chips">
      {submission.files.map(file => (
        <button
          key={file._id}
          type="button"
          className="file-chip"
          onClick={() => onOpen(submission._id, file._id)}
          title={`Open ${file.originalName}`}
        >
          {file.mimeType === "application/pdf" ? "📄" : "🖼️"} {file.originalName}
          <span className="file-chip-size">{formatFileSize(file.size)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Sub-component: Assignment List per course ────────────────────────────
function AssignmentList({ courseId, refreshKey, onViewSubmissions, onEdit, onDelete }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    assignmentAPI.getFacultyAssignments(courseId)
      .then(data => {
        if (active) setAssignments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setAssignments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [courseId, refreshKey]);

  if (loading) return <div style={{ padding: "1rem" }}><div className="spinner-ring" /></div>;

  if (assignments.length === 0) {
    return <div className="assignment-list-empty">
      <p className="text-muted small">No assignments have been created for this course yet.</p>
    </div>;
  }

  return <div className="assignment-list">
    {assignments.map(assignment => {
      const closed = isPastDeadline(assignment.dueDate);
      const toGrade = assignment.submittedCount - assignment.gradedCount;
      return (
        <div key={assignment._id} className="assignment-row">
          <div>
            <strong>{assignment.title}</strong>{" "}
            {closed
              ? <span className="badge badge-notStarted">{assignment.allowLateSubmissions ? "Past due · late allowed" : "Closed"}</span>
              : <span className="badge badge-active">Open</span>}
            <div className="text-muted small">
              {assignment.dueDate ? `Deadline: ${formatDateTime(assignment.dueDate)}` : "No deadline"}
              {!closed && assignment.dueDate && ` (${timeUntil(assignment.dueDate)})`}
              {` · ${assignment.maxMarks ?? 100} marks`}
            </div>
            <div className="text-muted small">
              {assignment.submittedCount}/{assignment.totalStudents} submitted
              {` · ${assignment.gradedCount} graded`}
              {assignment.lateCount > 0 && ` · ${assignment.lateCount} late`}
              {toGrade > 0 && <strong style={{ color: "var(--danger)" }}>{` · ${toGrade} to grade`}</strong>}
            </div>
          </div>
          <div className="actions">
            <button className="btn-primary btn-small" onClick={() => onViewSubmissions(assignment)}>
              Submissions
            </button>
            <button className="btn-secondary btn-small" onClick={() => onEdit(assignment)} title="Edit assignment">
              <IconEdit />
            </button>
            <button className="btn-small btn-danger" onClick={() => onDelete(assignment)} title="Delete assignment">
              <IconTrash />
            </button>
          </div>
        </div>
      );
    })}
  </div>;
}

export default FacultyDashboard;

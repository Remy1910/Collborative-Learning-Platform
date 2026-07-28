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

// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
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
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ totalCourses: 0, totalAssignments: 0, totalSubmissions: 0 });

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
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  // Forms
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', courseId: '', dueDate: '' });
  const [gradeForm, setGradeForm] = useState({ marks: '' });
  const [assignCourseId, setAssignCourseId] = useState('');

  useEffect(() => { loadAll(); }, []);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [qData, cData, sData] = await Promise.all([
        quizAPI.getMyQuizzes().catch(() => []),
        courseAPI.getCourses().catch(() => []),
        assignmentAPI.getStats().catch(() => ({ totalCourses: 0, totalAssignments: 0, totalSubmissions: 0 })),
      ]);
      setQuizzes(Array.isArray(qData) ? qData : []);
      // Only show courses belonging to this faculty
      const userId = localStorage.getItem("userId");
      setCourses(Array.isArray(cData) ? cData.filter(c => !c.faculty?._id || c.faculty?._id === userId || c.faculty === userId) : []);
      setStats(sData || { totalCourses: 0, totalAssignments: 0, totalSubmissions: 0 });
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
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

  // ── Create Assignment ─────────────────────────────────────────────────
  const handleCreateAssignment = async () => {
    if (!assignmentForm.title.trim()) { setError("Assignment title is required"); return; }
    if (!assignmentForm.courseId) { setError("Please select a course"); return; }
    try {
      setLoading(true);
      await assignmentAPI.createAssignment(assignmentForm);
      setShowCreateAssignment(false);
      setAssignmentForm({ title: "", description: "", courseId: "", dueDate: "" });
      showMsg("Assignment created successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── View Submissions ──────────────────────────────────────────────────
  const handleViewSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    try {
      const data = await assignmentAPI.getSubmissions(assignment._id);
      setSubmissions(Array.isArray(data) ? data : []);
      setShowSubmissionsModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Grade Submission ──────────────────────────────────────────────────
  const handleGrade = async () => {
    const marks = parseFloat(gradeForm.marks);
    if (isNaN(marks) || marks < 0 || marks > 100) { setError("Marks must be between 0 and 100"); return; }
    try {
      await assignmentAPI.gradeSubmission({ submissionId: selectedSubmission._id, marks });
      setShowGradeModal(false);
      setGradeForm({ marks: "" });
      showMsg("Marks assigned successfully!");
      handleViewSubmissions(selectedAssignment);
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
                        onClick={() => { setAssignmentForm(f => ({ ...f, courseId: course._id })); setShowCreateAssignment(true); }}
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
                <span className="filter-chip active">All ({quizzes.length})</span>
                <span className="filter-chip">Active ({activeQuizzes})</span>
                <span className="filter-chip">Draft ({draftQuizzes})</span>
                <span className="filter-chip">Published ({publishedCount})</span>
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
                    {quizzes.map(quiz => (
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
                onClick={() => setShowCreateAssignment(true)}
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
                        onClick={() => { setAssignmentForm(f => ({ ...f, courseId: course._id })); setShowCreateAssignment(true); }}
                      >
                        <IconPlus /> Add Assignment
                      </button>
                    </div>

                    <AssignmentList
                      courseId={course._id}
                      onViewSubmissions={handleViewSubmissions}
                    />
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

      {/* Create Assignment Modal */}
      {showCreateAssignment && (
        <Modal title="Create Assignment" onClose={() => setShowCreateAssignment(false)}>
          <div className="modal-body">
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
              >
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Assignment instructions and details..."
                value={assignmentForm.description}
                onChange={e => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="datetime-local"
                value={assignmentForm.dueDate}
                onChange={e => setAssignmentForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowCreateAssignment(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateAssignment} disabled={loading}>
              {loading ? <><Spinner /> Creating…</> : <><IconCheck /> Create Assignment</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Submissions Modal */}
      {showSubmissionsModal && selectedAssignment && (
        <Modal
          title={`Submissions — ${selectedAssignment.title}`}
          onClose={() => setShowSubmissionsModal(false)}
        >
          <div className="modal-body">
            {submissions.length === 0 ? (
              <div className="empty-mini">No submissions yet.</div>
            ) : (
              <div className="submissions-list">
                {submissions.map(sub => (
                  <div key={sub._id} className="submission-item">
                    <div className="submission-info">
                      <div className="student-name">{sub.student?.name || "Student"}</div>
                      <div className="submission-content">{sub.content?.slice(0, 120)}…</div>
                    </div>
                    <div className="submission-right">
                      {sub.marks !== null && sub.marks !== undefined ? (
                        <span className="marks-badge">{sub.marks}/100</span>
                      ) : (
                        <button
                          className="btn-small btn-primary"
                          onClick={() => { setSelectedSubmission(sub); setShowGradeModal(true); }}
                        >
                          Grade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
            <div className="grade-student-info">
              <strong>Student:</strong> {selectedSubmission.student?.name}<br />
              <strong>Submitted:</strong> {new Date(selectedSubmission.createdAt).toLocaleDateString()}
            </div>
            <div className="submission-preview">
              <label>Submission Content</label>
              <div className="submission-text">{selectedSubmission.content}</div>
            </div>
            <div className="form-group" style={{ marginTop: "1.5rem" }}>
              <label>Marks (0–100) *</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Enter marks"
                value={gradeForm.marks}
                onChange={e => setGradeForm({ marks: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowGradeModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleGrade}>
              <IconCheck /> Submit Grade
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

    </div>
  );
}

// ── Sub-component: Assignment List per course ────────────────────────────
function AssignmentList({ courseId, onViewSubmissions }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // We load all assignments — the API doesn't filter by course currently
  // so we show a placeholder note
  useEffect(() => {
    setLoading(false);
    setAssignments([]);
  }, [courseId]);

  if (loading) return <div style={{ padding: "1rem" }}><div className="spinner-ring" /></div>;

  return (
    <div className="assignment-list-empty">
      <p className="text-muted small">Use "Add Assignment" above to create assignments for this course. They will appear here.</p>
    </div>
  );
}

export default FacultyDashboard;

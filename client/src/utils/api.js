const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "http://localhost:5000/api";

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
export const getSubmissionFile = async (submissionId, fileId) => {
  const response = await authFetch(`${API_BASE_URL}/assignments/files/${submissionId}/${fileId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  if (!response.ok) return handleResponse(response);
  return response.blob();
};

// Opens a submitted file in a new tab. The tab is opened synchronously (inside the
// click) so popup blockers allow it, then pointed at the file once it has downloaded.
export const openSubmissionFile = async (submissionId, fileId) => {
  const fileWindow = window.open("about:blank", "_blank");
  try {
    const blob = await getSubmissionFile(submissionId, fileId);
    const url = URL.createObjectURL(blob);
    if (fileWindow) fileWindow.location.href = url;
    else window.location.href = url;
  } catch (err) {
    fileWindow?.close();
    throw err;
  }
};

// Helper to get auth header
export const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const SERVER_UNREACHABLE =
  "Can't reach the server. Check your connection and try again — if the site has been idle it can take up to a minute to wake up.";

// Clears the stored login and sends the user to sign in again. Returns a promise that
// never settles so the caller doesn't go on to treat the failed request as empty data.
const endSession = (reason) => {
  ["token", "userId", "role", "userName"].forEach(key => localStorage.removeItem(key));
  window.location.href = `/login?reason=${reason}`;
  return new Promise(() => {});
};

// Common handling for authenticated requests: expired/invalid logins end the session,
// other failures become an Error carrying the server's message
const handleResponse = async (response) => {
  if (response.ok) return response.json();

  const error = await response.json().catch(() => ({}));
  if (error.code === "SESSION_INVALIDATED") return endSession("session-invalidated");
  if (response.status === 401) return endSession("session-expired");
  throw new Error(error.message || error.error || `Request failed (${response.status})`);
};

const authFetch = async (url, options) => {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(SERVER_UNREACHABLE);
  }
};

// Generic fetch helper
export const apiCall = async (endpoint, options = {}) => {
  const response = await authFetch(`${API_BASE_URL}${endpoint}`, {
    headers: getAuthHeader(),
    ...options,
  });
  return handleResponse(response);
};

// ── Auth API ────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) =>
    fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || "Login failed");
      return json;
    }),

  logout: () => apiCall("/auth/logout", { method: "POST" }),   // <-- added

  register: (data) =>
    fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || "Registration failed");
      return json;
    }),

  forgotPassword: (email) =>
    fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || "Request failed");
      return json;
    }),

  resetPassword: (token, password) =>
    fetch(`${API_BASE_URL}/auth/reset-password/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || "Reset password failed");
      return json;
    }),
};

// ── Course API ───────────────────────────────────────────────────────────────
export const courseAPI = {
  // Get all courses (both faculty and students can see)
  getCourses: () => apiCall("/courses"),

  // Faculty: create a course
  createCourse: (data) =>
    apiCall("/courses", { method: "POST", body: JSON.stringify(data) }),

  // Student: enroll in a course
  enrollCourse: (courseId) =>
    apiCall(`/courses/${courseId}/enroll`, { method: "POST" }),
};

// ── Assignment API ──────────────────────────────────────────────────────────
export const assignmentAPI = {
  // Faculty: create assignment
  createAssignment: (data) =>
    apiCall("/assignments/create", { method: "POST", body: JSON.stringify(data) }),

  // Faculty: edit an assignment (details, deadline, max marks, late policy)
  updateAssignment: (assignmentId, data) =>
    apiCall(`/assignments/${assignmentId}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Faculty: delete an assignment and all of its submissions
  deleteAssignment: (assignmentId) =>
    apiCall(`/assignments/${assignmentId}`, { method: "DELETE" }),

  // Faculty: view submissions for an assignment → { assignment, submissions }
  getSubmissions: (assignmentId) =>
    apiCall(`/assignments/${assignmentId}/submissions`),

  // Faculty: view assignments in one of their courses
  getFacultyAssignments: (courseId) => apiCall(`/assignments/course/${courseId}`),

  // Faculty: grade (or regrade) a submission — { submissionId, marks, feedback }
  gradeSubmission: (data) =>
    apiCall("/assignments/mark", { method: "POST", body: JSON.stringify(data) }),

  // Faculty: stats
  getStats: () => apiCall("/assignments/stats"),

  // Student: submit or resubmit — FormData with assignmentId, optional content (note) and "files"
  submitAssignment: async (data) => {
    // Multipart body — the browser sets Content-Type (with the boundary) itself
    const response = await authFetch(`${API_BASE_URL}/assignments/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: data,
    });
    return handleResponse(response);
  },

  // Student: view own submissions
  getMySubmissions: () => apiCall("/assignments/my-submissions"),

  // Student: view assignments for enrolled courses, each with their own `submission` (or null)
  getAvailableAssignments: () => apiCall("/assignments/available"),
};

// ── Quiz API ─────────────────────────────────────────────────────────────────
export const quizAPI = {
  // Faculty
  createQuiz: (data) =>
    apiCall("/quizzes/create", { method: "POST", body: JSON.stringify(data) }),

  updateQuiz: (quizId, data) =>
    apiCall(`/quizzes/${quizId}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMyQuizzes: (status, subject) => {
    let url = "/quizzes/my-quizzes";
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (subject) params.append("subject", subject);
    if (params.toString()) url += `?${params.toString()}`;
    return apiCall(url);
  },

  publishQuiz: (quizId) =>
    apiCall(`/quizzes/${quizId}/publish`, { method: "POST" }),

  deleteQuiz: (quizId) =>
    apiCall(`/quizzes/${quizId}`, { method: "DELETE" }),

  assignQuizToStudents: (quizId, studentIds) =>
    apiCall(`/quizzes/${quizId}/assign`, {
      method: "POST",
      body: JSON.stringify({ studentIds }),
    }),

  addQuestion: (quizId, data) =>
    apiCall(`/quizzes/${quizId}/questions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQuestion: (quizId, questionId, data) =>
    apiCall(`/quizzes/${quizId}/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteQuestion: (quizId, questionId) =>
    apiCall(`/quizzes/${quizId}/questions/${questionId}`, {
      method: "DELETE",
    }),

  getQuizById: (quizId) => apiCall(`/quizzes/${quizId}`),

  getSubmissions: (quizId) =>
    apiCall(`/quiz-responses/${quizId}/submissions`),

  getStats: (quizId) => apiCall(`/quiz-responses/${quizId}/stats`),

  getResponseDetails: (responseId) =>
    apiCall(`/quiz-responses/${responseId}/details`),

  gradeShortAnswer: (responseId, data) =>
    apiCall(`/quiz-responses/${responseId}/grade`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Student
  getAssignedQuizzes: () => apiCall("/quizzes/assigned/my-quizzes"),

  startQuiz: (quizId) =>
    apiCall(`/quiz-responses/${quizId}/start`, { method: "POST" }),

  saveResponse: (responseId, data) =>
    apiCall(`/quiz-responses/${responseId}/save`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submitQuiz: (responseId) =>
    apiCall(`/quiz-responses/${responseId}/submit`, { method: "POST" }),

  getMyResponse: (quizId) =>
    apiCall(`/quiz-responses/${quizId}/my-response`),

  getMyResults: () => apiCall("/quiz-responses/student/my-results"),

  logViolation: (responseId, data) =>
    apiCall(`/quiz-responses/${responseId}/violation`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  grantReattempt: (responseId, data) =>
    apiCall(`/quiz-responses/${responseId}/grant-reattempt`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Notice API ───────────────────────────────────────────────────────────────
export const noticeAPI = {
  // Faculty
  createNotice: (data) =>
    apiCall("/notices", { method: "POST", body: JSON.stringify(data) }),

  getMyNotices: () => apiCall("/notices/my"),

  deleteNotice: (noticeId) =>
    apiCall(`/notices/${noticeId}`, { method: "DELETE" }),

  // Student
  getNotices: () => apiCall("/notices"),
};

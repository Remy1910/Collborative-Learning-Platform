const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "http://localhost:5001/api";


console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
console.log("API_BASE_URL:", API_BASE_URL);

// Helper to get auth header
export const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// Generic fetch helper
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getAuthHeader();

  const response = await fetch(url, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Network error" }));

    if (error.code === "SESSION_INVALIDATED") {
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("role");
      // adjust the removed keys to match whatever you actually store on login

      window.location.href = "/login?reason=session-invalidated";
      return; // stop here, don't let the caller try to use a rejected response
    }

    throw new Error(error.message || "API Error");
  }

  return response.json();
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

  // Faculty: view submissions for an assignment
  getSubmissions: (assignmentId) =>
    apiCall(`/assignments/${assignmentId}/submissions`),

  // Faculty: grade a submission
  gradeSubmission: (data) =>
    apiCall("/assignments/mark", { method: "POST", body: JSON.stringify(data) }),

  // Faculty: stats
  getStats: () => apiCall("/assignments/stats"),

  // Student: submit assignment
  submitAssignment: (data) =>
    apiCall("/assignments/submit", { method: "POST", body: JSON.stringify(data) }),

  // Student: view own submissions
  getMySubmissions: () => apiCall("/assignments/my-submissions"),
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
};

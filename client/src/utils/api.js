const API_BASE_URL = "http://localhost:5001/api";

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
    const error = await response.json();
    throw new Error(error.message || "API Error");
  }

  return response.json();
};

// Quiz API calls
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

export const courseAPI = {
  getCourses: () => apiCall("/courses"),
  enrollCourse: (courseId) =>
    apiCall(`/courses/${courseId}/enroll`, { method: "POST" }),
};

// How long after submitting a quiz a student may upload photos of their rough work
const ROUGH_WORK_WINDOW_MINUTES = 30;

// Returns the upload deadline for a finished attempt, or null once it has passed
const roughWorkDeadline = (response) => {
  if (!response?.submittedAt) return null;
  const deadline = new Date(new Date(response.submittedAt).getTime() + ROUGH_WORK_WINDOW_MINUTES * 60 * 1000);
  return deadline > new Date() ? deadline : null;
};

module.exports = { ROUGH_WORK_WINDOW_MINUTES, roughWorkDeadline };

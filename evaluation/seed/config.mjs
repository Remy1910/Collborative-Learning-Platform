// Identity of all evaluation data, shared by seed, cleanup and the tests
export const EMAIL_DOMAIN = "@test.local";
export const PASSWORD = "EvalPass#2026";
export const STUDENT_COUNT = 100;
export const FACULTY_EMAIL = `faculty001${EMAIL_DOMAIN}`;
export const COURSE_TAG = "[campuslink-eval]";
export const QUIZ_DURATION_MINUTES = 30;

export const studentEmail = (i) => `student${String(i).padStart(3, "0")}${EMAIL_DOMAIN}`;

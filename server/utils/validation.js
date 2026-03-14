/**
 * Validation utilities for API requests
 */

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const validatePassword = (password) => {
  // Minimum 8 characters (can be customized)
  return password && password.length >= 8;
};

const validateName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 100;
};

const validateMarks = (marks, maxMarks = 100) => {
  return (
    marks !== undefined &&
    marks !== null &&
    typeof marks === "number" &&
    marks >= 0 &&
    marks <= maxMarks &&
    Number.isFinite(marks)
  );
};

const validateTitle = (title) => {
  return title && title.trim().length >= 3 && title.trim().length <= 200;
};

const validateDueDate = (dueDate) => {
  const date = new Date(dueDate);
  return !isNaN(date.getTime()) && date > new Date();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateMarks,
  validateTitle,
  validateDueDate
};

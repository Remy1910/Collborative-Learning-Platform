// Shared assignment rules and formatting. Upload limits mirror server/middleware/assignmentUpload.js.

export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 12 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg"];

export const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "";

// Returns an error message for the selected files, or "" if they can be uploaded
export const validateSubmissionFiles = (files) => {
  if (files.length === 0) return "Attach at least one PDF or JPG file";
  if (files.length > MAX_FILES) return `You can upload at most ${MAX_FILES} files`;
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext))) {
      return `"${file.name}" is not allowed. Only PDF and JPG files can be submitted.`;
    }
    if (file.size > MAX_FILE_SIZE) return `"${file.name}" is larger than 10 MB`;
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_SIZE) return "Files must be 12 MB or smaller in total";
  return "";
};

export const isPastDeadline = (dueDate) => Boolean(dueDate) && new Date(dueDate) < new Date();

// Human-friendly time left until the deadline, e.g. "2 days left", "5 hours left"
export const timeUntil = (dueDate) => {
  if (!dueDate) return "";
  const ms = new Date(dueDate) - new Date();
  if (ms <= 0) return "Deadline passed";
  const hours = Math.floor(ms / 3600e3);
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const minutes = Math.max(1, Math.floor(ms / 60e3));
  return `${minutes} minute${minutes === 1 ? "" : "s"} left`;
};

// Value for an <input type="datetime-local"> in the user's local time zone
export const toDateTimeLocal = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const SUBMISSION_STATUS = {
  not_submitted: { label: "Not submitted", badge: "badge-notStarted" },
  submitted: { label: "Submitted", badge: "badge-completed" },
  late: { label: "Submitted late", badge: "badge-warning" },
  graded: { label: "Graded", badge: "badge-active" },
};

const multer = require("multer");
const path = require("path");

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Files are stored inside the submission document, which MongoDB caps at 16 MB
const MAX_TOTAL_SIZE = 12 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg"];
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/pjpeg"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error(`"${file.originalname}" is not allowed. Only PDF and JPG files can be submitted.`);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "Each file must be 10 MB or smaller",
  LIMIT_FILE_COUNT: `You can upload at most ${MAX_FILES} files`,
  LIMIT_UNEXPECTED_FILE: `You can upload at most ${MAX_FILES} files`
};

// Accepts up to MAX_FILES files in the "files" field and turns upload errors into 400 responses
const uploadSubmissionFiles = (req, res, next) => {
  upload.array("files", MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE" && err.field !== "files") {
        return res.status(400).json({ message: 'Upload files in the "files" field' });
      }
      return res.status(400).json({ message: MULTER_MESSAGES[err.code] || err.message });
    }
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  });
};

// Identifies the real file type from its leading bytes, so a renamed file can't pass as a PDF/JPG
const detectFileType = (buffer) => {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  return null;
};

module.exports = { uploadSubmissionFiles, detectFileType, MAX_TOTAL_SIZE };

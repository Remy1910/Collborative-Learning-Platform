const multer = require("multer");

const MAX_ROUGH_WORK_PHOTOS = 5;
// The browser shrinks photos before upload, so real uploads are well under this
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/pjpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE, files: MAX_ROUGH_WORK_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error("Only JPG, PNG or WebP photos can be uploaded");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "Each photo must be 5 MB or smaller",
  LIMIT_FILE_COUNT: `You can upload at most ${MAX_ROUGH_WORK_PHOTOS} photos`,
  LIMIT_UNEXPECTED_FILE: `Upload at most ${MAX_ROUGH_WORK_PHOTOS} photos in the "photos" field`
};

// Accepts up to MAX_ROUGH_WORK_PHOTOS images in the "photos" field; upload errors become 400s
const uploadRoughWorkPhotos = (req, res, next) => {
  upload.array("photos", MAX_ROUGH_WORK_PHOTOS)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: MULTER_MESSAGES[err.code] || err.message });
    }
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  });
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Identifies the real image type from its leading bytes, so a renamed file can't pass as a photo
const detectImageType = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
      buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
};

module.exports = { uploadRoughWorkPhotos, detectImageType, MAX_ROUGH_WORK_PHOTOS };

# Collaborative Learning Platform

A full-stack Learning Management System (LMS) built with React, Express.js, and MongoDB. Supports faculty and student roles with course management, assignments (with file attachments), a proctored quiz system, and notices.

🔗 **Live Demo**: https://collborative-learning-platform-frontend.onrender.com

---

## Features

### Faculty
- Create and manage courses, and see all enrolled students per course
- Create assignments with a title, description, course, and due date
- View every enrolled student's submission status, including students who haven't submitted yet
- Open/download a student's submitted file directly from the dashboard (PDFs and images open inline; other types download)
- Grade submissions (0–100)
- Build quizzes with MCQ, True/False, and Short Answer questions; edit or soft-delete a quiz, and add/edit/delete individual questions
- Publish quizzes and assign them to specific students
- Grade short-answer responses manually and view per-quiz analytics/stats
- Grant a student a reattempt on a quiz (e.g. after a proctoring violation ended their session early)
- Post notices to a specific course or to everyone, with an optional due/expiry date and category (Quiz / Assignment / General / Announcement); delete notices
- View dashboard stats: total courses, assignments, and submissions

### Student
- Enroll in available courses
- View assignments for enrolled courses and submit written answers, a file (≤10MB), or both
- See submission status (awaiting grade, graded) and final marks
- Take timed quizzes with auto-save on every answer
- Automatic proctoring: tab-switch, fullscreen-exit, and window-blur are logged as violations; the quiz session auto-terminates after 3 violations (faculty can grant a reattempt)
- View grades, results, and quiz history
- See notices relevant to their enrolled courses or posted platform-wide
- Password reset via emailed link if they forget their password

---

## Tech Stack

**Frontend**
- React 18
- Vite
- React Router DOM
- CSS (custom, responsive)

**Backend**
- Node.js
- Express.js
- JWT Authentication (single active session per user — logging in elsewhere invalidates the old session)
- Multer (in-memory) for assignment file uploads, stored as binary data directly on the submission document in MongoDB
- Helmet, express-rate-limit, express-mongo-sanitize

**Database**
- MongoDB Atlas
- Mongoose ODM

**Deployment**
- Render (frontend + backend)
- MongoDB Atlas M0 (free tier)

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

### Clone the repository

```bash
git clone https://github.com/Remy1910/Collborative-Learning-Platform.git
cd Collborative-Learning-Platform
```

### Setup Backend

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:

```
NODE_ENV=development
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URLS=http://localhost:5173
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password
```

> **Note:** `CLIENT_URLS` (plural) can be a comma-separated list, e.g. `http://localhost:5173,https://yourapp.onrender.com` — this lets CORS allow both a local dev client and your deployed frontend at the same time. `EMAIL_USER`/`EMAIL_PASS` are used by Nodemailer to send password-reset emails; without them, "Forgot password" will fail but the rest of the app works fine.

Start the backend:

```bash
npm run dev
```

Server runs on `http://localhost:5001`

### Setup Frontend

```bash
cd client
npm install
```

Create a `.env` file in the `client/` directory:

```
VITE_API_URL=http://localhost:5001
```

Start the frontend:

```bash
npm run dev
```

App runs on `http://localhost:5173`

---

## Project Structure

```
Collborative-Learning-Platform/
├── server/
│   ├── controllers/
│   │   ├── authController.js          # register, login, logout, forgot/reset password
│   │   ├── courseController.js        # create course, enroll, list courses
│   │   ├── assignmentController.js    # create/submit/grade assignments, file upload & download
│   │   ├── quizController.js          # quiz & question CRUD, publish, assign
│   │   ├── quizResponseController.js  # take quiz, auto-save, submit, grading, proctoring, stats
│   │   └── noticeController.js        # create/list/delete notices
│   ├── middleware/
│   │   ├── authMiddleware.js          # JWT verification + single-session enforcement
│   │   ├── roleMiddleware.js          # faculty/student role gate
│   │   └── assignmentUpload.js        # Multer config (memory storage, 10MB limit)
│   ├── models/
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Assignment.js
│   │   ├── Submission.js              # includes embedded file { originalName, mimeType, size, data }
│   │   ├── Quiz.js
│   │   ├── Question.js
│   │   ├── QuizResponse.js
│   │   └── Notice.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── assignmentRoutes.js
│   │   ├── quizRoutes.js
│   │   ├── quizResponseRoutes.js
│   │   └── noticeRoutes.js
│   ├── utils/
│   │   ├── validation.js
│   │   └── sendEmail.js
│   └── server.js
│
├── client/
│   ├── public/
│   │   └── _redirects
│   └── src/
│       ├── hooks/
│       │   └── useQuizProctoring.js    # tab-switch/fullscreen/blur detection during a quiz
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── ForgotPasswordPage.jsx
│       │   ├── ResetPasswordPage.jsx
│       │   ├── FacultyDashboard.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── QuizBuilder.jsx
│       │   └── QuizTaker.jsx
│       ├── utils/
│       │   └── api.js
│       ├── styles/
│       │   └── dashboard.css
│       └── App.jsx
```

---

## API Endpoints

### Auth (rate-limited: 100 requests / 15 min)
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Protected |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password/:token` | Public |

### Courses
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/courses` | Protected |
| POST | `/api/courses` | Faculty |
| POST | `/api/courses/:courseId/enroll` | Student |

### Assignments
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/assignments/create` | Faculty |
| GET | `/api/assignments/course/:courseId` | Faculty |
| GET | `/api/assignments/stats` | Faculty |
| GET | `/api/assignments/:assignmentId/submissions` | Faculty |
| POST | `/api/assignments/mark` | Faculty |
| GET | `/api/assignments/available` | Student |
| POST | `/api/assignments/submit` | Student (multipart/form-data: `assignmentId`, `content`, optional `file`) |
| GET | `/api/assignments/my-submissions` | Student |
| GET | `/api/assignments/files/:submissionId` | Student (owner) or Faculty (course owner) |

### Quizzes
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/quizzes/create` | Faculty |
| GET | `/api/quizzes/my-quizzes` | Faculty |
| PATCH | `/api/quizzes/:quizId` | Faculty |
| DELETE | `/api/quizzes/:quizId` | Faculty (soft delete) |
| POST | `/api/quizzes/:quizId/publish` | Faculty |
| POST | `/api/quizzes/:quizId/assign` | Faculty |
| POST | `/api/quizzes/:quizId/questions` | Faculty |
| PATCH | `/api/quizzes/:quizId/questions/:questionId` | Faculty |
| DELETE | `/api/quizzes/:quizId/questions/:questionId` | Faculty |
| GET | `/api/quizzes/assigned/my-quizzes` | Student |
| GET | `/api/quizzes/:quizId` | Protected (faculty or student) |

### Quiz Responses (taking & grading)
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/quiz-responses/:quizId/start` | Student |
| POST | `/api/quiz-responses/:responseId/save` | Student (auto-save) |
| POST | `/api/quiz-responses/:responseId/violation` | Student (proctoring log) |
| POST | `/api/quiz-responses/:responseId/submit` | Student |
| GET | `/api/quiz-responses/:quizId/my-response` | Student |
| GET | `/api/quiz-responses/student/my-results` | Student |
| POST | `/api/quiz-responses/:responseId/grant-reattempt` | Faculty |
| GET | `/api/quiz-responses/:quizId/submissions` | Faculty |
| PATCH | `/api/quiz-responses/:responseId/grade` | Faculty |
| GET | `/api/quiz-responses/:quizId/stats` | Faculty |

### Notices
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/notices` | Faculty |
| GET | `/api/notices/my` | Faculty |
| DELETE | `/api/notices/:noticeId` | Faculty |
| GET | `/api/notices` | Student |

---

## Assignment File Attachments

Students can attach a file (≤10MB) to an assignment submission, in addition to or instead of written content. Files are stored as binary data directly on the `Submission` document in MongoDB (not on disk), which keeps things simple on Render's ephemeral filesystem and works well under Mongo's 16MB document size limit.

- **Allowed types**: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), plain text, PNG/JPEG/WebP images, ZIP
- **List views** (faculty's submissions list, a student's own submissions) never include the raw file bytes — only metadata (name, type, size) — so those requests stay fast
- **Opening a file**: PDFs, images, and plain text open inline in a new tab; every other type is forced as a real download, since browsers can't render Word/Excel/ZIP files inline
- **Access control**: only the submitting student or the faculty member who owns the course can download a given attachment

---

## Security

- JWT-based authentication with 1-day expiry, single active session per user (logging in on a new device invalidates the old token)
- Role-based access control (faculty / student)
- Bcrypt password hashing
- Helmet.js security headers
- Rate limiting on auth routes (100 requests / 15 min)
- MongoDB injection sanitization
- CORS restricted to an allowlist of origins (`CLIENT_URLS`)
- Input validation on all endpoints
- File uploads restricted by size (10MB) and MIME type allowlist

---

## Deployment

The app is deployed on Render with MongoDB Atlas.

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Render Static Site | https://collborative-learning-platform-frontend.onrender.com |
| Backend | Render Web Service | https://collborative-learning-platform.onrender.com |
| Database | MongoDB Atlas M0 | Mumbai (ap-south-1) |

Auto-deploy is enabled — every push to `main` triggers a new deployment.

---

## Environment Variables

### Backend (`server/.env`)
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: 5001) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `CLIENT_URLS` | Comma-separated list of allowed frontend origins for CORS |
| `EMAIL_USER` | Sender address used for password-reset emails |
| `EMAIL_PASS` | App password / credentials for the email account above |

### Frontend (`client/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

---

## Known Limitations

- Students cannot resubmit an assignment once submitted (faculty must grade what was submitted)
- Assignment due dates are displayed but not enforced — late submissions are still accepted
- No automated test suite yet
- No CI pipeline; deployment config lives only in the Render dashboard, not version-controlled

---

## License

This project is licensed under the MIT License.

---

## Author

**Yash** — Major Project 2026

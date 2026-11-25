# CampusLink — Collaborative Learning Platform

A full-stack Learning Management System (LMS) built with React, Express.js, and MongoDB. Faculty and students get separate dashboards for courses, notices, assignments, and a complete quiz system with browser proctoring, faculty-approved reattempts, and AI-generated revision feedback.

🔗 **Live Demo**: https://collborative-learning-platform-frontend.onrender.com

---

## Features

### Faculty
- Create and manage courses and see enrolled students
- Post notices (Quiz / Assignment / General / Announcement) to one course or to all students, with optional due and expiry dates
- Create, edit and delete assignments with deadlines, max marks and an optional late-submission policy
- Review PDF/JPG submissions and grade them with written feedback (grades can be changed)
- Build quizzes with MCQ (single or multiple correct options), True/False, and Short Answer questions, each tagged with a topic
- Publish and assign quizzes to students
- Grade short answers manually (partial / decimal marks)
- Review proctoring violations and grant a reattempt with a recorded reason
- Optionally require students to upload photos of their rough work after a quiz
- View quiz analytics and submission stats

### Student
- Enroll in courses and see notices for those courses
- Submit assignments as PDF/JPG files (up to 5), resubmit until graded or the deadline passes, and see marks + feedback
- Take timed quizzes with auto-save and automatic submission when time runs out
- Upload rough-work photos within 30 minutes of submitting (when the quiz requires it)
- View grades, results and quiz history
- Get AI feedback on a finished quiz: weak topics, strong topics and what to revise

### Assessment integrity
- **Single active session** — logging in on a second device signs out the first; the first device sees a "session expired" message
- **Quiz proctoring** — the quiz runs in fullscreen after the student accepts the instructions; tab switches, leaving fullscreen and window focus loss are logged on the server with timestamps
- **Auto-submit** — the attempt is submitted automatically at the 3rd violation, keeping saved answers
- **Faculty-approved reattempts** — a terminated attempt is kept (marked superseded) and a new attempt is created only when faculty grant it with a reason
- No per-question correctness is sent to the student while an attempt is in progress

### Grading
- True/False: full marks or zero
- MCQ: each correct option is worth an equal share of the question's marks; each wrong option picked cancels one share (minimum 0). A single-correct MCQ is therefore all-or-nothing.
- Short Answer: graded by faculty against a model answer that students never see

### AI feedback
- Uses the Google Gemini API (free tier works); model set by `GEMINI_MODEL`
- Sends only question text, marks per question, topics and the score summary — never the student's written answers, name, email or credentials
- Advisory only: it cannot change marks, responses or attempt status
- Generated at most once per attempt and stored; overload errors are retried automatically

---

## Tech Stack

**Frontend**
- React 19
- Vite
- React Router DOM
- CSS (custom, responsive)

**Backend**
- Node.js
- Express.js
- JWT Authentication
- Multer (file uploads)
- Nodemailer (password-reset emails)
- `@google/genai` (Gemini API)
- Helmet, express-rate-limit, express-mongo-sanitize

**Database**
- MongoDB Atlas
- Mongoose ODM

**Deployment**
- Render (frontend + backend)
- MongoDB Atlas M0 (free tier)

**Evaluation**
- k6 (load testing)
- Playwright (proctoring tests)

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- A Gemini API key (optional, only for AI feedback) — free from Google AI Studio

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
CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
```

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
│   │   ├── authController.js
│   │   ├── courseController.js
│   │   ├── noticeController.js
│   │   ├── assignmentController.js
│   │   ├── quizController.js
│   │   ├── quizResponseController.js
│   │   └── aiFeedbackController.js
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT + single-session check
│   │   ├── roleMiddleware.js
│   │   ├── assignmentUpload.js      # PDF/JPG upload + file-type check
│   │   └── roughWorkUpload.js       # rough-work photo upload
│   ├── models/
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Notice.js
│   │   ├── Assignment.js
│   │   ├── Submission.js
│   │   ├── Quiz.js
│   │   ├── Question.js
│   │   ├── QuizResponse.js
│   │   └── RoughWorkPhoto.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── noticeRoutes.js
│   │   ├── assignmentRoutes.js
│   │   ├── quizRoutes.js
│   │   └── quizResponseRoutes.js
│   ├── utils/
│   │   ├── validation.js
│   │   ├── sendEmail.js
│   │   └── roughWork.js
│   └── server.js
│
├── client/
│   ├── public/
│   │   └── _redirects
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── ForgotPasswordPage.jsx
│       │   ├── ResetPasswordPage.jsx
│       │   ├── FacultyDashboard.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── QuizBuilder.jsx
│       │   └── QuizTaker.jsx
│       ├── components/
│       │   └── RoughWork.jsx
│       ├── utils/
│       │   └── api.js
│       ├── styles/
│       │   └── dashboard.css
│       └── App.jsx
│
├── evaluation/      # load, proctoring and AI-feedback tests + results (see RESULTS.md)
└── loadtest/        # standalone quiz load-test script
```

---

## API Endpoints

### Auth
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

### Notices
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/notices` | Faculty |
| GET | `/api/notices/my` | Faculty |
| DELETE | `/api/notices/:noticeId` | Faculty |
| GET | `/api/notices` | Student |

### Assignments
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/assignments/create` | Faculty |
| PATCH | `/api/assignments/:id` | Faculty |
| DELETE | `/api/assignments/:id` | Faculty |
| POST | `/api/assignments/submit` (multipart, `files`) | Student |
| POST | `/api/assignments/mark` | Faculty |
| GET | `/api/assignments/:id/submissions` | Faculty |
| GET | `/api/assignments/course/:courseId` | Faculty |
| GET | `/api/assignments/available` | Student |
| GET | `/api/assignments/my-submissions` | Student |
| GET | `/api/assignments/files/:submissionId/:fileId` | Owner student / course faculty |
| GET | `/api/assignments/stats` | Faculty |

### Quizzes
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/quizzes/create` | Faculty |
| GET | `/api/quizzes/my-quizzes` | Faculty |
| GET | `/api/quizzes/:quizId` | Protected |
| PATCH | `/api/quizzes/:quizId` | Faculty |
| DELETE | `/api/quizzes/:quizId` | Faculty |
| POST | `/api/quizzes/:quizId/publish` | Faculty |
| POST | `/api/quizzes/:quizId/assign` | Faculty |
| PATCH | `/api/quizzes/:quizId/rough-work` | Faculty |
| POST | `/api/quizzes/:quizId/questions` | Faculty |
| PATCH | `/api/quizzes/:quizId/questions/:questionId` | Faculty |
| DELETE | `/api/quizzes/:quizId/questions/:questionId` | Faculty |
| GET | `/api/quizzes/assigned/my-quizzes` | Student |

### Quiz responses
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/quiz-responses/:quizId/start` | Student |
| POST | `/api/quiz-responses/:responseId/save` | Student |
| POST | `/api/quiz-responses/:responseId/violation` | Student |
| POST | `/api/quiz-responses/:responseId/submit` | Student |
| POST | `/api/quiz-responses/:responseId/ai-feedback` | Student |
| POST | `/api/quiz-responses/:responseId/rough-work` (multipart, `photos`) | Student |
| GET | `/api/quiz-responses/:responseId/rough-work` | Owner student / faculty |
| GET | `/api/quiz-responses/:responseId/rough-work/:photoId` | Owner student / faculty |
| DELETE | `/api/quiz-responses/:responseId/rough-work/:photoId` | Student |
| GET | `/api/quiz-responses/:quizId/my-response` | Student |
| GET | `/api/quiz-responses/student/my-results` | Student |
| GET | `/api/quiz-responses/:quizId/submissions` | Faculty |
| GET | `/api/quiz-responses/:quizId/stats` | Faculty |
| GET | `/api/quiz-responses/:responseId/details` | Faculty |
| PATCH | `/api/quiz-responses/:responseId/grade` | Faculty |
| POST | `/api/quiz-responses/:responseId/grant-reattempt` | Faculty |

---

## Security

- JWT-based authentication with 1-day expiry
- One active session per account (session ID in the JWT, checked on every request; cached for 30 s per server process)
- Role-based access control (faculty / student)
- Bcrypt password hashing (10 rounds)
- Password-reset tokens stored hashed (SHA-256) and valid for 1 hour
- Helmet.js security headers
- Rate limiting on auth routes (100 requests / 15 min)
- MongoDB injection sanitization
- CORS restricted to the origins in `CLIENT_URLS`
- Uploaded files checked by their content (magic bytes), not just the extension
- Input validation on all endpoints

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
| `PORT` | Server port (defaults to 5000 if unset; the examples here use 5001) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `CLIENT_URL` | Frontend URL used in password-reset emails |
| `CLIENT_URLS` | Comma-separated frontend origins allowed by CORS (defaults to `http://localhost:5173`) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Optional SMTP settings; without them reset emails are logged to the console |
| `GEMINI_API_KEY` | Google Gemini API key; without it the AI feedback button returns an error and everything else works |
| `GEMINI_MODEL` | Optional; Gemini model for AI feedback (defaults to `gemini-3.8-flash`) |
| `AI_FEEDBACK_MAX_CALLS` | Optional; cap on LLM calls per server process (unset = no cap) |

### Frontend (`client/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend origin, without `/api` (defaults to `http://localhost:5000`) |

---

## Evaluation

The `evaluation/` folder contains scripts that measure the system against a separate test database (the `MONGO_URI` database name must end in `_test`). Results and the test setup are in [`evaluation/RESULTS.md`](evaluation/RESULTS.md).

Summary of the latest run (single Node.js process on a laptop, MongoDB Atlas M0):
- **Load test (k6):** up to 100 students starting a quiz at once — 4,550 requests, 0 errors; auto-save and submit medians 60–98 ms
- **Single session:** 20/20 accounts correctly signed out the older session
- **Proctoring false positives (Playwright, Chromium + Edge):** 40 of 120 honest sessions logged one violation, none reached auto-submit; a deliberate tab switch was caught 20/20 times
- **AI feedback:** 40/40 attempts got feedback; no output called a fully correct topic weak

```bash
cd evaluation
npm install
npm run seed         # create test data
npm run load         # load + single-session test
npm run proctoring   # proctoring false-positive test (opens browser windows)
npm run ai           # AI feedback test
npm run cleanup      # remove test data
```

---

## License

This project is licensed under the MIT License.

---

## Authors

Himanshu Aditya, Tharini T N, Yash Rajkumar Jadhav — Major Project 2025-26, Dept. of E&TE, Siddaganga Institute of Technology, Tumakuru (guide: Dr. Rakesh M B)

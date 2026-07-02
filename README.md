# Collaborative Learning Platform

A full-stack Learning Management System (LMS) built with React, Express.js, and MongoDB. Supports faculty and student roles with course management, assignments, and a complete quiz system.

🔗 **Live Demo**: https://collborative-learning-platform-frontend.onrender.com

---

## Features

### Faculty
- Create and manage courses
- Create assignments with due dates
- Grade student submissions
- Build quizzes with MCQ, True/False, and Short Answer questions
- Publish and assign quizzes to students
- View analytics and submission stats

### Student
- Enroll in courses
- Submit assignments
- Take timed quizzes with auto-save
- View grades and results
- Track quiz history and scores

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
- JWT Authentication
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
CLIENT_URL=http://localhost:5173
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
│   │   ├── assignmentController.js
│   │   ├── quizController.js
│   │   └── quizResponseController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── roleMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Assignment.js
│   │   ├── Submission.js
│   │   ├── Quiz.js
│   │   ├── Question.js
│   │   └── QuizResponse.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── assignmentRoutes.js
│   │   ├── quizRoutes.js
│   │   └── quizResponseRoutes.js
│   ├── utils/
│   │   └── validation.js
│   └── server.js
│
├── client/
│   ├── public/
│   │   └── _redirects
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
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

### Auth
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |

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
| POST | `/api/assignments/submit` | Student |
| POST | `/api/assignments/mark` | Faculty |
| GET | `/api/assignments/:id/submissions` | Faculty |
| GET | `/api/assignments/my-submissions` | Student |
| GET | `/api/assignments/stats` | Faculty |

### Quizzes
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/quizzes/create` | Faculty |
| GET | `/api/quizzes/my-quizzes` | Faculty |
| POST | `/api/quizzes/:id/publish` | Faculty |
| POST | `/api/quizzes/:id/assign` | Faculty |
| GET | `/api/quizzes/assigned/my-quizzes` | Student |
| POST | `/api/quiz-responses/:id/start` | Student |
| POST | `/api/quiz-responses/:id/submit` | Student |
| GET | `/api/quiz-responses/student/my-results` | Student |

---

## Security

- JWT-based authentication with 1-day expiry
- Role-based access control (faculty / student)
- Bcrypt password hashing (10 rounds)
- Helmet.js security headers
- Rate limiting on auth routes (100 requests / 15 min)
- MongoDB injection sanitization
- CORS restricted to frontend origin
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
| `PORT` | Server port (default: 5001) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `CLIENT_URL` | Frontend URL for CORS |

### Frontend (`client/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

---

## License

This project is licensed under the MIT License.

---

## Author

**Yash** — Major Project 2026

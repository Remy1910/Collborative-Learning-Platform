# 🚀 QUICK API REFERENCE (After Changes)

## Authentication Endpoints

### Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",        // Required: 2-100 chars
  "email": "john@uni.edu",   // Required: valid email
  "password": "Secure@123",  // Required: min 8 chars
  "role": "student"          // Required: "student", "faculty", "admin"
}

Response 201:
{
  "message": "User registered successfully"
}

Response 400:
{
  "message": "Password must be at least 8 characters"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@uni.edu",   // Required: valid email
  "password": "Secure@123"   // Required
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "student",
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe"
}

Response 401:
{
  "message": "Invalid credentials"
}
```

---

## Course Endpoints

### Create Course (Faculty Only)
```bash
POST /api/courses
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Introduction to Web Development",  // Required: 3-200 chars
  "description": "Learn HTML, CSS, and JS"     // Optional: max 2000 chars
}

Response 201:
{
  "message": "Course created successfully",
  "course": { _id, title, description, faculty, students, timestamps }
}
```

### Get All Courses (Protected)
```bash
GET /api/courses
Authorization: Bearer <token>

Response 200: Array of courses with faculty and student details
```

### Enroll in Course (Student Only)
```bash
POST /api/courses/:courseId/enroll
Authorization: Bearer <token>

Response 200:
{
  "message": "Enrolled in course successfully",
  "course": { _id, title, students: count }
}

Response 400:
{
  "message": "You are already enrolled in this course"
}

Response 403:
{
  "message": "You are not authorized to view submissions for this assignment"
}
```

---

## Assignment Endpoints

### Create Assignment (Faculty Only)
```bash
POST /api/assignments/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Assignment 1 - HTML Basics",           // Required: 3-200 chars
  "description": "Create a personal webpage",      // Optional: max 2000 chars
  "courseId": "507f1f77bcf86cd799439011",         // Required: valid course ID
  "dueDate": "2026-04-14T23:59:59Z"               // Optional: must be future date
}

Response 201:
{
  "message": "Assignment created successfully",
  "assignment": { _id, title, description, course, createdBy, dueDate, timestamps }
}

Response 400:
{
  "message": "Assignment title must be between 3-200 characters"
}

Response 403:
{
  "message": "You are not authorized to create assignments for this course"
}
```

### Submit Assignment (Student Only)
```bash
POST /api/assignments/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "assignmentId": "507f1f77bcf86cd799439011",  // Required: valid assignment ID
  "content": "My HTML code here..."             // Required: 1-50000 chars
}

Response 201:
{
  "message": "Assignment submitted successfully",
  "submission": { _id, assignment, student, content, marks, timestamps }
}

Response 400:
{
  "message": "You have already submitted this assignment. Contact faculty for resubmission."
}

Response 403:
{
  "message": "You are not enrolled in this course"
}
```

### Grade Submission (Faculty Only) ✅ NOW SECURE
```bash
POST /api/assignments/mark
Authorization: Bearer <token>
Content-Type: application/json

{
  "submissionId": "507f1f77bcf86cd799439011",  // Required: valid submission ID
  "marks": 85                                    // Required: number 0-100
}

Response 200:
{
  "message": "Marks assigned successfully",
  "submission": { _id, assignment, student, content, marks, timestamps }
}

Response 400:
{
  "message": "Marks must be a number between 0 and 100"
}

Response 403:
{
  "message": "You are not authorized to grade submissions for this assignment"  // ✅ NEW
}
```

### View Submissions (Faculty Only) ✅ NOW SECURE
```bash
GET /api/assignments/:assignmentId/submissions
Authorization: Bearer <token>

Response 200: Array of submissions

Response 403:
{
  "message": "You are not authorized to view submissions for this assignment"  // ✅ NEW
}
```

### Faculty Dashboard Stats ✅ NEWLY ADDED
```bash
GET /api/assignments/stats
Authorization: Bearer <token>

Response 200:
{
  "totalCourses": 3,
  "totalAssignments": 12,
  "totalSubmissions": 45
}
```

### View My Submissions (Student Only)
```bash
GET /api/assignments/my-submissions
Authorization: Bearer <token>

Response 200: Array of student's submissions with grades and feedback
```

---

## Error Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Login successful, content returned |
| 201 | Created | User registered, course created |
| 400 | Bad Request | Invalid input validation error |
| 401 | Unauthorized | Invalid credentials or expired token |
| 403 | Forbidden | Don't have permission for this action |
| 404 | Not Found | Course/assignment/submission doesn't exist |
| 500 | Server Error | Database error, unexpected issue |

---

## Authorization Matrix

| Role | Can Do |
|------|--------|
| **Student** | Login, Register as student, Enroll in courses, Submit assignments, View own grades, View own submissions |
| **Faculty** | Login, Register as faculty, Create courses, Create assignments, Grade submissions (only own course), View submissions (only own course), View stats |
| **Admin** | (Not yet implemented) Should have access to everything |

---

## Testing with cURL

### Login Example
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@uni.edu",
    "password": "SecurePass123"
  }'
```

### Create Course (with token)
```bash
FACULTY_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:5000/api/courses \
  -H "Authorization: Bearer $FACULTY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Web Development 101",
    "description": "Learn modern web technologies"
  }'
```

### Grade Submission (with token, AUTHORIZATION VERIFIED)
```bash
curl -X POST http://localhost:5000/api/assignments/mark \
  -H "Authorization: Bearer $FACULTY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionId": "507f1f77bcf86cd799439011",
    "marks": 92
  }'
```

---

## Key Improvements Made

✅ **Authorization Checks**
- Faculty can only grade/view their own course's submissions
- Students can only submit for courses they're enrolled in

✅ **Input Validation**
- Email format validation
- Password minimum 8 characters
- Title length constraints (3-200 chars)
- Marks range 0-100
- Due dates must be in future

✅ **Better Error Messages**
- Clear, descriptive error messages
- Proper HTTP status codes
- Helpful guidance on what went wrong

✅ **Removed Duplicates**
- Single course enrollment endpoint
- Cleaner, more maintainable API

✅ **New Features**
- Faculty stats endpoint added and working
- Better response structures
- Additional user data returned on login

---

Last updated: 2026-03-14

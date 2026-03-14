import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import FacultyDashboard from "./pages/FacultyDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import QuizTaker from "./pages/QuizTaker";
import QuizBuilder from "./pages/QuizBuilder";

// Protected Route component
function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/" />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginPage />} />

        {/* Faculty dashboard */}
        <Route
          path="/faculty/dashboard"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        {/* Quiz builder */}
        <Route
          path="/faculty/quiz-builder"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <QuizBuilder />
            </ProtectedRoute>
          }
        />

        {/* Student dashboard */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Quiz taker */}
        <Route
          path="/quiz/:quizId/take"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <QuizTaker />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

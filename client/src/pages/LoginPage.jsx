import { useState } from "react";
import { authAPI } from "../utils/api";
import "../styles/login.css";

// ── SVG Icons (zero extra deps) ──
const IconGrad = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

function LoginPage() {
  // ── Your original state — untouched ──
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Added UI state ──
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 6) errs.password = "At least 6 characters.";
    return errs;
  };

  // ── Your original handleSubmit — logic unchanged ──
  const handleSubmit = async () => {
    setError("");
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrs(errs); return; }
    setFieldErrs({});
    setLoading(true);

    try {
      const data = await authAPI.login({ email, password, role });

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", role);
      if (data.userId) localStorage.setItem("userId", data.userId);
      if (data.name) localStorage.setItem("userName", data.name);

      if (role === "student") {
        window.location.href = "/student/dashboard";
      } else {
        window.location.href = "/faculty/dashboard";
      }
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    }

    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === "Enter") handleSubmit(); };
  const clearFieldErr = (f) => setFieldErrs((p) => ({ ...p, [f]: undefined }));

  return (
    <div className="cl-page">

      {/* LEFT PANEL */}
      <div className="cl-left">
        <div className="cl-brand">
          <div className="cl-brand-mark"><IconGrad /></div>
          <span className="cl-brand-name">CampusLink</span>
        </div>

        <div className="cl-hero">
          <span className="cl-eyebrow">Academic Portal</span>
          <h1 className="cl-hero-title">Your campus,<br /><em>connected.</em></h1>
          <p className="cl-hero-desc">
            Submit assessments, take quizzes, and track your progress — everything you need, in one place.
          </p>
        </div>

        <div className="cl-stats">
          <div className="cl-stat">
            <span className="cl-stat-val">2.4k</span>
            <span className="cl-stat-lbl">Students</span>
          </div>
          <div className="cl-stat-div" />
          <div className="cl-stat">
            <span className="cl-stat-val">180</span>
            <span className="cl-stat-lbl">Faculty</span>
          </div>
          <div className="cl-stat-div" />
          <div className="cl-stat">
            <span className="cl-stat-val">340+</span>
            <span className="cl-stat-lbl">Courses</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="cl-right">
        <div className="cl-card">

          <div className="cl-card-header">
            <h2>Sign in</h2>
            <p>Access your {role} account</p>
          </div>

          {/* Role toggle — replaces the plain <select> */}
          <div className="cl-toggle">
            <button
              className={`cl-toggle-btn${role === "student" ? " active" : ""}`}
              onClick={() => { setRole("student"); setError(""); }}
            >
              🎓 Student
            </button>
            <button
              className={`cl-toggle-btn${role === "faculty" ? " active" : ""}`}
              onClick={() => { setRole("faculty"); setError(""); }}
            >
              🏫 Faculty
            </button>
          </div>

          {/* Error alert */}
          {error && (
            <div className="cl-alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email field */}
          <div className="cl-field">
            <label htmlFor="cl-email">Email address</label>
            <div className="cl-input-wrap">
              <span className="cl-input-icon"><IconUser /></span>
              <input
                id="cl-email"
                type="email"
                className={`cl-input${fieldErrs.email ? " error" : ""}`}
                placeholder={role === "student" ? "student@college.edu" : "faculty@college.edu"}
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldErr("email"); }}
                onKeyDown={handleKey}
                autoComplete="email"
              />
            </div>
            {fieldErrs.email && <span className="cl-field-err">{fieldErrs.email}</span>}
          </div>

          {/* Password field */}
          <div className="cl-field">
            <label htmlFor="cl-password">Password</label>
            <div className="cl-input-wrap">
              <span className="cl-input-icon"><IconLock /></span>
              <input
                id="cl-password"
                type={showPwd ? "text" : "password"}
                className={`cl-input${fieldErrs.password ? " error" : ""}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldErr("password"); }}
                onKeyDown={handleKey}
                autoComplete="current-password"
              />
              <button className="cl-eye-btn" type="button" onClick={() => setShowPwd((s) => !s)} tabIndex={-1}>
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {fieldErrs.password && <span className="cl-field-err">{fieldErrs.password}</span>}
          </div>

          {/* Forgot password */}
          <div className="cl-forgot-row">
            <a href="/forgot-password" className="cl-link">Forgot password?</a>
          </div>

          {/* Submit — calls your original handleSubmit */}
          <button className="cl-btn" onClick={handleSubmit} disabled={loading}>
            {loading
              ? <><div className="cl-spinner" />Signing in…</>
              : <>{`Sign in as ${role === "student" ? "Student" : "Faculty"}`}<IconArrow /></>
            }
          </button>

          <div className="cl-divider"><span>or</span></div>

          <p className="cl-footer">
            No account?{" "}
            <a href="/register" className="cl-link">Register here</a>
          </p>
        </div>
      </div>

    </div>
  );
}

export default LoginPage;

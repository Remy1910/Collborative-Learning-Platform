import { useState } from "react";
import { authAPI } from "../utils/api";
import "../styles/login.css";

// SVG Icons
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
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  const [devLink, setDevLink] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    setDevLink("");
    
    if (!email.trim()) {
      setFieldErr("Email is required.");
      return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErr("Enter a valid email.");
      return;
    }
    setFieldErr("");
    setLoading(true);

    try {
      const res = await authAPI.forgotPassword(email);
      setSuccess(res.message || "A reset link has been sent to your email.");
      
      // If we got a dev URL back, save it to show in a UI helper
      if (res.devResetUrl) {
        setDevLink(res.devResetUrl);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="cl-page">
      {/* LEFT PANEL */}
      <div className="cl-left">
        <div className="cl-brand">
          <div className="cl-brand-mark"><IconGrad /></div>
          <span className="cl-brand-name">CampusLink</span>
        </div>

        <div className="cl-hero">
          <span className="cl-eyebrow">Account Recovery</span>
          <h1 className="cl-hero-title">Recover your<br /><em>access.</em></h1>
          <p className="cl-hero-desc">
            No worries! Enter your registered email address below, and we'll help you get back on track.
          </p>
        </div>

        <div className="cl-stats">
          <div className="cl-stat">
            <span className="cl-stat-val">Secure</span>
            <span className="cl-stat-lbl">Hashing</span>
          </div>
          <div className="cl-stat-div" />
          <div className="cl-stat">
            <span className="cl-stat-val">1-Hr</span>
            <span className="cl-stat-lbl">Token Expiry</span>
          </div>
          <div className="cl-stat-div" />
          <div className="cl-stat">
            <span className="cl-stat-val">Easy</span>
            <span className="cl-stat-lbl">Recovery</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="cl-right">
        <div className="cl-card">
          <div className="cl-card-header">
            <h2>Forgot Password</h2>
            <p>Enter email to receive a reset link</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="cl-alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="cl-alert" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Dev Helper Link Box */}
          {devLink && (
            <div className="cl-alert" style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e40af", display: "block" }}>
              <strong style={{ display: "block", marginBottom: "4px" }}>🔧 Developer Mode:</strong>
              <span style={{ wordBreak: "break-all", fontSize: "0.8rem" }}>
                We detected the mailer is in console simulation mode. You can click the link below to go directly to reset password:
              </span>
              <a 
                href={devLink} 
                className="cl-link" 
                style={{ display: "block", marginTop: "8px", fontWeight: "600", textDecoration: "underline" }}
              >
                Go to Reset Password Form
              </a>
            </div>
          )}

          {!success && (
            <>
              {/* Email field */}
              <div className="cl-field">
                <label htmlFor="cl-email">Email address</label>
                <div className="cl-input-wrap">
                  <span className="cl-input-icon"><IconUser /></span>
                  <input
                    id="cl-email"
                    type="email"
                    className={`cl-input${fieldErr ? " error" : ""}`}
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErr(""); }}
                    onKeyDown={handleKey}
                    autoComplete="email"
                  />
                </div>
                {fieldErr && <span className="cl-field-err">{fieldErr}</span>}
              </div>

              {/* Submit */}
              <button className="cl-btn" onClick={handleSubmit} disabled={loading}>
                {loading
                  ? <><div className="cl-spinner" />Sending link…</>
                  : <><span style={{ marginRight: 4 }}>Send Reset Link</span><IconArrow /></>
                }
              </button>
            </>
          )}

          {success && (
            <button className="cl-btn" onClick={() => window.location.href = "/"} style={{ background: "#2563eb" }}>
              Back to Login
            </button>
          )}

          <div className="cl-divider"><span>or</span></div>

          <p className="cl-footer">
            Remember your password?{" "}
            <a href="/" className="cl-link">Back to sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;

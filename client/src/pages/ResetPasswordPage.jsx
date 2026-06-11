import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authAPI } from "../utils/api";
import "../styles/login.css";

// SVG Icons
const IconGrad = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
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

function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});

  const validate = () => {
    const errs = {};
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    return errs;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrs(errs);
      return;
    }
    setFieldErrs({});
    setLoading(true);

    try {
      await authAPI.resetPassword(token, password);
      setSuccess("Your password has been reset successfully!");
      // Automatically redirect to login page after 3 seconds
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (err) {
      setError(err.message || "Failed to reset password. The token may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const clearFieldErr = (field) => {
    setFieldErrs((prev) => ({ ...prev, [field]: undefined }));
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
          <span className="cl-eyebrow">Security Update</span>
          <h1 className="cl-hero-title">Reset your<br /><em>password.</em></h1>
          <p className="cl-hero-desc">
            Choose a strong, unique password to secure your academic profile. 
          </p>
        </div>

        <div className="cl-stats">
          <div className="cl-stat">
            <span className="cl-stat-val">Strong</span>
            <span className="cl-stat-lbl">Entropy</span>
          </div>
          <div className="cl-stat-div" />
          <div className="cl-stat">
            <span className="cl-stat-val">BCrypt</span>
            <span className="cl-stat-lbl">Encryption</span>
          </div>
          <div className="cl-stat-div" />
          <div className="cl-stat">
            <span className="cl-stat-val">Instant</span>
            <span className="cl-stat-lbl">Activation</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="cl-right">
        <div className="cl-card">
          <div className="cl-card-header">
            <h2>Reset Password</h2>
            <p>Enter your new password below</p>
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
              <span>{success} Redirecting to login...</span>
            </div>
          )}

          {!success && (
            <>
              {/* Password field */}
              <div className="cl-field">
                <label htmlFor="cl-password">New Password</label>
                <div className="cl-input-wrap">
                  <span className="cl-input-icon"><IconLock /></span>
                  <input
                    id="cl-password"
                    type={showPwd ? "text" : "password"}
                    className={`cl-input${fieldErrs.password ? " error" : ""}`}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldErr("password"); }}
                    onKeyDown={handleKey}
                    autoComplete="new-password"
                  />
                  <button className="cl-eye-btn" type="button" onClick={() => setShowPwd((s) => !s)} tabIndex={-1}>
                    {showPwd ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {fieldErrs.password && <span className="cl-field-err">{fieldErrs.password}</span>}
              </div>

              {/* Confirm Password field */}
              <div className="cl-field" style={{ marginBottom: 24 }}>
                <label htmlFor="cl-confirm-password">Confirm Password</label>
                <div className="cl-input-wrap">
                  <span className="cl-input-icon"><IconLock /></span>
                  <input
                    id="cl-confirm-password"
                    type={showConfirmPwd ? "text" : "password"}
                    className={`cl-input${fieldErrs.confirmPassword ? " error" : ""}`}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearFieldErr("confirmPassword"); }}
                    onKeyDown={handleKey}
                    autoComplete="new-password"
                  />
                  <button className="cl-eye-btn" type="button" onClick={() => setShowConfirmPwd((s) => !s)} tabIndex={-1}>
                    {showConfirmPwd ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {fieldErrs.confirmPassword && <span className="cl-field-err">{fieldErrs.confirmPassword}</span>}
              </div>

              {/* Submit */}
              <button className="cl-btn" onClick={handleSubmit} disabled={loading}>
                {loading
                  ? <><div className="cl-spinner" />Saving Password…</>
                  : <><span style={{ marginRight: 4 }}>Save Password</span><IconArrow /></>
                }
              </button>
            </>
          )}

          {success && (
            <button className="cl-btn" onClick={() => navigate("/")} style={{ background: "#2563eb" }}>
              Back to Login Now
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

export default ResetPasswordPage;

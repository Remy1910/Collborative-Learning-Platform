const User = require("../models/User");
console.log("User model check:", User);
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validateEmail, validatePassword, validateName } = require("../utils/validation");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

// REGISTER
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate inputs
    if (!validateName(name)) {
      return res.status(400).json({ message: "Name must be between 2-100 characters" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    if (!["student", "faculty", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be student, faculty, or admin" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role
    });

    res.status(201).json({ message: "User registered successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ message: `Access denied. Please use the ${user.role} portal.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate a new session ID and store it — this invalidates any previous session
    const sessionId = crypto.randomBytes(16).toString("hex");
    user.currentSessionId = sessionId;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, sessionId },   // <-- sessionId added
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      userId: user._id,
      name: user.name
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return success to avoid user enumeration, but include simulated message in dev
      const devPayload = {
        message: "If a user with that email is registered, a password reset link has been sent."
      };
      return res.json(devPayload);
    }

    // Generate random token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token and set to resetPasswordToken field in db
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Create reset URL
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Please click the following link to reset your password:\n\n${resetUrl}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.`;

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e4e7ec; border-radius: 10px;">
        <h2 style="color: #0f1f3d; text-align: center;">CampusLink Password Reset</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your CampusLink account. Please click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p style="font-size: 0.85rem; color: #6b7280;">If you didn't request this, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e4e7ec; margin: 20px 0;" />
        <p style="font-size: 0.75rem; color: #9ca3af; text-align: center;">CampusLink Academic Portal</p>
      </div>
    `;

    // Try to send email
    const emailResult = await sendEmail({
      to: user.email,
      subject: "CampusLink Password Reset Request",
      text: message,
      html: htmlMessage,
    });

    const responsePayload = {
      message: "If a user with that email is registered, a password reset link has been sent.",
    };

    // If email is simulated, return the URL in response payload for easy local testing
    if (emailResult && emailResult.status === "simulated") {
      responsePayload.devResetUrl = resetUrl;
      responsePayload.devToken = resetToken;
    }

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!validatePassword(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.currentSessionId = null;   // <-- added: invalidate any active session

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGOUT
const logout = async (req, res) => {
  try {
    // req.user is set by the protect middleware — it's the decoded JWT payload
    await User.findByIdAndUpdate(req.user.id, { currentSessionId: null });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login, forgotPassword, resetPassword, logout };

const User = require("../models/User");
console.log("User model check:", User);
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validateEmail, validatePassword, validateName } = require("../utils/validation");

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
    const { email, password } = req.body;

    // Validate inputs
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
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

module.exports = { register, login };

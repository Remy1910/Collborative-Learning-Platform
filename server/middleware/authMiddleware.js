const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("currentSessionId");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.currentSessionId !== decoded.sessionId) {
      return res.status(401).json({
        message: "Logged in on another device",
        code: "SESSION_INVALIDATED",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = protect;
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Every authenticated request needs the user's current session ID. Caching it briefly saves a
// database read per request; login, logout and password reset clear the entry so a new session
// takes effect immediately on this server.
const SESSION_CACHE_TTL_MS = 30 * 1000;
const sessionCache = new Map(); // userId -> { sessionId, expiresAt }

const clearSessionCache = (userId) => sessionCache.delete(String(userId));

const getCurrentSessionId = async (userId) => {
  const cached = sessionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.sessionId;

  const user = await User.findById(userId).select("+currentSessionId").lean();
  if (!user) {
    sessionCache.delete(userId);
    return undefined;
  }

  // Older user documents may not have the field at all
  const sessionId = user.currentSessionId ?? null;
  sessionCache.set(userId, { sessionId, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
  return sessionId;
};

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentSessionId = await getCurrentSessionId(String(decoded.id));

    if (currentSessionId === undefined) {
      return res.status(401).json({ message: "User not found" });
    }

    if (currentSessionId !== decoded.sessionId) {
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
module.exports.clearSessionCache = clearSessionCache;

// Shared database access for the evaluation scripts.
// Uses the server's own Mongoose models (and its mongoose instance) so seeded data has exactly
// the shape the app writes, and refuses to touch any database whose name doesn't end in "_test".
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EVAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SERVER_DIR = join(EVAL_DIR, "..", "server");

const requireFromServer = createRequire(join(SERVER_DIR, "package.json"));
requireFromServer("dotenv").config({ path: join(SERVER_DIR, ".env"), quiet: true });

export const mongoose = requireFromServer("mongoose");
export const bcrypt = requireFromServer("bcrypt");

export const models = {
  User: requireFromServer("./models/User"),
  Course: requireFromServer("./models/Course"),
  Quiz: requireFromServer("./models/Quiz"),
  Question: requireFromServer("./models/Question"),
  QuizResponse: requireFromServer("./models/QuizResponse"),
  RoughWorkPhoto: requireFromServer("./models/RoughWorkPhoto"),
};

// EVAL_MONGO_URI lets the tests use a different database from server/.env if needed
export const MONGO_URI = process.env.EVAL_MONGO_URI || process.env.MONGO_URI;

export const databaseName = (uri) => {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
};

export const connect = async () => {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set (server/.env or EVAL_MONGO_URI)");
  const name = databaseName(MONGO_URI);
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run: database name is "${name || "(none — defaults to test)"}". ` +
      `Put a database ending in "_test" in the URI path, e.g. .../campuslink_test`
    );
  }
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  // The server builds these indexes on startup; build them here too so a fresh DB behaves the same
  await Promise.all(Object.values(models).map(m => m.syncIndexes()));
  return name;
};

export const disconnect = () => mongoose.disconnect();

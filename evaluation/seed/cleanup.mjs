#!/usr/bin/env node
// Removes all evaluation data (users @test.local, their courses/quizzes/questions/attempts).
//   node seed/cleanup.mjs                  delete everything the seed created
//   node seed/cleanup.mjs --attempts-only  keep users/courses/quizzes, delete only quiz attempts
//                                          and reset login sessions (run before each load/proctoring test)
import { fileURLToPath } from "node:url";
import { connect, disconnect, models } from "../lib/db.mjs";
import { EMAIL_DOMAIN } from "./config.mjs";

const { User, Course, Quiz, Question, QuizResponse, RoughWorkPhoto } = models;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EVAL_EMAIL = new RegExp(`${escapeRegex(EMAIL_DOMAIN)}$`, "i");

export const findEvalScope = async () => {
  const users = await User.find({ email: EVAL_EMAIL }).select("_id role").lean();
  const userIds = users.map(u => u._id);
  const facultyIds = users.filter(u => u.role === "faculty").map(u => u._id);
  const quizIds = (await Quiz.find({ createdBy: { $in: facultyIds } }).select("_id").lean()).map(q => q._id);
  return { userIds, facultyIds, quizIds };
};

export const deleteAttempts = async ({ userIds, quizIds }) => {
  const filter = { $or: [{ quiz: { $in: quizIds } }, { student: { $in: userIds } }] };
  const photos = await RoughWorkPhoto.deleteMany(filter);
  const attempts = await QuizResponse.deleteMany(filter);
  await User.updateMany({ _id: { $in: userIds } }, { $set: { currentSessionId: null } });
  return { attempts: attempts.deletedCount, roughWorkPhotos: photos.deletedCount };
};

export const deleteAll = async (scope) => {
  const counts = await deleteAttempts(scope);
  counts.questions = (await Question.deleteMany({ quiz: { $in: scope.quizIds } })).deletedCount;
  counts.quizzes = (await Quiz.deleteMany({ _id: { $in: scope.quizIds } })).deletedCount;
  counts.courses = (await Course.deleteMany({ faculty: { $in: scope.facultyIds } })).deletedCount;
  counts.users = (await User.deleteMany({ _id: { $in: scope.userIds }, email: EVAL_EMAIL })).deletedCount;
  return counts;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const attemptsOnly = process.argv.includes("--attempts-only");
  try {
    const db = await connect();
    const scope = await findEvalScope();
    const counts = attemptsOnly ? await deleteAttempts(scope) : await deleteAll(scope);
    console.log(`[${db}] ${attemptsOnly ? "attempts reset" : "evaluation data removed"}:`, counts);
  } catch (err) {
    console.error("Cleanup failed:", err.message);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
}

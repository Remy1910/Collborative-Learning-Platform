#!/usr/bin/env node
// Seeds the test database with 1 faculty, 100 students, 5 courses (everyone enrolled in all 5)
// and one published 10-question quiz per course, assigned to every student.
// Re-runnable: it first removes the previous evaluation data, then recreates it.
// Writes seed/manifest.json (ids, emails, password) for the load and proctoring tests.
//   node seed/seed.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { connect, disconnect, models, bcrypt, EVAL_DIR } from "../lib/db.mjs";
import { findEvalScope, deleteAll } from "./cleanup.mjs";
import { COURSES } from "./questionBank.mjs";
import {
  PASSWORD, STUDENT_COUNT, FACULTY_EMAIL, COURSE_TAG, QUIZ_DURATION_MINUTES, studentEmail
} from "./config.mjs";

const { User, Course, Quiz, Question } = models;
const BCRYPT_ROUNDS = 10; // same cost as authController's register

const seed = async () => {
  const db = await connect();
  const removed = await deleteAll(await findEvalScope());
  console.log(`[${db}] removed previous evaluation data:`, removed);

  // One hash for the shared dummy password; login still runs a full bcrypt.compare per request
  const password = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  const faculty = await User.create({ name: "Eval Faculty 001", email: FACULTY_EMAIL, password, role: "faculty" });
  const students = await User.insertMany(
    Array.from({ length: STUDENT_COUNT }, (_, i) => ({
      name: `Eval Student ${String(i + 1).padStart(3, "0")}`,
      email: studentEmail(i + 1),
      password,
      role: "student",
    }))
  );
  const studentIds = students.map(s => s._id);

  const manifest = {
    seededAt: new Date().toISOString(),
    database: db,
    password: PASSWORD,
    faculty: { id: String(faculty._id), email: FACULTY_EMAIL },
    students: students.map(s => ({ id: String(s._id), email: s.email })),
    courses: [],
  };

  for (const [i, spec] of COURSES.entries()) {
    const course = await Course.create({
      title: `EVAL ${i + 1}: ${spec.title}`,
      description: `${COURSE_TAG} Dummy course for evaluation tests`,
      faculty: faculty._id,
      students: studentIds,
    });

    const totalMarks = spec.questions.reduce((sum, q) => sum + q.marks, 0);
    const quiz = await Quiz.create({
      title: `EVAL ${i + 1}: ${spec.title} Quiz`,
      subject: spec.subject,
      description: `${COURSE_TAG} ${spec.topics.join(", ")}`,
      course: course._id,
      createdBy: faculty._id,
      assignedTo: studentIds,
      duration: QUIZ_DURATION_MINUTES,
      totalQuestions: spec.questions.length,
      totalMarks,
      passMarks: Math.ceil(totalMarks * 0.4),
      status: "active",
      isPublished: true,
    });

    const questions = await Question.insertMany(
      spec.questions.map((q, order) => ({ ...q, quiz: quiz._id, order }))
    );

    manifest.courses.push({
      courseId: String(course._id),
      title: course.title,
      quizId: String(quiz._id),
      quizTitle: quiz.title,
      totalMarks,
      topics: spec.topics,
      questions: questions.map(q => ({
        id: String(q._id),
        type: q.type,
        topic: q.topic,
        marks: q.marks,
        options: q.type === "mcq" ? q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) : undefined,
        correctAnswer: q.type === "truefalse" ? q.correctAnswer : undefined,
      })),
    });
  }

  const manifestPath = join(EVAL_DIR, "seed", "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`[${db}] seeded: 1 faculty, ${students.length} students, ${manifest.courses.length} courses,`,
    `${manifest.courses.length} quizzes x ${COURSES[0].questions.length} questions; every student enrolled in every course`);
  console.log(`manifest: ${manifestPath}`);
};

try {
  await seed();
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await disconnect();
}

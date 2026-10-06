#!/usr/bin/env node
/**
 * Quiz load test — simulates N students taking the same quiz at the same time.
 *
 * Needs Node 18+ (built-in fetch). No npm install required.
 *
 *   1. One-time setup: registers a test faculty + N test students, creates a course, enrolls them.
 *        node loadtest/quiz-load-test.mjs setup --url https://your-backend.onrender.com --users 100
 *
 *   2. Each run: the faculty creates and publishes a fresh quiz, then all students at once
 *      log in → open the quiz → start → answer every question (with "thinking" pauses) → submit.
 *        node loadtest/quiz-load-test.mjs run --url https://your-backend.onrender.com --users 100
 *
 * Options:
 *   --url       Backend base URL (without /api). Default http://localhost:5000
 *   --users     Number of simulated students. Default 100
 *   --think     Average seconds a student spends per question. Default 5 (real students: 20-60)
 *   --ramp      Seconds over which students arrive. Default 0 (everyone clicks Start together)
 *   --password  Password for all test accounts. Default LoadTest#2026
 *
 * WARNING: this creates real accounts, a course and quizzes in whatever database the backend uses.
 * Point it at a test deployment / test database, not the one your real students use.
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Config ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE_URL = opt("url", "http://localhost:5000").replace(/\/+$/, "");
const API = `${BASE_URL}/api`;
const USERS = Number(opt("users", 100));
const THINK_SECONDS = Number(opt("think", 5));
const RAMP_SECONDS = Number(opt("ramp", 0));
const PASSWORD = opt("password", "LoadTest#2026");
const REQUEST_TIMEOUT_MS = 60_000;
const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), "state.json");

const FACULTY_EMAIL = "loadtest.faculty@example.com";
const studentEmail = (i) => `loadtest.student${String(i).padStart(3, "0")}@example.com`;

// ── Metrics ─────────────────────────────────────────────────────────────────
const metrics = new Map(); // label -> { times: [], statuses: {} , failures: 0 }

const record = (label, ms, status, ok) => {
  if (!metrics.has(label)) metrics.set(label, { times: [], statuses: {}, failures: 0 });
  const m = metrics.get(label);
  m.times.push(ms);
  m.statuses[status] = (m.statuses[status] || 0) + 1;
  if (!ok) m.failures++;
};

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0;

const printReport = (wallSeconds) => {
  const rows = [];
  let total = 0;
  let totalFailures = 0;
  for (const [label, m] of metrics) {
    const sorted = [...m.times].sort((a, b) => a - b);
    total += sorted.length;
    totalFailures += m.failures;
    rows.push({
      endpoint: label,
      requests: sorted.length,
      failed: m.failures,
      "p50 ms": Math.round(percentile(sorted, 50)),
      "p95 ms": Math.round(percentile(sorted, 95)),
      "p99 ms": Math.round(percentile(sorted, 99)),
      "max ms": Math.round(sorted[sorted.length - 1] || 0),
      statuses: Object.entries(m.statuses).map(([s, n]) => `${s}×${n}`).join(" ")
    });
  }
  console.log("\n── Results per endpoint ──");
  console.table(rows);
  console.log(`Total requests: ${total}, failed: ${totalFailures} (${total ? ((totalFailures / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Wall time: ${wallSeconds.toFixed(1)}s, average throughput: ${(total / wallSeconds).toFixed(1)} req/s`);
};

// ── HTTP helper ─────────────────────────────────────────────────────────────
const call = async (label, method, path, { token, body, expect = [200, 201] } = {}) => {
  const started = performance.now();
  let status = "ERR";
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    status = res.status;
    const data = await res.json().catch(() => ({}));
    const ok = expect.includes(res.status);
    record(label, performance.now() - started, status, ok);
    return { ok, status, data };
  } catch (error) {
    status = error.name === "TimeoutError" ? "TIMEOUT" : "ERR";
    record(label, performance.now() - started, status, false);
    return { ok: false, status, data: { message: error.message } };
  }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const thinkPause = () => sleep(THINK_SECONDS * 1000 * (0.5 + Math.random()));

// Runs tasks with limited parallelism — used during setup so it doesn't itself become a load test
const pool = async (items, limit, fn) => {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
};

const login = async (email, role) => {
  const r = await call("POST /auth/login", "POST", "/auth/login", { body: { email, password: PASSWORD, role } });
  if (!r.ok) throw new Error(`Login failed for ${email}: ${r.status} ${r.data.message || r.data.error || ""}`);
  return r.data;
};

// ── Setup ───────────────────────────────────────────────────────────────────
const setup = async () => {
  console.log(`Setting up 1 faculty + ${USERS} students on ${BASE_URL} …`);

  const register = async (name, email, role) => {
    const r = await call("POST /auth/register", "POST", "/auth/register", {
      body: { name, email, password: PASSWORD, role },
      expect: [201, 400] // 400 = already registered from an earlier setup
    });
    if (r.status === 400 && !/already registered/i.test(r.data.message || "")) {
      throw new Error(`Register failed for ${email}: ${r.data.message}`);
    }
    if (!r.ok) throw new Error(`Register failed for ${email}: ${r.status} ${r.data.message || r.data.error || ""}`);
  };

  await register("Load Test Faculty", FACULTY_EMAIL, "faculty");
  const faculty = await login(FACULTY_EMAIL, "faculty");

  const course = await call("POST /courses", "POST", "/courses", {
    token: faculty.token,
    body: { title: `Load Test Course ${new Date().toISOString().slice(0, 16)}`, description: "Created by the load test script" }
  });
  if (!course.ok) throw new Error(`Course creation failed: ${course.data.message}`);
  const courseId = course.data.course._id;

  const indexes = Array.from({ length: USERS }, (_, i) => i + 1);
  const students = await pool(indexes, 5, async (i) => {
    const email = studentEmail(i);
    await register(`Load Test Student ${i}`, email, "student");
    const session = await login(email, "student");
    const enroll = await call("POST /courses/:id/enroll", "POST", `/courses/${courseId}/enroll`, {
      token: session.token,
      expect: [200, 400]
    });
    if (!enroll.ok) throw new Error(`Enroll failed for ${email}: ${enroll.data.message}`);
    if (i % 10 === 0) console.log(`  ${i}/${USERS} students ready`);
    return { email, userId: session.userId };
  });

  writeFileSync(STATE_FILE, JSON.stringify({ baseUrl: BASE_URL, courseId, students }, null, 2));
  console.log(`\nSetup complete. Saved ${students.length} students to ${STATE_FILE}`);
  console.log(`Now run:  node loadtest/quiz-load-test.mjs run --url ${BASE_URL} --users ${USERS}`);
};

// ── Quiz used for each run: a mix of every question type ───────────────────
const QUESTIONS = [
  { type: "mcq", questionText: "What does HTTP stand for?", marks: 1, options: [
    { text: "HyperText Transfer Protocol", isCorrect: true }, { text: "High Transfer Text Protocol", isCorrect: false },
    { text: "Hyperlink Text Transport", isCorrect: false }, { text: "Home Tool Transfer Protocol", isCorrect: false }] },
  { type: "mcq", questionText: "Which of these are JavaScript runtimes? (select all)", marks: 3, options: [
    { text: "Node.js", isCorrect: true }, { text: "Deno", isCorrect: true },
    { text: "Bun", isCorrect: true }, { text: "Django", isCorrect: false }] },
  { type: "truefalse", questionText: "MongoDB is a relational database.", marks: 1, correctAnswer: false },
  { type: "mcq", questionText: "Which HTTP methods are idempotent? (select all)", marks: 2, options: [
    { text: "GET", isCorrect: true }, { text: "PUT", isCorrect: true },
    { text: "POST", isCorrect: false }, { text: "PATCH", isCorrect: false }] },
  { type: "truefalse", questionText: "React components must start with a capital letter.", marks: 1, correctAnswer: true },
  { type: "mcq", questionText: "Which port does HTTPS use by default?", marks: 1, options: [
    { text: "80", isCorrect: false }, { text: "443", isCorrect: true }, { text: "8080", isCorrect: false }, { text: "21", isCorrect: false }] },
  { type: "shortanswer", questionText: "Explain the difference between authentication and authorization.", marks: 5,
    modelAnswer: "Authentication verifies who you are; authorization decides what you may do." },
  { type: "mcq", questionText: "Which are NoSQL databases? (select all)", marks: 2, options: [
    { text: "MongoDB", isCorrect: true }, { text: "PostgreSQL", isCorrect: false },
    { text: "Redis", isCorrect: true }, { text: "MySQL", isCorrect: false }] },
  { type: "truefalse", questionText: "JWTs are encrypted by default.", marks: 1, correctAnswer: false },
  { type: "shortanswer", questionText: "What is an index in a database and why use one?", marks: 3,
    modelAnswer: "A data structure that speeds up lookups at the cost of extra writes/storage." }
];

const createQuiz = async (facultyToken, studentIds) => {
  const created = await call("POST /quizzes/create", "POST", "/quizzes/create", {
    token: facultyToken,
    body: {
      title: `Load Test Quiz ${new Date().toLocaleString()}`,
      subject: "Load Testing",
      description: "Created by the load test script",
      duration: 60,
      passMarks: 8
    }
  });
  if (!created.ok) throw new Error(`Quiz creation failed: ${created.data.message || created.data.error}`);
  const quizId = created.data.quiz?._id || created.data._id;

  for (const q of QUESTIONS) {
    const r = await call("POST /quizzes/:id/questions", "POST", `/quizzes/${quizId}/questions`, { token: facultyToken, body: q });
    if (!r.ok) throw new Error(`Adding question failed: ${r.data.message || r.data.error}`);
  }

  const assigned = await call("POST /quizzes/:id/assign", "POST", `/quizzes/${quizId}/assign`, {
    token: facultyToken, body: { studentIds }
  });
  if (!assigned.ok) throw new Error(`Assigning quiz failed: ${assigned.data.message || assigned.data.error}`);

  const published = await call("POST /quizzes/:id/publish", "POST", `/quizzes/${quizId}/publish`, { token: facultyToken });
  if (!published.ok) throw new Error(`Publishing quiz failed: ${published.data.message || published.data.error}`);

  return quizId;
};

// A student's answer — mostly right, sometimes wrong, so grading paths all get exercised
const pickAnswer = (q) => {
  if (q.type === "truefalse") return Math.random() < 0.5;
  const texts = q.options.map(o => o.text);
  if (!q.multipleCorrect) return [texts[Math.floor(Math.random() * texts.length)]];
  return texts.filter(() => Math.random() < 0.6);
};

const SHORT_ANSWER_TEXT =
  "Authentication confirms the identity of a user, for example with a password or token. " +
  "Authorization happens afterwards and decides which resources that identity may access.";

// ── One simulated student ───────────────────────────────────────────────────
const simulateStudent = async (student, quizId, outcome) => {
  const session = await login(student.email, "student");
  const token = session.token;

  // Dashboard load, then opening the quiz page
  await call("GET /quizzes/assigned/my-quizzes", "GET", "/quizzes/assigned/my-quizzes", { token });
  await call("GET /quizzes/:id", "GET", `/quizzes/${quizId}`, { token });

  const start = await call("POST /quiz-responses/:id/start", "POST", `/quiz-responses/${quizId}/start`, { token });
  if (!start.ok) throw new Error(`Start failed: ${start.status} ${start.data.message || start.data.error || ""}`);
  const responseId = start.data.response._id;

  for (const q of start.data.questions) {
    await thinkPause();
    if (q.type === "shortanswer") {
      // The client saves after each typing pause — simulate the answer arriving in 3 chunks
      const chunks = [0.3, 0.7, 1].map(f => SHORT_ANSWER_TEXT.slice(0, Math.round(SHORT_ANSWER_TEXT.length * f)));
      for (const text of chunks) {
        await call("POST /quiz-responses/:id/save", "POST", `/quiz-responses/${responseId}/save`, {
          token, body: { questionId: q._id, studentAnswer: text }
        });
        await sleep(1000 + Math.random() * 2000);
      }
    } else {
      await call("POST /quiz-responses/:id/save", "POST", `/quiz-responses/${responseId}/save`, {
        token, body: { questionId: q._id, studentAnswer: pickAnswer(q) }
      });
    }
  }

  const submit = await call("POST /quiz-responses/:id/submit", "POST", `/quiz-responses/${responseId}/submit`, { token });
  if (!submit.ok) throw new Error(`Submit failed: ${submit.status} ${submit.data.message || submit.data.error || ""}`);

  await call("GET /quiz-responses/student/my-results", "GET", "/quiz-responses/student/my-results", { token });
  outcome.completed++;
};

// ── Run ─────────────────────────────────────────────────────────────────────
const run = async () => {
  if (!existsSync(STATE_FILE)) throw new Error("No state.json — run the setup command first.");
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  if (state.baseUrl !== BASE_URL) {
    console.warn(`⚠ state.json was created for ${state.baseUrl}, but --url is ${BASE_URL}`);
  }
  const students = state.students.slice(0, USERS);
  if (students.length < USERS) throw new Error(`Only ${students.length} students set up — rerun setup with --users ${USERS}`);

  // Wake the server first (Render free tier sleeps) so cold start isn't counted as load
  console.log(`Waking ${BASE_URL} …`);
  const wakeStart = performance.now();
  await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(120_000) }).catch(() => {});
  console.log(`  server responded after ${((performance.now() - wakeStart) / 1000).toFixed(1)}s`);

  console.log("Faculty creating a fresh quiz …");
  const faculty = await login(FACULTY_EMAIL, "faculty");
  const quizId = await createQuiz(faculty.token, students.map(s => s.userId));
  metrics.clear(); // only measure the students

  console.log(`Starting ${USERS} students (think ≈${THINK_SECONDS}s/question, ramp ${RAMP_SECONDS}s) …`);
  const outcome = { completed: 0, errors: [] };
  const wallStart = performance.now();

  const progress = setInterval(() => {
    const done = [...metrics.values()].reduce((n, m) => n + m.times.length, 0);
    console.log(`  ${((performance.now() - wallStart) / 1000).toFixed(0)}s: ${done} requests, ${outcome.completed}/${USERS} submitted, ${outcome.errors.length} students failed`);
  }, 10_000);

  await Promise.all(students.map(async (student, i) => {
    if (RAMP_SECONDS > 0) await sleep((RAMP_SECONDS * 1000 * i) / USERS);
    try {
      await simulateStudent(student, quizId, outcome);
    } catch (error) {
      outcome.errors.push(`${student.email}: ${error.message}`);
    }
  }));

  clearInterval(progress);
  printReport((performance.now() - wallStart) / 1000);

  console.log(`\nStudents who completed the whole quiz: ${outcome.completed}/${USERS}`);
  if (outcome.errors.length) {
    console.log(`Students who failed (${outcome.errors.length}):`);
    outcome.errors.slice(0, 15).forEach(e => console.log(`  - ${e}`));
    if (outcome.errors.length > 15) console.log(`  … and ${outcome.errors.length - 15} more`);
  }
  console.log(`\nQuiz id: ${quizId} (log in as ${FACULTY_EMAIL} to see the submissions)`);
};

// ── Entry ───────────────────────────────────────────────────────────────────
const commands = { setup, run };
if (!commands[command]) {
  console.log("Usage: node loadtest/quiz-load-test.mjs <setup|run> --url <backend-url> [--users 100] [--think 5] [--ramp 0]");
  process.exit(1);
}
commands[command]().catch(error => {
  console.error(`\n✖ ${error.message}`);
  if (metrics.size) printReport(1);
  process.exit(1);
});

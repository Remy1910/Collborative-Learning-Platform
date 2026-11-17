// k6 scenario: N students start together, each logs in, starts the quiz of course (student % C),
// autosaves one answer every AUTOSAVE_SECONDS for all 10 questions, then submits.
// Env: BASE_URL, N (students), C (courses), AUTOSAVE_SECONDS, SUMMARY_PATH
import http from "k6/http";
import { sleep } from "k6";
import exec from "k6/execution";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5055";
const N = Number(__ENV.N || 25);
const C = Number(__ENV.C || 1);
const AUTOSAVE_SECONDS = Number(__ENV.AUTOSAVE_SECONDS || 3);
const manifest = JSON.parse(open("../seed/manifest.json"));

if (N > manifest.students.length) throw new Error(`N=${N} but only ${manifest.students.length} seeded students`);
if (C > manifest.courses.length) throw new Error(`C=${C} but only ${manifest.courses.length} seeded courses`);

const OPS = ["login", "start", "autosave", "submit"];
const latency = Object.fromEntries(OPS.map(op => [op, new Trend(`op_${op}_ms`, true)]));
const errors = Object.fromEntries(OPS.map(op => [op, new Rate(`op_${op}_errors`)]));
const EXPECTED_STATUS = { login: 200, start: 201, autosave: 200, submit: 200 };

export const options = {
  scenarios: {
    quiz: { executor: "per-vu-iterations", vus: N, iterations: 1, maxDuration: "10m" },
  },
  summaryTrendStats: ["min", "med", "avg", "p(90)", "p(95)", "max", "count"],
  // Summary must keep the per-op error rates even though nothing is enforced
  thresholds: Object.fromEntries(OPS.map(op => [`op_${op}_errors`, ["rate>=0"]])),
};

const JSON_HEADERS = { "Content-Type": "application/json" };

const record = (op, res) => {
  const ok = res.status === EXPECTED_STATUS[op];
  latency[op].add(res.timings.duration);
  errors[op].add(!ok);
  if (!ok) console.error(`[${op}] status=${res.status} body=${String(res.body).slice(0, 160)}`);
  return ok;
};

// Mix of right and wrong answers so grading does real work
const answerFor = (q) => {
  const right = Math.random() < 0.6;
  if (q.type === "mcq") {
    const pool = q.options.filter(o => o.isCorrect === right);
    const from = pool.length ? pool : q.options;
    return [from[Math.floor(Math.random() * from.length)].text];
  }
  if (q.type === "truefalse") return right ? q.correctAnswer : !q.correctAnswer;
  return "Load-test short answer: this explains the concept in a sentence or two.";
};

export default function () {
  const idx = exec.vu.idInTest - 1; // 0-based student index
  const student = manifest.students[idx];
  const course = manifest.courses[idx % C];

  const login = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: student.email, password: manifest.password }),
    { headers: JSON_HEADERS, tags: { op: "login" } });
  if (!record("login", login)) return;
  const auth = { headers: { ...JSON_HEADERS, Authorization: `Bearer ${login.json("token")}` } };

  const start = http.post(`${BASE_URL}/api/quiz-responses/${course.quizId}/start`, null,
    { ...auth, tags: { op: "start" } });
  if (!record("start", start)) return;
  const responseId = start.json("response._id");

  for (const q of course.questions) {
    sleep(AUTOSAVE_SECONDS * (0.7 + Math.random() * 0.6)); // ±30% jitter so saves don't align
    const save = http.post(`${BASE_URL}/api/quiz-responses/${responseId}/save`,
      JSON.stringify({ questionId: q.id, studentAnswer: answerFor(q) }),
      { ...auth, tags: { op: "autosave" } });
    record("autosave", save);
  }

  const submit = http.post(`${BASE_URL}/api/quiz-responses/${responseId}/submit`, null,
    { ...auth, tags: { op: "submit" } });
  record("submit", submit);
}

export function handleSummary(data) {
  const line = OPS.map(op => {
    const t = data.metrics[`op_${op}_ms`]?.values;
    const e = data.metrics[`op_${op}_errors`]?.values;
    return t ? `${op}: p50=${t.med.toFixed(0)} p95=${t["p(95)"].toFixed(0)} max=${t.max.toFixed(0)} err=${((e?.rate || 0) * 100).toFixed(1)}%` : `${op}: no samples`;
  }).join(" | ");
  return {
    [__ENV.SUMMARY_PATH || "summary.json"]: JSON.stringify(data, null, 2),
    stdout: `\nN=${N} C=${C}  ${line}\n`,
  };
}

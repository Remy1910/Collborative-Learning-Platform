#!/usr/bin/env node
// AI feedback sample + latency: builds 40 synthetic completed attempts, calls the real
// POST /api/quiz-responses/:id/ai-feedback endpoint for each (as that student), and writes
//   results/ai/feedback-raw.jsonl        one line per call (kept across runs, so it can resume)
//   results/ai/feedback-for-rating.csv   blank rating columns + automatic checks
//   results/ai/latency.csv, summary.md, environment.json
// Free-tier quotas are small: when Gemini reports the quota is used up, the run stops;
// rerun later and it continues with the attempts that have no feedback yet.
//   node ai/run-ai.mjs [--model gemini-3.5-flash-lite] [--max-calls 50] [--delay 6] [--port 5056] [--report-only]
// --model overrides GEMINI_MODEL for this run's backend only (server/.env is left unchanged)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connect, disconnect, models, EVAL_DIR } from "../lib/db.mjs";
import { collectEnvironment } from "../lib/environment.mjs";
import { startServer, stopServer } from "../lib/server.mjs";
import { buildPlan } from "./plan.mjs";
import { checkFeedback } from "./checks.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const MAX_CALLS = Number(opt("max-calls", process.env.AI_FEEDBACK_MAX_CALLS || 50));
const DELAY_S = Number(opt("delay", 6)); // between calls, to stay under the free tier's per-minute limit
const PORT = Number(opt("port", 5056));
const REPORT_ONLY = args.includes("--report-only");
const MODEL = opt("model", null);

const OUT = join(EVAL_DIR, "results", "ai");
const RAW = join(OUT, "feedback-raw.jsonl");
mkdirSync(OUT, { recursive: true });

const manifest = JSON.parse(readFileSync(join(EVAL_DIR, "seed", "manifest.json"), "utf8"));
const plan = buildPlan(manifest);
const allSeededTopics = [...new Set(manifest.courses.flatMap(c => c.topics))];
const { QuizResponse } = models;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const readRaw = () => (existsSync(RAW)
  ? readFileSync(RAW, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l))
  : []);

// Per-topic result of a planned attempt, as the student's marks actually came out
const topicSummary = (item) => {
  const course = manifest.courses[item.courseIndex];
  return course.topics.map(topic => {
    const idx = course.questions.map((q, j) => (q.topic === topic ? j : -1)).filter(j => j >= 0);
    const earned = idx.reduce((s, j) => s + item.marks[j], 0);
    const possible = idx.reduce((s, j) => s + course.questions[j].marks, 0);
    return { topic, earned, possible, fullyCorrect: earned >= possible };
  });
};

// Replace the student's attempt at this quiz with a finished, fully graded one
const createAttempt = async (item) => {
  const course = manifest.courses[item.courseIndex];
  const student = manifest.students[item.studentIndex];
  await QuizResponse.deleteMany({ student: student.id, quiz: course.quizId });
  const total = item.marks.reduce((a, b) => a + b, 0);
  const now = Date.now();
  const doc = await QuizResponse.create({
    quiz: course.quizId,
    student: student.id,
    course: course.courseId,
    responses: course.questions.map((q, j) => ({
      question: q.id,
      studentAnswer: "(synthetic attempt)",
      isCorrect: item.marks[j] >= q.marks,
      isGraded: q.type === "shortanswer",
      marksObtained: item.marks[j],
    })),
    totalMarksObtained: total,
    status: "graded",
    startedAt: new Date(now - 20 * 60 * 1000),
    submittedAt: new Date(now - 5 * 60 * 1000),
    timeSpent: 15 * 60,
    isPassed: total >= Math.ceil(course.totalMarks * 0.4),
    attemptNumber: 1,
    isActive: true,
  });
  return { responseId: String(doc._id), student, course, total };
};

const callFeedback = async (baseUrl, item) => {
  const { responseId, student, course, total } = await createAttempt(item);
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: student.email, password: manifest.password }),
  });
  if (!loginRes.ok) throw new Error(`login ${student.email} -> ${loginRes.status}`);
  const { token } = await loginRes.json();

  const t0 = performance.now();
  const res = await fetch(`${baseUrl}/api/quiz-responses/${responseId}/ai-feedback`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  const roundTripMs = performance.now() - t0;
  const body = await res.json().catch(() => ({}));
  const topics = topicSummary(item);
  return {
    attemptId: item.attemptId,
    pattern: item.pattern,
    quiz: course.quizTitle,
    quizTopics: course.topics,
    score: total,
    totalMarks: course.totalMarks,
    topics: topics,
    httpStatus: res.status,
    ok: res.ok && Boolean(body.feedback?.text),
    cached: body.cached ?? null,
    message: body.message || body.error || null,
    text: body.feedback?.text || null,
    model: body.feedback?.model || null,
    llmLatencyMs: body.feedback?.latencyMs ?? null,
    llmAttempts: body.feedback?.attempts ?? null,
    roundTripMs: Number(roundTripMs.toFixed(1)),
    inputTokens: body.feedback?.inputTokens ?? null,
    outputTokens: body.feedback?.outputTokens ?? null,
    modelRequested: process.env.EVAL_MODEL_REQUESTED || null,
    calledAt: new Date().toISOString(),
  };
};

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null);
const stats = (xs) => {
  const s = xs.filter(x => typeof x === "number").sort((a, b) => a - b);
  if (!s.length) return { n: 0, mean: null, p50: null, p95: null, min: null, max: null };
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / s.length, p50: pct(s, 50), p95: pct(s, 95), min: s[0], max: s[s.length - 1] };
};
const csvCell = (v) => (v === null || v === undefined ? "" : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const writeCsv = (path, cols, rows) =>
  writeFileSync(path, "﻿" + [cols.join(","), ...rows.map(r => cols.map(c => csvCell(r[c])).join(","))].join("\r\n") + "\r\n");

const writeReport = (env) => {
  const all = readRaw();
  // Latest successful result per attempt
  const done = new Map();
  for (const r of all) if (r.ok) done.set(r.attemptId, r);
  const rows = plan.map(p => done.get(p.attemptId)).filter(Boolean);
  // Hitting this script's own call cap is not a model failure
  const capHit = (r) => r.httpStatus === 429 && /limit reached/i.test(r.message || "");
  const failed = all.filter(r => !r.ok && !capHit(r));

  const ratingRows = rows.map(r => {
    const wrong = r.topics.filter(t => !t.fullyCorrect).map(t => `${t.topic} (${t.earned}/${t.possible})`);
    const correct = r.topics.filter(t => t.fullyCorrect).map(t => t.topic);
    const checks = checkFeedback({
      text: r.text, quizTopics: r.quizTopics, correctTopics: correct, allSeededTopics,
    });
    return {
      attempt_id: r.attemptId,
      score: `${r.score}/${r.totalMarks}`,
      topics_wrong: wrong.join("; "),
      topics_correct: correct.join("; "),
      ai_feedback_text: r.text,
      "accuracy(1-5)": "", "relevance(1-5)": "", "actionability(1-5)": "", rater: "",
      auto_mentions_correct_topic_as_weak: checks.mentions_correct_topic_as_weak,
      auto_correct_topic_as_weak_detail: checks.correct_topic_as_weak_detail,
      auto_mentions_topic_not_in_quiz: checks.mentions_topic_not_in_quiz,
      auto_off_quiz_topics_found: checks.off_quiz_topics_found,
      score_pattern: r.pattern,
      quiz: r.quiz,
      model: r.model,
    };
  });
  writeCsv(join(OUT, "feedback-for-rating.csv"), Object.keys(ratingRows[0] || { attempt_id: "" }), ratingRows);

  const latencyRows = rows.map(r => ({
    attempt_id: r.attemptId, model: r.model, llm_latency_ms: r.llmLatencyMs, llm_requests: r.llmAttempts, endpoint_round_trip_ms: r.roundTripMs,
    input_tokens: r.inputTokens, output_tokens: r.outputTokens, cost_usd: 0, called_at: r.calledAt,
  }));
  writeCsv(join(OUT, "latency.csv"), Object.keys(latencyRows[0] || { attempt_id: "" }), latencyRows);

  const llm = stats(rows.map(r => r.llmLatencyMs));
  const rt = stats(rows.map(r => r.roundTripMs));
  const inTok = stats(rows.map(r => r.inputTokens));
  const outTok = stats(rows.map(r => r.outputTokens));
  const retried = rows.filter(r => (r.llmAttempts || 1) > 1).length;
  const flagWeak = ratingRows.filter(r => r.auto_mentions_correct_topic_as_weak).length;
  const flagOff = ratingRows.filter(r => r.auto_mentions_topic_not_in_quiz).length;
  const withCorrect = ratingRows.filter(r => r.topics_correct).length;
  const f = (v, d = 0) => (v === null ? "—" : Number(v).toFixed(d));
  const models = [...new Set(rows.map(r => r.model))].join(", ");

  const md = [
    "# AI feedback sample and latency", "",
    `- Attempts with feedback: ${rows.length}/${plan.length}; failed calls logged: ${failed.length}`,
    `- Model (as reported by the API): ${models || "—"}; Google Gemini API free tier`,
    `- Calls made: ${rows[0]?.calledAt?.slice(0, 10) ?? "—"} to ${rows[rows.length - 1]?.calledAt?.slice(0, 10) ?? "—"}`,
    env ? `- Machine: ${env.cpu}, ${env.ramGB} GB RAM, ${env.os}; Node ${env.node}` : "",
    "",
    "| Measure | n | Mean | p50 | p95 | Min | Max |", "|---|---|---|---|---|---|---|",
    `| LLM call latency (ms, measured in the backend) | ${llm.n} | ${f(llm.mean)} | ${f(llm.p50)} | ${f(llm.p95)} | ${f(llm.min)} | ${f(llm.max)} |`,
    `| Endpoint round trip (ms, client → backend → LLM → client) | ${rt.n} | ${f(rt.mean)} | ${f(rt.p50)} | ${f(rt.p95)} | ${f(rt.min)} | ${f(rt.max)} |`,
    `| Input tokens per call | ${inTok.n} | ${f(inTok.mean)} | ${f(inTok.p50)} | ${f(inTok.p95)} | ${f(inTok.min)} | ${f(inTok.max)} |`,
    `| Output tokens per call (incl. thinking) | ${outTok.n} | ${f(outTok.mean)} | ${f(outTok.p50)} | ${f(outTok.p95)} | ${f(outTok.min)} | ${f(outTok.max)} |`,
    "",
    "Cost per call: $0 (free tier). Token counts are reported by the API.",
    `LLM latency includes automatic retries after Gemini overload errors (503/504/500; up to 2 retries, 5 s and 15 s apart). Calls that needed at least one retry: ${retried}/${rows.length}.`, "",
    "## Automatic checks (keyword heuristics; raters should confirm)", "",
    `- Feedback names a fully-correct topic in a clause about weakness: ${flagWeak}/${ratingRows.length} (${ratingRows.length ? ((100 * flagWeak) / ratingRows.length).toFixed(1) : "—"}%); ${withCorrect} attempts had at least one fully-correct topic`,
    `- Feedback mentions a topic that is not in the quiz: ${flagOff}/${ratingRows.length} (${ratingRows.length ? ((100 * flagOff) / ratingRows.length).toFixed(1) : "—"}%)`,
    "",
    ...(failed.length ? ["## Failed calls", "", ...failed.map(r => `- ${r.attemptId} at ${r.calledAt} (${r.modelRequested || "gemini-3.8-flash"}): HTTP ${r.httpStatus} ${r.message || ""}`), ""] : []),
  ];
  writeFileSync(join(OUT, "summary.md"), md.filter(l => l !== null).join("\n"));
  return { done: rows.length, failed: failed.length };
};

let server;
try {
  const db = await connect();
  const env = await collectEnvironment();
  writeFileSync(join(OUT, "environment.json"), JSON.stringify(env, null, 2));

  if (!REPORT_ONLY) {
    const doneIds = new Set(readRaw().filter(r => r.ok).map(r => r.attemptId));
    const todo = plan.filter(p => !doneIds.has(p.attemptId));
    console.log(`[${db}] ${doneIds.size}/${plan.length} attempts already have feedback; ${todo.length} to go (cap ${MAX_CALLS} calls)`);

    if (todo.length) {
      server = await startServer({ port: PORT, logPath: join(OUT, `server-${Date.now()}.log`), env: { AI_FEEDBACK_MAX_CALLS: String(MAX_CALLS), ...(MODEL ? { GEMINI_MODEL: MODEL } : {}) } });
      if (MODEL) console.log(`model for this run: ${MODEL}`);
      process.env.EVAL_MODEL_REQUESTED = MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash";
      let calls = 0;
      let consecutiveFailures = 0;
      for (const item of todo) {
        if (calls >= MAX_CALLS) { console.log(`LLM call cap (${MAX_CALLS}) reached`); break; }
        calls++;
        const row = await callFeedback(server.baseUrl, item);
        appendFileSync(RAW, JSON.stringify(row) + "\n");
        console.log(`${row.attemptId} ${row.pattern}: HTTP ${row.httpStatus}` +
          (row.ok ? ` llm=${row.llmLatencyMs}ms tokens=${row.inputTokens}/${row.outputTokens}` : ` ${row.message}`));
        // Free-tier quota exhausted (or server cap hit): stop instead of burning through more attempts
        consecutiveFailures = row.ok ? 0 : consecutiveFailures + 1;
        if (consecutiveFailures >= 3) {
          console.log("Stopping: 3 failures in a row (Gemini likely overloaded). Rerun later to continue.");
          break;
        }
        if (row.httpStatus === 503 || row.httpStatus === 429) {
          console.log("Stopping: quota/cap reached. Rerun later to continue.");
          break;
        }
        await sleep(DELAY_S * 1000);
      }
    }
  }

  const { done, failed } = writeReport(env);
  console.log(`\n${done}/${plan.length} attempts have feedback (${failed} failed calls logged). Wrote ${join(OUT, "summary.md")}`);
} catch (err) {
  console.error("AI evaluation failed:", err.message);
  process.exitCode = 1;
} finally {
  if (server) await stopServer(server);
  await disconnect();
}

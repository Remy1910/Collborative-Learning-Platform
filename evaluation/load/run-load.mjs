#!/usr/bin/env node
// Runs the load test levels and the single-session test, each against a freshly started backend,
// and writes CSV + markdown results with the machine spec into results/load/<timestamp>/.
//   node load/run-load.mjs                       all levels (N=25,50,100 x C=1,5) + session test
//   node load/run-load.mjs --levels 25 --courses 1 --skip-session
//   node load/run-load.mjs --only-session
// Options: --autosave <s> (default 3)  --port <p> (default 5055)  --accounts <n> (default 20)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { connect, disconnect, EVAL_DIR } from "../lib/db.mjs";
import { collectEnvironment, k6Version } from "../lib/environment.mjs";
import { startServer, stopServer } from "../lib/server.mjs";
import { findEvalScope, deleteAttempts } from "../seed/cleanup.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const LEVELS = opt("levels", "25,50,100").split(",").map(Number);
const COURSES = opt("courses", "1,5").split(",").map(Number);
const AUTOSAVE = opt("autosave", "3");
const PORT = Number(opt("port", 5055));
const ACCOUNTS = opt("accounts", "20");
const SKIP_SESSION = args.includes("--skip-session");
const ONLY_SESSION = args.includes("--only-session");

const K6 = process.env.K6_BIN
  || (existsSync("C:\\Program Files\\k6\\k6.exe") ? "C:\\Program Files\\k6\\k6.exe" : "k6");
const OPS = ["login", "start", "autosave", "submit"];
const OP_LABEL = { login: "Login", start: "Quiz start", autosave: "Autosave", submit: "Quiz submit" };

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT = join(EVAL_DIR, "results", "load", stamp);
const RAW = join(OUT, "raw");
mkdirSync(RAW, { recursive: true });

const runK6 = (script, env, logPath) => new Promise((resolve, reject) => {
  const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  const log = createWriteStream(logPath);
  const child = spawn(K6, ["run", "--quiet", "--no-color", "--log-format", "raw", ...envArgs, script],
    { cwd: join(EVAL_DIR, "load") });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", d => { stdout += d; log.write(d); });
  child.stderr.on("data", d => { stderr += d; log.write(d); });
  child.on("error", reject);
  child.on("exit", code => { log.end(); resolve({ code, stdout, stderr }); });
});

const resetAttempts = async () => deleteAttempts(await findEvalScope());
const csvCell = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const writeCsv = (path, rows) => {
  const cols = Object.keys(rows[0]);
  writeFileSync(path, [cols.join(","), ...rows.map(r => cols.map(c => csvCell(r[c])).join(","))].join("\n") + "\n");
};
const fmt = (v, digits = 0) => (v === null || v === undefined ? "—" : Number(v).toFixed(digits));
const pct = (rate) => (rate === null || rate === undefined ? "—" : `${(rate * 100).toFixed(2)}%`);

const loadRows = [];
const failures = [];

const runLevel = async (N, C) => {
  const label = `N${N}-C${C}`;
  await resetAttempts();
  const server = await startServer({ port: PORT, logPath: join(RAW, `${label}.server.log`) });
  const summaryPath = join(RAW, `${label}.summary.json`);
  const started = new Date();
  let result;
  try {
    result = await runK6("quiz-load.k6.js",
      { BASE_URL: server.baseUrl, N, C, AUTOSAVE_SECONDS: AUTOSAVE, SUMMARY_PATH: summaryPath },
      join(RAW, `${label}.k6.log`));
  } finally {
    await stopServer(server);
  }
  process.stdout.write(result.stdout.trim().split("\n").pop() + "\n");
  if (!existsSync(summaryPath)) {
    failures.push(`${label}: k6 exited with code ${result.code} and wrote no summary`);
    return;
  }

  const metrics = JSON.parse(readFileSync(summaryPath, "utf8")).metrics;
  for (const op of OPS) {
    const t = metrics[`op_${op}_ms`]?.values;
    const e = metrics[`op_${op}_errors`]?.values;
    loadRows.push({
      level: label, students_N: N, courses_C: C, operation: OP_LABEL[op],
      samples: t?.count ?? 0,
      p50_ms: t ? Number(t.med.toFixed(1)) : null,
      p95_ms: t ? Number(t["p(95)"].toFixed(1)) : null,
      max_ms: t ? Number(t.max.toFixed(1)) : null,
      mean_ms: t ? Number(t.avg.toFixed(1)) : null,
      errors: e?.passes ?? 0,
      error_rate: e ? Number(e.rate.toFixed(4)) : null,
      started_at: started.toISOString(),
    });
  }
  // AI feedback is a separate student action, not part of submit, so this scenario never triggers it
  loadRows.push({
    level: label, students_N: N, courses_C: C, operation: "AI feedback generation",
    samples: 0, p50_ms: null, p95_ms: null, max_ms: null, mean_ms: null, errors: null, error_rate: null,
    started_at: started.toISOString(),
  });
};

const runSession = async () => {
  await resetAttempts();
  const server = await startServer({ port: PORT, logPath: join(RAW, "session.server.log") });
  const summaryPath = join(RAW, "session.summary.json");
  let result;
  try {
    result = await runK6("single-session.k6.js",
      { BASE_URL: server.baseUrl, ACCOUNTS, SUMMARY_PATH: summaryPath },
      join(RAW, "session.k6.log"));
  } finally {
    await stopServer(server);
  }

  const perAccount = (result.stdout + "\n" + result.stderr).split(/\r?\n/)
    .filter(l => l.includes("SESSION_RESULT "))
    .map(l => JSON.parse(l.slice(l.indexOf("SESSION_RESULT ") + 15)));
  if (perAccount.length === 0) {
    failures.push(`session test: no per-account results (k6 exit code ${result.code})`);
    return null;
  }

  writeCsv(join(OUT, "single-session-accounts.csv"), perAccount.map(r => ({
    email: r.email,
    seq_a_valid_before_b_login: r.seq_a_valid_before,
    seq_requests_until_a_rejected: r.seq_requests_until_rejected,
    seq_b_valid: r.seq_b_valid,
    seq_a_still_rejected_after_35s: r.seq_a_still_rejected,
    sim_login_statuses: (r.sim_logins || []).join("/"),
    sim_valid_a_b: (r.sim_valid || []).join("/"),
    sim_survivor_is_later_response: r.sim_survivor_is_later_response,
  })));

  const n = perAccount.length;
  const count = (f) => perAccount.filter(f).length;
  const untils = perAccount.map(r => r.seq_requests_until_rejected).filter(v => v !== null && v !== undefined);
  return {
    accounts: n,
    seqFirstRejected: count(r => r.seq_requests_until_rejected !== null && r.seq_requests_until_rejected !== undefined),
    seqRequestsMin: untils.length ? Math.min(...untils) : null,
    seqRequestsMax: untils.length ? Math.max(...untils) : null,
    seqSecondValid: count(r => r.seq_b_valid === true),
    seqStillRejected: count(r => r.seq_a_still_rejected === true),
    simExactlyOne: count(r => r.sim_valid && r.sim_valid[0] !== r.sim_valid[1]),
    simBoth: count(r => r.sim_valid && r.sim_valid[0] && r.sim_valid[1]),
    simNone: count(r => r.sim_valid && !r.sim_valid[0] && !r.sim_valid[1]),
    simLoginFailures: count(r => !r.sim_logins || r.sim_logins.some(s => s !== 200)),
    simSurvivorLater: count(r => r.sim_survivor_is_later_response === true),
  };
};

try {
  const db = await connect();
  const env = await collectEnvironment({ k6: k6Version(K6), loadGenerator: "k6 on the same machine as the backend" });
  writeFileSync(join(OUT, "environment.json"), JSON.stringify(env, null, 2));
  console.log(`[${db}] results -> ${OUT}`);
  console.log(`machine: ${env.cpu}, ${env.ramGB} GB RAM, ${env.os}; node ${env.node}, MongoDB ${env.mongodb}, k6 ${env.k6}`);

  if (!ONLY_SESSION) {
    for (const C of COURSES) for (const N of LEVELS) await runLevel(N, C);
  }
  const session = SKIP_SESSION ? null : await runSession();
  await resetAttempts();

  // ── Write results ──
  const md = [
    `# Load test results (${stamp})`,
    "",
    `- Machine: ${env.cpu} (${env.cpuLogicalCores} logical cores), ${env.ramGB} GB RAM, ${env.os}`,
    `- Node ${env.node}, MongoDB ${env.mongodb} (${env.mongoIsAtlas ? "MongoDB Atlas" : "self-hosted"}, ${env.mongoHost}), ${env.k6}`,
    `- DB round trip from this machine: median ${env.mongoPingMedianMs} ms, max ${env.mongoPingMaxMs} ms (10 pings)`,
    `- Backend: one Node process, restarted before every level; k6 ran on the same machine`,
    `- Scenario: each student logs in, starts the quiz, autosaves 10 answers ~${AUTOSAVE} s apart (±30%), then submits`,
    "",
  ];
  if (loadRows.length) {
    writeCsv(join(OUT, "load-results.csv"), loadRows);
    md.push("## Response times", "",
      "| Level | Operation | p50 (ms) | p95 (ms) | Max (ms) | Error rate | Samples |",
      "|---|---|---|---|---|---|---|");
    for (const r of loadRows) {
      const na = r.operation === "AI feedback generation";
      md.push(`| N=${r.students_N}, C=${r.courses_C} | ${r.operation} | ${na ? "N/A" : fmt(r.p50_ms)} | ${na ? "N/A" : fmt(r.p95_ms)} | ${na ? "N/A" : fmt(r.max_ms)} | ${na ? "N/A" : pct(r.error_rate)} | ${na ? "not triggered on submit" : r.samples} |`);
    }
    md.push("");
  }
  if (session) {
    writeFileSync(join(OUT, "single-session-summary.json"), JSON.stringify(session, null, 2));
    const s = session;
    md.push("## Single-session rule", "",
      `${s.accounts} accounts, all running at the same time.`, "",
      "| Check | Result |", "|---|---|",
      `| Sequential: first session rejected after the second login | ${s.seqFirstRejected}/${s.accounts} |`,
      `| Sequential: requests by the first session until rejected | min ${s.seqRequestsMin ?? "—"}, max ${s.seqRequestsMax ?? "—"} |`,
      `| Sequential: second session works | ${s.seqSecondValid}/${s.accounts} |`,
      `| Sequential: first session still rejected 35 s later (after the 30 s session cache) | ${s.seqStillRejected}/${s.accounts} |`,
      `| Simultaneous: exactly one session valid | ${s.simExactlyOne}/${s.accounts} |`,
      `| Simultaneous: both sessions valid | ${s.simBoth}/${s.accounts} |`,
      `| Simultaneous: neither session valid | ${s.simNone}/${s.accounts} |`,
      `| Simultaneous: a login request failed | ${s.simLoginFailures}/${s.accounts} |`,
      `| Simultaneous: surviving session was the later login response | ${s.simSurvivorLater}/${s.simExactlyOne} |`,
      "");
  }
  if (failures.length) md.push("## Failures", "", ...failures.map(f => `- ${f}`), "");
  writeFileSync(join(OUT, "load-results.md"), md.join("\n"));
  console.log(`\nwrote ${join(OUT, "load-results.md")}`);
  if (failures.length) { console.error("Failures:\n" + failures.join("\n")); process.exitCode = 1; }
} catch (err) {
  console.error("Load test failed:", err.message);
  process.exitCode = 1;
} finally {
  await disconnect();
}

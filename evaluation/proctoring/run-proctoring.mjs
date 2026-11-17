#!/usr/bin/env node
// Proctoring false-positive test: drives the real React client in visible browser windows,
// performs one scripted behaviour per fresh quiz attempt, and counts the violations the
// *backend* recorded for that attempt (the authoritative log), plus whether it was terminated.
//   node proctoring/run-proctoring.mjs                         all scenarios, 10 runs, chromium + msedge
//   node proctoring/run-proctoring.mjs --runs 2 --browsers chromium --scenarios f_control_click,g_tab_switch
//   --headless   run without visible windows (focus/visibility events are emulated, less realistic)
// Don't use the computer while it runs: anything that takes OS focus can cause real blur events.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { connect, disconnect, models, EVAL_DIR } from "../lib/db.mjs";
import { collectEnvironment } from "../lib/environment.mjs";
import { startServer, stopServer } from "../lib/server.mjs";
import { SCENARIOS, NOT_SIMULATED } from "./scenarios.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const RUNS = Number(opt("runs", 10));
const BROWSERS = opt("browsers", "chromium,msedge").split(",");
const ONLY = opt("scenarios", null)?.split(",");
const HEADLESS = args.includes("--headless");
const API_PORT = Number(opt("port", 5055));
const CLIENT_PORT = Number(opt("client-port", 5174));
const MAX_VIOLATIONS = 3; // server's termination threshold (quizResponseController)
const SETTLE_MS = 1500;   // after the quiz renders, before the behaviour
const AFTER_MS = 2500;    // after the behaviour, for violation requests to land

// chromium/firefox/webkit are Playwright's builds; msedge/chrome are the installed, signed browsers
const LAUNCHERS = {
  chromium: () => chromium.launch({ headless: HEADLESS }),
  msedge: () => chromium.launch({ headless: HEADLESS, channel: "msedge" }),
  chrome: () => chromium.launch({ headless: HEADLESS, channel: "chrome" }),
  firefox: () => firefox.launch({ headless: HEADLESS }),
  webkit: () => webkit.launch({ headless: HEADLESS }),
};

const scenarios = ONLY ? SCENARIOS.filter(s => ONLY.includes(s.id)) : SCENARIOS;
const manifest = JSON.parse(readFileSync(join(EVAL_DIR, "seed", "manifest.json"), "utf8"));
const { QuizResponse } = models;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT = join(EVAL_DIR, "results", "proctoring", stamp);
mkdirSync(join(OUT, "raw"), { recursive: true });

const startClient = async (apiUrl) => {
  const clientDir = join(EVAL_DIR, "..", "client");
  const log = createWriteStream(join(OUT, "raw", "vite.log"));
  const child = spawn(process.execPath,
    [join(clientDir, "node_modules", "vite", "bin", "vite.js"), "--port", String(CLIENT_PORT), "--strictPort"],
    { cwd: clientDir, env: { ...process.env, VITE_API_URL: apiUrl }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const url = `http://localhost:${CLIENT_PORT}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Vite exited early; see raw/vite.log (is port in use?)");
    try { if ((await fetch(url)).ok) return { child, url }; } catch { /* starting */ }
    await sleep(300);
  }
  child.kill();
  throw new Error("Vite did not start within 60 s");
};

const login = async (apiUrl, email) => {
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: manifest.password }),
  });
  if (!res.ok) throw new Error(`login ${email} -> ${res.status}`);
  return res.json();
};

const runOnce = async ({ browser, browserName, scenario, runNo, globalIndex, apiUrl, clientUrl }) => {
  // Spread runs over students and quizzes so no account hits the login rate limit
  const student = manifest.students[globalIndex % manifest.students.length];
  const course = manifest.courses[Math.floor(globalIndex / manifest.students.length) % manifest.courses.length];
  await QuizResponse.deleteMany({ student: student.id, quiz: course.quizId });

  const auth = await login(apiUrl, student.email);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(({ origin, session }) => {
    if (location.origin !== origin) return;
    // Only write when different, so other same-origin tabs don't get a "storage" event and reload
    for (const [k, v] of Object.entries(session)) if (localStorage.getItem(k) !== v) localStorage.setItem(k, v);
  }, { origin: clientUrl, session: { token: auth.token, role: auth.role, userId: auth.userId, userName: auth.name } });

  const page = await context.newPage();
  const violationRequests = [];
  page.on("request", req => {
    if (req.method() === "POST" && req.url().includes("/violation")) {
      try { violationRequests.push(JSON.parse(req.postData() || "{}").reason); } catch { violationRequests.push("?"); }
    }
  });

  const row = {
    browser: browserName, scenario: scenario.id, run: runNo, student: student.email, quiz: course.quizTitle,
    expected_violation: scenario.expectViolation,
  };
  try {
    await page.goto(`${clientUrl}/quiz/${course.quizId}/take`);
    const started = page.waitForResponse(r => r.url().includes(`/quiz-responses/${course.quizId}/start`), { timeout: 30000 });
    await page.getByRole("button", { name: /Enter Fullscreen/ }).click();
    const startRes = await started;
    const responseId = (await startRes.json()).response?._id;
    await page.locator(".question-section").first().waitFor({ timeout: 30000 });
    // Playwright emulates focus by default (every page always "has focus"), which hides the blur
    // events the proctoring listens for. Turn it off, after navigation, so focus behaves like a real browser.
    if (browser.browserType().name() === "chromium") {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    }
    await sleep(SETTLE_MS);

    row.fullscreen_at_start = await page.evaluate(() => Boolean(document.fullscreenElement));
    row.has_focus_at_start = await page.evaluate(() => document.hasFocus());
    row.violations_before_behaviour = (await QuizResponse.findById(responseId).select("violations").lean())?.violations.length ?? null;

    const notes = await scenario.run({ page, context });
    await sleep(AFTER_MS);

    const attempt = await QuizResponse.findById(responseId).select("violations status").lean();
    row.response_id = responseId;
    row.violations_recorded = attempt.violations.length;
    row.violation_reasons = attempt.violations.map(v => v.reason).join(" | ");
    row.violation_requests_sent = violationRequests.length;
    row.status_after = attempt.status;
    row.terminated = attempt.status === "terminated" || attempt.violations.length >= MAX_VIOLATIONS;
    row.notes = JSON.stringify(notes);
    row.error = "";
  } catch (err) {
    row.error = err.message.split("\n")[0].slice(0, 200);
  } finally {
    await context.close().catch(() => {});
  }
  return row;
};

const csvCell = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

let server, client;
const rows = [];
const browserVersions = {};
const blockedBrowsers = {};
try {
  const db = await connect();
  const env = await collectEnvironment({ playwright: (await import("playwright/package.json", { with: { type: "json" } })).default.version, headless: HEADLESS });
  server = await startServer({ port: API_PORT, logPath: join(OUT, "raw", "server.log"), env: { CLIENT_URLS: `http://localhost:${CLIENT_PORT}` } });
  client = await startClient(server.baseUrl);
  console.log(`[${db}] backend ${server.baseUrl}, client ${client.url}, results -> ${OUT}`);

  let globalIndex = 0;
  for (const browserName of BROWSERS) {
    let browser;
    try {
      browser = await LAUNCHERS[browserName]();
    } catch (err) {
      blockedBrowsers[browserName] = err.message.split("\n")[0].slice(0, 160);
      console.log(`${browserName}: could not launch (${blockedBrowsers[browserName]})`);
      continue;
    }
    browserVersions[browserName] = browser.version();
    for (const scenario of scenarios) {
      for (let runNo = 1; runNo <= RUNS; runNo++) {
        const row = await runOnce({ browser, browserName, scenario, runNo, globalIndex: globalIndex++, apiUrl: server.baseUrl, clientUrl: client.url });
        rows.push(row);
        console.log(`${browserName} ${scenario.id} #${runNo}: violations=${row.violations_recorded ?? "-"} terminated=${row.terminated ?? "-"} fs=${row.fullscreen_at_start ?? "-"}${row.error ? ` ERROR ${row.error}` : ""}`);
      }
    }
    await browser.close();
  }

  // ── Results ──
  const cols = ["browser", "scenario", "run", "expected_violation", "violations_recorded", "terminated", "status_after",
    "violation_reasons", "violation_requests_sent", "violations_before_behaviour", "fullscreen_at_start", "has_focus_at_start",
    "notes", "student", "quiz", "response_id", "error"];
  writeFileSync(join(OUT, "runs.csv"), [cols.join(","), ...rows.map(r => cols.map(c => csvCell(r[c])).join(","))].join("\n") + "\n");
  writeFileSync(join(OUT, "environment.json"), JSON.stringify({ ...env, browsers: browserVersions, blockedBrowsers }, null, 2));

  const summary = [];
  for (const browserName of Object.keys(browserVersions)) {
    for (const s of scenarios) {
      const rs = rows.filter(r => r.browser === browserName && r.scenario === s.id);
      const ok = rs.filter(r => !r.error);
      summary.push({
        browser: browserName, scenario: s.id, label: s.label, expected: s.expectViolation ? "violation" : "none",
        runs: rs.length, valid_runs: ok.length,
        runs_with_violation: ok.filter(r => r.violations_recorded > 0).length,
        runs_terminated: ok.filter(r => r.terminated).length,
        total_violations: ok.reduce((n, r) => n + r.violations_recorded, 0),
        fullscreen_at_start: ok.filter(r => r.fullscreen_at_start).length,
        errored_runs: rs.length - ok.length,
        reasons: [...new Set(ok.flatMap(r => r.violation_reasons ? r.violation_reasons.split(" | ") : []))].join("; "),
      });
    }
  }
  const sCols = Object.keys(summary[0] || { browser: "" });
  writeFileSync(join(OUT, "summary.csv"), [sCols.join(","), ...summary.map(r => sCols.map(c => csvCell(r[c])).join(","))].join("\n") + "\n");

  const md = [
    `# Proctoring false-positive test (${stamp})`, "",
    `- Machine: ${env.cpu}, ${env.ramGB} GB RAM, ${env.os}; Node ${env.node}; Playwright ${env.playwright}; ${HEADLESS ? "headless" : "headed (visible windows)"}`,
    `- Browsers: ${Object.entries(browserVersions).map(([b, v]) => `${b} ${v}`).join(", ")}`,
    ...Object.entries(blockedBrowsers).map(([b, e]) => `- ${b}: not run (${e})`),
    `- Each run: a fresh attempt; student clicks "Enter Fullscreen & Begin Quiz", waits ${SETTLE_MS / 1000} s, performs the behaviour once, waits ${AFTER_MS / 1000} s; violations counted from the backend database. Termination threshold: ${MAX_VIOLATIONS} violations.`,
    "",
    "| Browser | Behaviour | Expected | Runs with ≥1 violation | Reached termination | Fullscreen at start | Errors | Recorded reasons |",
    "|---|---|---|---|---|---|---|---|",
    ...summary.map(r => `| ${r.browser} | ${r.label} | ${r.expected} | ${r.runs_with_violation}/${r.valid_runs} | ${r.runs_terminated}/${r.valid_runs} | ${r.fullscreen_at_start}/${r.valid_runs} | ${r.errored_runs} | ${r.reasons || "—"} |`),
    "", "## Not simulated (test manually)", "",
    ...NOT_SIMULATED.map(([what, why]) => `- **${what}**: ${why}`), "",
  ];
  writeFileSync(join(OUT, "summary.md"), md.join("\n"));
  console.log(`\nwrote ${join(OUT, "summary.md")}`);
} catch (err) {
  console.error("Proctoring test failed:", err.message);
  process.exitCode = 1;
} finally {
  if (client) client.child.kill();
  if (server) await stopServer(server);
  await disconnect();
}

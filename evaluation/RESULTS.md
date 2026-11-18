# CampusLink evaluation results

All numbers below were measured by the scripts in this folder; none are estimates. Raw data for every
table is in `results/` (paths given per section). Times are milliseconds unless stated.

## Test environment

| Item | Value |
|---|---|
| Machine | Laptop, Intel Core i5-11400H @ 2.70 GHz (6 cores / 12 threads), 15.7 GB RAM |
| GPU | NVIDIA GeForce RTX 3050 Laptop (not used by any test) |
| OS | Windows 11 Home Single Language (10.0.26200, x64) |
| Node.js | v26.10.0 |
| Database | MongoDB Atlas M0 (shared free tier), MongoDB 8.0.37, database `campuslink_test` |
| DB round trip from the laptop | median 26.1–26.9 ms across runs (10 pings each) |
| Backend | one `node server.js` process on the laptop, restarted before every test run |
| Load generator | k6 v2.4.0, on the same laptop |
| Browser automation | Playwright 1.65.1 |
| LLM | Google Gemini API, free tier (model per run below) |

Test data: 1 faculty, 100 students (`student001`–`student100@test.local`), 5 courses with 1 published
30-minute quiz each (10 questions: 5 MCQ incl. one with two correct options, 3 true/false, 2 short answer;
3 topics per quiz; 19 marks). Every student is enrolled in every course. No real user data was used.

## 1. Load test (Task 2) — 2026-11-17

Raw data: `results/load/2026-11-17T19-57-13/`

Scenario: all N students start at the same instant; each logs in, starts its course's quiz, autosaves one
answer every ~3 s (±30% jitter) for all 10 questions, then submits. Students are spread over C courses.

| N | C | Login p50 / p95 / max | Quiz start p50 / p95 / max | Autosave p50 / p95 / max | Submit p50 / p95 / max | Error rate |
|---|---|---|---|---|---|---|
| 25 | 1 | 516 / 626 / 665 | 1106 / 1448 / 1465 | 61 / 84 / 131 | 90 / 98 / 104 | 0% |
| 50 | 1 | 667 / 1578 / 1677 | 2758 / 3029 / 3261 | 62 / 87 / 339 | 90 / 130 / 148 | 0% |
| 100 | 1 | 1692 / 2540 / 2646 | 5793 / 6019 / 6692 | 60 / 334 / 961 | 98 / 1010 / 1976 | 0% |
| 25 | 5 | 788 / 909 / 1697 | 1068 / 1887 / 1905 | 60 / 88 / 115 | 90 / 95 / 107 | 0% |
| 50 | 5 | 699 / 1557 / 2492 | 2862 / 2946 / 3090 | 62 / 92 / 130 | 90 / 102 / 165 | 0% |
| 100 | 5 | 1748 / 2599 / 2709 | 5786 / 6086 / 6722 | 60 / 447 / 929 | 98 / 999 / 1978 | 0% |

- 4,550 requests in total, 0 failed.
- AI feedback generation: not measured under load — it is a separate student action, not triggered on submit (see section 4).
- Quiz start latency grows roughly in proportion to the number of students starting at once, and is the
  same for C = 1 and C = 5. The cause was not measured (a plausible but unverified explanation is the M0
  shared cluster's throughput limit; each start makes about five database round trips).

### Single-session rule — 2026-11-17

Raw data: `results/load/2026-11-17T19-57-13/single-session-*`

20 accounts at the same time, each logged in from two clients.

| Check | Result |
|---|---|
| Second login after the first: first session rejected | 20/20 |
| Requests the first session made before rejection | 1 (rejected on its first request) |
| Second session works | 20/20 |
| First session still rejected 35 s later (after the 30 s server session cache) | 20/20 |
| Both clients log in at the same instant: exactly one session valid | 20/20 (never both, never neither) |

## 2. Proctoring false-positive test (Task 3) — 2026-11-17

Raw data: `results/proctoring/2026-11-17T20-19-52/` (`runs.csv` has one row per run)

Visible (headed) browser windows. Each run: fresh attempt → "Enter Fullscreen & Begin Quiz" → wait 1.5 s →
behaviour performed once → wait 2.5 s → violations read from the backend database. Termination threshold: 3.

| Behaviour (once per run) | Chromium 159 | Edge 157 | Reached termination |
|---|---|---|---|
| (f) Normal clicks inside the page (control) | 0/10 | 0/10 | 0/20 |
| (a) Network drop, 3 s offline | 0/10 | 0/10 | 0/20 |
| (b) Leaving fullscreen once (the effect of a real Esc) | 10/10 | 10/10 | 0/20 |
| (b) Synthetic Esc key event (does not leave fullscreen) | 0/10 | 4/10 * | 0/20 |
| (c) Page viewport resize | 0/10 | 0/10 | 0/20 |
| (d) `alert()` dialog, dismissed after 1.5 s | 10/10 | 10/10 | 0/20 |
| (d) Pop-up window, closed after 1.5 s | 0/10 | 0/10 | 0/20 |
| (g) Deliberate tab switch for 2 s (positive control) | 10/10 | 10/10 | 0/20 |

Cells: runs that recorded at least one violation. Every violating run recorded exactly one violation.

\* Unexplained and not reproduced in Chromium. In 1 of the 4 runs focus was already lost before the key was
sent (an environmental focus change); in the other 3 the quiz window lost focus during the behaviour even
though fullscreen did not change. Treat this row as unreliable.

Headline (6 honest behaviours, using "leaving fullscreen" for Esc): 40 of 120 sessions (33.3%) recorded a
violation, 0 reached termination; the positive control was detected in 20/20.

Harness notes: Playwright's default focus emulation was turned off (with it on, even the positive control
logged nothing). Firefox and WebKit could not be run (see "Could not be tested").

## 3. AI feedback (Task 4) — 2026-11-18

Raw data: `results/ai/` (`feedback-raw.jsonl` = every call; `feedback-for-rating.csv` = sheet for raters;
`latency.csv`; `summary.md`)

40 synthetic completed attempts over the 5 quizzes, 8 per quiz, in six score patterns: all correct (6),
high but weak in one topic (6), medium weak in one topic (8), medium weak in several (8), low weak in all
(6), low with one topic fully correct (6). Each called the real `POST /api/quiz-responses/:id/ai-feedback`
endpoint as that student, 6 s apart.

**Model.** The app default `gemini-3.8-flash` was unavailable on the free tier on both test days: 4 calls
(2026-11-17 and 2026-11-18) failed with Google's `503 high demand` / `504 deadline expired`, also after two
automatic retries, and `gemini-3.6-flash` / `gemini-3.5-flash` returned 503 to a one-word probe. The
evaluation therefore ran on **`gemini-3.5-flash-lite`** (free tier), passed to the backend for this run only.

| Measure (n = 40) | Mean | p50 | p95 | Min | Max |
|---|---|---|---|---|---|
| LLM call latency, measured in the backend (ms) | 4738 | 2436 | 10780 | 1321 | 25697 |
| Endpoint round trip, client → backend → LLM → client (ms) | 4871 | 2566 | 10937 | 1447 | 25831 |
| Input tokens per call | 497 | 494 | 534 | 472 | 538 |
| Output tokens per call (incl. thinking) | 196 | 197 | 231 | 143 | 234 |

- 40/40 attempts got feedback; 2 of the 40 needed one automatic retry after a Gemini overload error
  (latency above includes the retry wait).
- Cost per call: $0 (free tier). Token counts as reported by the API.

**Automatic checks** (keyword heuristics; each flag was then read by hand — confirm with human raters):

| Check | Flagged automatically | After reading the flagged outputs |
|---|---|---|
| Names a fully-correct topic as weak (26 attempts had ≥1 fully-correct topic) | 1/40 | 0/40 — the one flag (A40) calls HTTP the student's *strong* topic |
| Mentions a topic not in the quiz | 5/40 | 0 invented topics: 2 are "go further" suggestions after a perfect score (concurrency control; priority queues and graph algorithms), 3 are words inside an in-quiz topic ("concurrency issues like dirty reads", "job queues" in scheduling) |

Noted for the raters (not caught by the checks): A17 says Transactions is where the student "missed a few
marks", but the student scored 0/6 on it.

**Not done (needs people):** accuracy / relevance / actionability ratings and inter-rater agreement.
Give copies of `results/ai/feedback-for-rating.csv` to the raters, put the filled files in
`results/ai/ratings/`, run `npm run ratings`.

## How to rerun

From `evaluation/` (needs `server/.env` with a `MONGO_URI` whose database ends in `_test`):

```
npm install                    # Playwright (first time: npx playwright install chromium)
npm run seed                   # (re)create the dummy data
npm run load                   # Task 2: 6 load levels + single-session test (~7 min)
npm run proctoring             # Task 3: ~35 min, visible windows - don't use the PC meanwhile
npm run ai -- --model gemini-3.5-flash-lite   # Task 4: resumes until all 40 attempts have feedback
npm run ai-report              # rebuild the AI CSVs/summary without calling the LLM
npm run ratings                # after raters fill in copies of results/ai/feedback-for-rating.csv
npm run cleanup                # remove all evaluation data
```

Single levels: `node load/run-load.mjs --levels 25 --courses 1 --skip-session`;
`node proctoring/run-proctoring.mjs --runs 2 --browsers chromium --scenarios f_control_click,g_tab_switch`.

## Failed or could not be tested

- **Firefox and WebKit/Safari**: Windows Smart App Control blocks Playwright's builds on this PC, and neither
  browser is installed. Only Chromium-based browsers (Chromium, Edge) were tested.
- **Behaviours Playwright cannot simulate faithfully** (test manually): opening/closing DevTools, real OS
  notifications, Alt-Tab / opening another app, the physical Esc and F11 keys, dragging the real window edge,
  a same-window tab switch, a real Wi-Fi outage.
- **Multi-instance backend**: not tested. The server caches each account's session for 30 s per process,
  so with several instances an invalidated session could still work on another instance for up to 30 s.
- **Load test realism**: single backend process, shared free-tier database, load generator on the same
  machine; absolute latencies would differ in production.
- **Gemini 3.8 Flash** (the app's default model): unavailable on the free tier during both test days
  (4 failed calls, logged); the AI evaluation used `gemini-3.5-flash-lite` instead.
- **Human studies**: feedback-quality ratings need real raters and were not run yet. A SUS usability study was dropped from the paper for now (listed as future work).

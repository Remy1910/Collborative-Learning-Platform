# AI feedback sample and latency

- Attempts with feedback: 0/40; failed calls logged: 3
- Model (as reported by the API): —; Google Gemini API free tier
- Calls made: — to —
- Machine: 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz, 15.7 GB RAM, Windows 11 Home Single Language (win32 10.0.26200, x64); Node v26.10.0

| Measure | n | Mean | p50 | p95 | Min | Max |
|---|---|---|---|---|---|---|
| LLM call latency (ms, measured in the backend) | 0 | — | — | — | — | — |
| Endpoint round trip (ms, client → backend → LLM → client) | 0 | — | — | — | — | — |
| Input tokens per call | 0 | — | — | — | — | — |
| Output tokens per call (incl. thinking) | 0 | — | — | — | — | — |

Cost per call: $0 (free tier). Token counts are reported by the API.

## Automatic checks (keyword heuristics; raters should confirm)

- Feedback names a fully-correct topic in a clause about weakness: 0/0 (—%); 0 attempts had at least one fully-correct topic
- Feedback mentions a topic that is not in the quiz: 0/0 (—%)

## Failed calls

- A01 at 2026-11-17T20:42:26.396Z: HTTP 502 AI feedback could not be generated, please try again
- A02 at 2026-11-17T20:43:30.988Z: HTTP 502 AI feedback could not be generated, please try again
- A01 at 2026-11-17T20:43:52.574Z: HTTP 502 AI feedback could not be generated, please try again

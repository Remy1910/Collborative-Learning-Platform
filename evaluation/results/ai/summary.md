# AI feedback sample and latency

- Attempts with feedback: 40/40; failed calls logged: 4
- Model (as reported by the API): gemini-3.5-flash-lite; Google Gemini API free tier
- Calls made: 2026-11-18 to 2026-11-18
- Machine: 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz, 15.7 GB RAM, Windows 11 Home Single Language (win32 10.0.26200, x64); Node v26.10.0

| Measure | n | Mean | p50 | p95 | Min | Max |
|---|---|---|---|---|---|---|
| LLM call latency (ms, measured in the backend) | 40 | 4738 | 2436 | 10780 | 1321 | 25697 |
| Endpoint round trip (ms, client → backend → LLM → client) | 40 | 4871 | 2566 | 10937 | 1447 | 25831 |
| Input tokens per call | 40 | 497 | 494 | 534 | 472 | 538 |
| Output tokens per call (incl. thinking) | 40 | 196 | 197 | 231 | 143 | 234 |

Cost per call: $0 (free tier). Token counts are reported by the API.
LLM latency includes automatic retries after Gemini overload errors (503/504/500; up to 2 retries, 5 s and 15 s apart). Calls that needed at least one retry: 2/40.

## Automatic checks (keyword heuristics; raters should confirm)

- Feedback names a fully-correct topic in a clause about weakness: 1/40 (2.5%); 26 attempts had at least one fully-correct topic
- Feedback mentions a topic that is not in the quiz: 5/40 (12.5%)

## Failed calls

- A01 at 2026-11-17T20:42:26.396Z (gemini-3.8-flash): HTTP 502 AI feedback could not be generated, please try again
- A02 at 2026-11-17T20:43:30.988Z (gemini-3.8-flash): HTTP 502 AI feedback could not be generated, please try again
- A01 at 2026-11-17T20:43:52.574Z (gemini-3.8-flash): HTTP 502 AI feedback could not be generated, please try again
- A01 at 2026-11-18T17:44:27.306Z (gemini-3.8-flash): HTTP 502 AI feedback could not be generated, please try again

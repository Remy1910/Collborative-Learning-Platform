# Load test results (2026-11-17T19-57-13)

- Machine: 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz (12 logical cores), 15.7 GB RAM, Windows 11 Home Single Language (win32 10.0.26200, x64)
- Node v26.10.0, MongoDB 8.0.37 (MongoDB Atlas, ***.vb0am0a.mongodb.net), k6.exe v2.4.0 (commit/dd9395906d, go1.26.11, windows/amd64)
- DB round trip from this machine: median 26.9 ms, max 34.4 ms (10 pings)
- Backend: one Node process, restarted before every level; k6 ran on the same machine
- Scenario: each student logs in, starts the quiz, autosaves 10 answers ~3 s apart (±30%), then submits

## Response times

| Level | Operation | p50 (ms) | p95 (ms) | Max (ms) | Error rate | Samples |
|---|---|---|---|---|---|---|
| N=25, C=1 | Login | 516 | 626 | 665 | 0.00% | 25 |
| N=25, C=1 | Quiz start | 1106 | 1448 | 1465 | 0.00% | 25 |
| N=25, C=1 | Autosave | 61 | 84 | 131 | 0.00% | 250 |
| N=25, C=1 | Quiz submit | 90 | 98 | 104 | 0.00% | 25 |
| N=25, C=1 | AI feedback generation | N/A | N/A | N/A | N/A | not triggered on submit |
| N=50, C=1 | Login | 667 | 1578 | 1677 | 0.00% | 50 |
| N=50, C=1 | Quiz start | 2758 | 3029 | 3261 | 0.00% | 50 |
| N=50, C=1 | Autosave | 62 | 87 | 339 | 0.00% | 500 |
| N=50, C=1 | Quiz submit | 90 | 130 | 148 | 0.00% | 50 |
| N=50, C=1 | AI feedback generation | N/A | N/A | N/A | N/A | not triggered on submit |
| N=100, C=1 | Login | 1692 | 2540 | 2646 | 0.00% | 100 |
| N=100, C=1 | Quiz start | 5793 | 6019 | 6693 | 0.00% | 100 |
| N=100, C=1 | Autosave | 60 | 334 | 961 | 0.00% | 1000 |
| N=100, C=1 | Quiz submit | 98 | 1010 | 1976 | 0.00% | 100 |
| N=100, C=1 | AI feedback generation | N/A | N/A | N/A | N/A | not triggered on submit |
| N=25, C=5 | Login | 788 | 909 | 1697 | 0.00% | 25 |
| N=25, C=5 | Quiz start | 1068 | 1887 | 1905 | 0.00% | 25 |
| N=25, C=5 | Autosave | 60 | 88 | 115 | 0.00% | 250 |
| N=25, C=5 | Quiz submit | 90 | 95 | 107 | 0.00% | 25 |
| N=25, C=5 | AI feedback generation | N/A | N/A | N/A | N/A | not triggered on submit |
| N=50, C=5 | Login | 699 | 1557 | 2492 | 0.00% | 50 |
| N=50, C=5 | Quiz start | 2862 | 2946 | 3090 | 0.00% | 50 |
| N=50, C=5 | Autosave | 62 | 92 | 130 | 0.00% | 500 |
| N=50, C=5 | Quiz submit | 90 | 102 | 165 | 0.00% | 50 |
| N=50, C=5 | AI feedback generation | N/A | N/A | N/A | N/A | not triggered on submit |
| N=100, C=5 | Login | 1748 | 2599 | 2709 | 0.00% | 100 |
| N=100, C=5 | Quiz start | 5786 | 6086 | 6722 | 0.00% | 100 |
| N=100, C=5 | Autosave | 60 | 447 | 929 | 0.00% | 1000 |
| N=100, C=5 | Quiz submit | 98 | 999 | 1978 | 0.00% | 100 |
| N=100, C=5 | AI feedback generation | N/A | N/A | N/A | N/A | not triggered on submit |

## Single-session rule

20 accounts, all running at the same time.

| Check | Result |
|---|---|
| Sequential: first session rejected after the second login | 20/20 |
| Sequential: requests by the first session until rejected | min 1, max 1 |
| Sequential: second session works | 20/20 |
| Sequential: first session still rejected 35 s later (after the 30 s session cache) | 20/20 |
| Simultaneous: exactly one session valid | 20/20 |
| Simultaneous: both sessions valid | 0/20 |
| Simultaneous: neither session valid | 0/20 |
| Simultaneous: a login request failed | 0/20 |
| Simultaneous: surviving session was the later login response | 19/20 |

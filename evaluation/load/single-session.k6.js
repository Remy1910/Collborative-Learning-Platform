// k6 scenario: single-session rule. ACCOUNTS students (the last ones in the manifest) run concurrently.
//  Sequential: client A logs in and works, client B logs in; count A's requests until it is rejected,
//              then check A is still rejected after the server's 30 s session cache has expired.
//  Simultaneous: A and B log in at the same instant; check that exactly one session stays valid.
// Per-account results are printed as "SESSION_RESULT {json}" lines for the runner.
// Env: BASE_URL, ACCOUNTS, MAX_PROBES, CACHE_WAIT_SECONDS, SUMMARY_PATH
import http from "k6/http";
import { sleep } from "k6";
import exec from "k6/execution";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5055";
const ACCOUNTS = Number(__ENV.ACCOUNTS || 20);
const MAX_PROBES = Number(__ENV.MAX_PROBES || 10);
const CACHE_WAIT_SECONDS = Number(__ENV.CACHE_WAIT_SECONDS || 35); // server caches sessions for 30 s
const manifest = JSON.parse(open("../seed/manifest.json"));
const accounts = manifest.students.slice(-ACCOUNTS);

const seqFirstRejected = new Rate("seq_first_session_rejected");
const seqRequestsUntilRejected = new Trend("seq_requests_until_rejected");
const seqStillRejected = new Rate("seq_first_still_rejected_after_cache_ttl");
const seqSecondOk = new Rate("seq_second_session_valid");
const simExactlyOne = new Rate("sim_exactly_one_session_valid");
const simBoth = new Rate("sim_both_sessions_valid");
const simSurvivorLater = new Rate("sim_survivor_is_later_login_response");

export const options = {
  scenarios: {
    session: { executor: "per-vu-iterations", vus: ACCOUNTS, iterations: 1, maxDuration: "5m" },
  },
  summaryTrendStats: ["min", "med", "avg", "max", "count"],
  thresholds: {
    seq_first_session_rejected: ["rate>=0"],
    seq_first_still_rejected_after_cache_ttl: ["rate>=0"],
    seq_second_session_valid: ["rate>=0"],
    sim_exactly_one_session_valid: ["rate>=0"],
    sim_both_sessions_valid: ["rate>=0"],
    sim_survivor_is_later_login_response: ["rate>=0"],
  },
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const loginRequest = (email) => ({
  method: "POST",
  url: `${BASE_URL}/api/auth/login`,
  body: JSON.stringify({ email, password: manifest.password }),
  params: { headers: JSON_HEADERS, tags: { op: "login" } },
});
const login = (email) => {
  const r = loginRequest(email);
  return http.post(r.url, r.body, r.params);
};
const probe = (token) => {
  const res = http.get(`${BASE_URL}/api/protected`, {
    headers: { Authorization: `Bearer ${token}` }, tags: { op: "protected" },
  });
  let code = null;
  try { code = res.json("code"); } catch { /* non-JSON */ }
  return { status: res.status, code };
};
const rejected = (p) => p.status === 401 && p.code === "SESSION_INVALIDATED";

export default function () {
  const account = accounts[exec.vu.idInTest - 1];
  const result = { email: account.email };

  // ── Sequential: A, then B ──
  const a = login(account.email);
  const b0 = a.status === 200 ? probe(a.json("token")) : null;
  result.seq_a_login = a.status;
  result.seq_a_valid_before = b0?.status === 200;

  const b = login(account.email);
  result.seq_b_login = b.status;
  if (a.status === 200 && b.status === 200) {
    const tokenA = a.json("token");
    let probes = 0;
    let wasRejected = false;
    while (probes < MAX_PROBES) {
      probes++;
      if (rejected(probe(tokenA))) { wasRejected = true; break; }
    }
    result.seq_requests_until_rejected = wasRejected ? probes : null;
    result.seq_b_valid = probe(b.json("token")).status === 200;

    sleep(CACHE_WAIT_SECONDS);
    result.seq_a_still_rejected = rejected(probe(tokenA));

    seqFirstRejected.add(wasRejected);
    if (wasRejected) seqRequestsUntilRejected.add(probes);
    seqStillRejected.add(result.seq_a_still_rejected);
    seqSecondOk.add(result.seq_b_valid);
  }

  // ── Simultaneous: A and B at the same instant ──
  const [sa, sb] = http.batch([loginRequest(account.email), loginRequest(account.email)]);
  result.sim_logins = [sa.status, sb.status];
  if (sa.status === 200 && sb.status === 200) {
    const pa = probe(sa.json("token"));
    const pb = probe(sb.json("token"));
    const validA = pa.status === 200;
    const validB = pb.status === 200;
    result.sim_valid = [validA, validB];
    result.sim_rejected_codes = [pa.code, pb.code];
    result.sim_login_ms = [sa.timings.duration, sb.timings.duration];
    simExactlyOne.add(validA !== validB);
    simBoth.add(validA && validB);
    if (validA !== validB) {
      // http.batch starts both requests together, so the longer one completed later
      const survivorLater = validA ? sa.timings.duration >= sb.timings.duration : sb.timings.duration >= sa.timings.duration;
      result.sim_survivor_is_later_response = survivorLater;
      simSurvivorLater.add(survivorLater);
    }
  }

  console.log(`SESSION_RESULT ${JSON.stringify(result)}`);
}

export function handleSummary(data) {
  return { [__ENV.SUMMARY_PATH || "session-summary.json"]: JSON.stringify(data, null, 2) };
}

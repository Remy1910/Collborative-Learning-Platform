// Records the machine and software versions a test ran on (measured, never typed in by hand)
import os from "node:os";
import { execFileSync } from "node:child_process";
import { mongoose, MONGO_URI } from "./db.mjs";

const tryRun = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

// Call after connect(); `extra` holds tool versions such as k6 or Playwright
export const collectEnvironment = async (extra = {}) => {
  const cpus = os.cpus();
  const admin = mongoose.connection.db.admin();
  const info = await admin.serverInfo();

  // Round trip from this machine to the database, which every DB-backed request pays at least once
  const pings = [];
  for (let i = 0; i < 10; i++) {
    const t = performance.now();
    await admin.ping();
    pings.push(performance.now() - t);
  }

  let mongoHost = "unknown";
  try {
    mongoHost = new URL(MONGO_URI).host.replace(/^[^.]+/, "***"); // hide the cluster's own name
  } catch { /* leave unknown */ }

  return {
    recordedAt: new Date().toISOString(),
    cpu: cpus[0]?.model?.trim(),
    cpuLogicalCores: cpus.length,
    ramGB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    os: `${os.version()} (${os.platform()} ${os.release()}, ${os.arch()})`,
    node: process.version,
    mongodb: info.version,
    mongoHost,
    mongoIsAtlas: /mongodb\.net$/.test(mongoHost),
    mongoPingMedianMs: Number(median(pings).toFixed(1)),
    mongoPingMaxMs: Number(Math.max(...pings).toFixed(1)),
    ...extra,
  };
};

export const k6Version = (bin) => tryRun(bin, ["version"]);

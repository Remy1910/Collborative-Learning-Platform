// Starts and stops a fresh backend for a test run. A fresh process per run also resets the
// in-memory login rate limiter and the session/quiz caches, so every run starts from the same state.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { SERVER_DIR } from "./db.mjs";

export const startServer = async ({ port, logPath, env = {} }) => {
  const log = createWriteStream(logPath);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);

  let output = "";
  child.stdout.on("data", d => { output += d; });
  const baseUrl = `http://localhost:${port}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited early (code ${child.exitCode}); see ${logPath}`);
    // Ready once it answers HTTP *and* has connected to MongoDB
    try {
      const res = await fetch(baseUrl);
      if (res.ok && output.includes("MongoDB connected")) return { child, baseUrl };
    } catch { /* not listening yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  child.kill();
  throw new Error(`Server did not become ready within 60 s; see ${logPath}`);
};

export const stopServer = async ({ child }) => {
  if (child.exitCode !== null) return;
  const exited = new Promise(r => child.once("exit", r));
  child.kill();
  await exited;
};

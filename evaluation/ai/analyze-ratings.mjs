#!/usr/bin/env node
// Summarizes human ratings of the AI feedback once raters have filled in copies of
// results/ai/feedback-for-rating.csv. Put one CSV per rater (with the "rater" column filled)
// into results/ai/ratings/, then:
//   node ai/analyze-ratings.mjs
// Reports mean accuracy/relevance/actionability, inter-rater agreement as ICC(2,1) and ICC(2,k)
// (two-way random effects, absolute agreement; Shrout & Fleiss 1979), and the share of outputs
// whose mean accuracy rating is <= 2 ("judged inaccurate").
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "results", "ai", "ratings");
const DIMS = ["accuracy(1-5)", "relevance(1-5)", "actionability(1-5)"];

// Minimal RFC 4180 CSV parser (quoted fields, embedded commas/newlines, BOM)
const parseCsv = (text) => {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(c => c.trim()));
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
};

// ICC(2,1) and ICC(2,k) for an n x k matrix with no missing cells
const icc = (matrix) => {
  const n = matrix.length, k = matrix[0].length;
  const grand = matrix.flat().reduce((a, b) => a + b, 0) / (n * k);
  const rowMeans = matrix.map(r => r.reduce((a, b) => a + b, 0) / k);
  const colMeans = Array.from({ length: k }, (_, j) => matrix.reduce((s, r) => s + r[j], 0) / n);
  const ssRows = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssCols = n * colMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssTotal = matrix.flat().reduce((s, x) => s + (x - grand) ** 2, 0);
  const ssErr = ssTotal - ssRows - ssCols;
  const msr = ssRows / (n - 1), msc = ssCols / (k - 1), mse = ssErr / ((n - 1) * (k - 1));
  return {
    icc21: (msr - mse) / (msr + (k - 1) * mse + (k * (msc - mse)) / n),
    icc2k: (msr - mse) / (msr + (msc - mse) / n),
  };
};

if (!existsSync(DIR)) {
  console.error(`No ratings yet. Put each rater's filled CSV into ${DIR}`);
  process.exit(1);
}
const files = readdirSync(DIR).filter(f => f.toLowerCase().endsWith(".csv"));
const ratings = []; // { rater, attempt, dim, value }
for (const f of files) {
  for (const r of parseCsv(readFileSync(join(DIR, f), "utf8"))) {
    const rater = r.rater || f.replace(/\.csv$/i, "");
    for (const dim of DIMS) {
      const v = Number(r[dim]);
      if (Number.isInteger(v) && v >= 1 && v <= 5) ratings.push({ rater, attempt: r.attempt_id, dim, value: v });
    }
  }
}
const raters = [...new Set(ratings.map(r => r.rater))];
const attempts = [...new Set(ratings.map(r => r.attempt))];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1 || 1)); };

const lines = [`# Feedback rating results`, "", `- Raters: ${raters.length} (${raters.join(", ")})`, `- Outputs rated: ${attempts.length}`, "",
  "| Dimension | Mean | SD | ICC(2,1) | ICC(2,k) | Outputs rated by all raters |", "|---|---|---|---|---|---|"];
for (const dim of DIMS) {
  const vals = ratings.filter(r => r.dim === dim).map(r => r.value);
  const complete = attempts.filter(a => raters.every(rt => ratings.some(r => r.dim === dim && r.attempt === a && r.rater === rt)));
  const matrix = complete.map(a => raters.map(rt => ratings.find(r => r.dim === dim && r.attempt === a && r.rater === rt).value));
  const agreement = raters.length >= 2 && complete.length >= 2 ? icc(matrix) : null;
  lines.push(`| ${dim} | ${vals.length ? mean(vals).toFixed(2) : "—"} | ${vals.length > 1 ? sd(vals).toFixed(2) : "—"} | ` +
    `${agreement ? agreement.icc21.toFixed(2) : "—"} | ${agreement ? agreement.icc2k.toFixed(2) : "—"} | ${complete.length} |`);
}
const accPerOutput = attempts.map(a => mean(ratings.filter(r => r.dim === "accuracy(1-5)" && r.attempt === a).map(r => r.value))).filter(x => !Number.isNaN(x));
const inaccurate = accPerOutput.filter(x => x <= 2).length;
lines.push("", `- Outputs judged inaccurate (mean accuracy <= 2): ${inaccurate}/${accPerOutput.length}` +
  ` (${accPerOutput.length ? ((100 * inaccurate) / accPerOutput.length).toFixed(1) : "—"}%)`, "");
writeFileSync(join(DIR, "..", "ratings-summary.md"), lines.join("\n"));
console.log(lines.join("\n"));

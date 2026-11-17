// The 40 synthetic completed attempts: each fixes, per topic, how well the student did.
// "full" = every question in the topic fully right, "none" = all wrong, "partial" = some marks.
// Deterministic (seeded), so a rerun builds the same attempts.

// Score profiles over a quiz's three topics [t0, t1, t2]
const PROFILES = [
  { pattern: "high, all topics correct",          count: 6, levels: ["full", "full", "full"] },
  { pattern: "high, weak in one topic",           count: 6, levels: ["full", "full", "partial"] },
  { pattern: "medium, weak in one topic",         count: 8, levels: ["full", "partial", "none"] },
  { pattern: "medium, weak in several topics",    count: 8, levels: ["partial", "partial", "none"] },
  { pattern: "low, weak in all topics",           count: 6, levels: ["none", "partial", "none"] },
  { pattern: "low, but one topic fully correct",  count: 6, levels: ["full", "none", "none"] },
];

// Small seeded PRNG (mulberry32) so plans are reproducible
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Marks for one question at a given topic level; "partial" topics always lose some marks overall
const marksFor = (q, level, rand) => {
  if (level === "full") return q.marks;
  if (level === "none") return 0;
  const roll = rand();
  if (q.type === "shortanswer") return roll < 0.5 ? 1 : 2;
  if (q.type === "mcq" && q.options.filter(o => o.isCorrect).length > 1 && roll < 0.5) return q.marks / 2;
  return roll < 0.5 ? q.marks : 0;
};

export const buildPlan = (manifest) => {
  const rand = rng(20261118);
  const plan = [];
  let i = 0;
  for (const profile of PROFILES) {
    for (let k = 0; k < profile.count; k++, i++) {
      const course = manifest.courses[i % manifest.courses.length];
      // Rotate which topic gets which level so every topic is weak/strong somewhere
      const shift = Math.floor(i / manifest.courses.length) % course.topics.length;
      const levelOf = Object.fromEntries(course.topics.map((t, j) =>
        [t, profile.levels[(j + shift) % profile.levels.length]]));

      let marks = course.questions.map(q => marksFor(q, levelOf[q.topic], rand));
      // A "partial" topic must not come out full or empty by chance
      for (const topic of course.topics.filter(t => levelOf[t] === "partial")) {
        const idx = course.questions.map((q, j) => (q.topic === topic ? j : -1)).filter(j => j >= 0);
        const earned = idx.reduce((s, j) => s + marks[j], 0);
        const possible = idx.reduce((s, j) => s + course.questions[j].marks, 0);
        if (earned === possible) marks[idx[0]] = 0;
        if (earned === 0) marks[idx[0]] = course.questions[idx[0]].marks;
      }

      plan.push({
        attemptId: `A${String(i + 1).padStart(2, "0")}`,
        pattern: profile.pattern,
        studentIndex: i, // student001.. (0-based)
        courseIndex: i % manifest.courses.length,
        quizId: course.quizId,
        levelOf,
        marks,
      });
    }
  }
  return plan;
};

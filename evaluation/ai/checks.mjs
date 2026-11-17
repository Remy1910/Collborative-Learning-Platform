// Automatic sanity checks on a feedback text. These are keyword heuristics meant to flag outputs
// for the human raters, not to replace them: each flag comes with the sentence that triggered it.

// Words that mark a sentence as describing a weakness / something to work on
const WEAKNESS_CUES = /\b(weak|weaker|weakest|weakness|struggl\w*|difficult\w*|trouble|review|revisit|revise|revising|practi[cs]e|improv\w*|work on|focus on|brush up|strengthen|gap|gaps|missed|mistake\w*|incorrect|wrong|lost marks|needs? (more )?(work|attention)|room for)\b/i;

// Topic names that are clearly outside a given quiz: all seeded topics of the other courses,
// plus common CS topics none of the five quizzes covers
const EXTRA_OFF_QUIZ_TOPICS = [
  "Recursion", "Sorting", "Hashing", "Hash Tables", "Graphs", "Stacks", "Queues", "Heaps",
  "Dynamic Programming", "Concurrency", "Deadlock Avoidance", "File Systems",
  "Cryptography", "React", "Node.js", "Machine Learning", "Python",
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text, topic) => new RegExp(`(^|[^A-Za-z])${escapeRegex(topic)}([^A-Za-z]|$)`, "i").test(text);
const sentences = (text) => text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
// "You mastered Arrays, but review Trees" -> judge each clause on its own
const clauses = (sentence) =>
  sentence.split(/[,;:—]|\b(?:but|while|whereas|although|however)\b/i).map(c => c?.trim()).filter(Boolean);

export const checkFeedback = ({ text, quizTopics, correctTopics, allSeededTopics }) => {
  const sents = sentences(text);

  // Fully-correct topic named in a clause that talks about weakness
  const correctAsWeak = [];
  for (const topic of correctTopics) {
    for (const s of sents) {
      if (clauses(s).some(c => mentions(c, topic) && WEAKNESS_CUES.test(c))) correctAsWeak.push({ topic, sentence: s });
    }
  }

  // Topic not in this quiz mentioned anywhere
  const offQuizCandidates = [...new Set([...allSeededTopics, ...EXTRA_OFF_QUIZ_TOPICS])]
    .filter(t => !quizTopics.some(q => q.toLowerCase() === t.toLowerCase()));
  const offQuiz = offQuizCandidates.filter(t => mentions(text, t));

  return {
    mentions_correct_topic_as_weak: correctAsWeak.length > 0,
    correct_topic_as_weak_detail: correctAsWeak.map(c => `${c.topic}: "${c.sentence}"`).join(" || "),
    mentions_topic_not_in_quiz: offQuiz.length > 0,
    off_quiz_topics_found: offQuiz.join("; "),
  };
};

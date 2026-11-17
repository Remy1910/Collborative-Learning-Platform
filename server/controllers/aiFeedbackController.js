const mongoose = require("mongoose");
const { GoogleGenAI, ApiError } = require("@google/genai");
const QuizResponse = require("../models/QuizResponse");

const FINISHED_STATUSES = ["submitted", "graded", "terminated"];
const DEFAULT_TOPIC = "General";
// Free-tier Gemini Flash; pinned so results are reproducible (override with GEMINI_MODEL)
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 60 * 1000;

// Hard cap on LLM calls per server process (unset = no cap), so tests and runaway clients can't exhaust the quota
const MAX_CALLS = process.env.AI_FEEDBACK_MAX_CALLS ? Number(process.env.AI_FEEDBACK_MAX_CALLS) : Infinity;
let callsMade = 0;

// Concurrent requests for the same attempt share one LLM call instead of each making one
const inFlight = new Map(); // responseId -> Promise

let client;
const getClient = () => {
  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: REQUEST_TIMEOUT_MS }
    });
  }
  return client;
};

const feedbackError = (status, message) => Object.assign(new Error(message), { status });

const SYSTEM_PROMPT = `You write short, encouraging study feedback for a student who has just finished a quiz.

Rules:
- Only refer to the topics listed in the quiz results. Never mention or invent any other topic.
- A topic marked "fully correct" is a strength. Never describe it as weak or as needing work.
- Name the student's weakest topics first and give one or two concrete study actions for each.
- If every graded topic is fully correct, congratulate the student and suggest how to go further.
- Questions marked "not yet graded" don't count for or against any topic; don't comment on them.
- Write 120-220 words of plain text, addressed to the student as "you". No headings, no markdown tables.`;

// Per-topic marks for the graded part of the attempt
const summarizeByTopic = (response) => {
  const topics = new Map();
  const questions = [];

  for (const r of response.responses) {
    const q = r.question;
    if (!q) continue;
    const topic = q.topic || DEFAULT_TOPIC;
    const pending = q.type === "shortanswer" && !r.isGraded;
    const earned = r.marksObtained || 0;

    questions.push({ topic, text: q.questionText, type: q.type, marks: q.marks, earned, pending });
    if (pending) continue;

    const t = topics.get(topic) || { topic, earned: 0, possible: 0 };
    t.earned += earned;
    t.possible += q.marks;
    topics.set(topic, t);
  }

  const byTopic = [...topics.values()].map(t => ({
    ...t,
    earned: Number(t.earned.toFixed(2)),
    fullyCorrect: t.possible > 0 && t.earned >= t.possible
  }));
  return { byTopic, questions };
};

const buildPrompt = (quiz, response, { byTopic, questions }) => {
  const topicLines = byTopic.map(t =>
    `- ${t.topic}: ${t.earned}/${t.possible} marks${t.fullyCorrect ? " (fully correct)" : ""}`
  );
  const questionLines = questions.map((q, i) => {
    const result = q.pending ? "not yet graded" : `${q.earned}/${q.marks} marks`;
    return `${i + 1}. [${q.topic}] (${q.type}) ${q.text} — ${result}`;
  });

  return [
    `Quiz: ${quiz.title} (${quiz.subject})`,
    `Score: ${response.totalMarksObtained}/${quiz.totalMarks}${response.status === "terminated" ? " (auto-submitted after proctoring violations)" : ""}`,
    "",
    "Results by topic:",
    ...topicLines,
    "",
    "Questions:",
    ...questionLines
  ].join("\n");
};

const callModel = async (quiz, response) => {
  const summary = summarizeByTopic(response);
  const started = Date.now();

  const result = await getClient().models.generateContent({
    model: MODEL,
    contents: buildPrompt(quiz, response, summary),
    config: { systemInstruction: SYSTEM_PROMPT }
  });

  if (result.promptFeedback?.blockReason) {
    throw feedbackError(502, "The AI model declined to write feedback for this attempt");
  }

  const text = result.text?.trim();
  if (!text) {
    throw feedbackError(502, "The AI model returned no feedback");
  }

  const usage = result.usageMetadata || {};
  return {
    text,
    model: result.modelVersion || MODEL,
    generatedAt: new Date(),
    latencyMs: Date.now() - started,
    inputTokens: usage.promptTokenCount,
    // Thinking tokens count as output (that's how paid tiers bill them), so include them
    outputTokens: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)
  };
};

// Student asks for AI feedback on a finished attempt; generated once, then served from the attempt
const generateAiFeedback = async (req, res) => {
  const { responseId } = req.params;
  try {
    if (!mongoose.isValidObjectId(responseId)) {
      return res.status(400).json({ message: "Invalid response ID" });
    }

    const response = await QuizResponse.findById(responseId)
      .populate("quiz", "title subject totalMarks")
      .populate("responses.question", "type questionText marks topic");

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.student.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!response.isActive || !FINISHED_STATUSES.includes(response.status)) {
      return res.status(400).json({ message: "Submit the quiz before asking for feedback" });
    }

    if (response.aiFeedback?.text) {
      return res.json({ feedback: response.aiFeedback, cached: true });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "AI feedback is not configured on this server" });
    }

    let pending = inFlight.get(responseId);
    if (!pending) {
      if (callsMade >= MAX_CALLS) {
        return res.status(429).json({ message: "AI feedback limit reached on this server" });
      }
      callsMade++;
      pending = callModel(response.quiz, response).finally(() => inFlight.delete(responseId));
      inFlight.set(responseId, pending);
    }

    const feedback = await pending;
    // Only fill it in if no concurrent request already did
    await QuizResponse.updateOne(
      { _id: responseId, "aiFeedback.text": { $exists: false } },
      { $set: { aiFeedback: feedback } }
    );

    res.json({ feedback, cached: false });
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`AI feedback: Gemini API error ${error.status}:`, error.message);
      if (error.status === 429) {
        // Free-tier quota (per minute or per day) used up
        return res.status(503).json({ message: "AI feedback is busy, please try again later" });
      }
      if (error.status === 401 || error.status === 403) {
        return res.status(503).json({ message: "AI feedback is not configured on this server" });
      }
      return res.status(502).json({ message: "AI feedback could not be generated, please try again" });
    }
    if (error.status === 502) {
      return res.status(502).json({ message: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = { generateAiFeedback, summarizeByTopic };

// The learner model — the persistent state that later lives in Postgres.
// This is what turns a chatbot into a *learning system*: every turn updates it,
// and the tutor reads it back to adapt.

import { z } from "zod";

export interface LearnerModel {
  /** objectiveId -> mastery in [0,1]. Absent = untouched (unknown). */
  masteryByObjective: Record<string, number>;
  /** Misconception ids currently believed to be active. */
  activeMisconceptions: string[];
  /** Estimated learner confidence in [0,1] (for confidence-vs-competence). */
  confidence: number;
  turnCount: number;
  /** The objective being worked now (sticky across turns). Null before start. */
  focusObjective: string | null;
  /** Scaffold support level for focusObjective: 0 Question..3 Answer. */
  scaffoldRung: number;
  /** Stalls in the current stuck episode. */
  consecutiveStuck: number;
  /** Objectives whose answer was revealed; pending a retrieval re-check. */
  answerRevealed: string[];
}

export function emptyLearnerModel(): LearnerModel {
  return {
    masteryByObjective: {},
    activeMisconceptions: [],
    confidence: 0.3,
    turnCount: 0,
    focusObjective: null,
    scaffoldRung: 0,
    consecutiveStuck: 0,
    answerRevealed: [],
  };
}

// ── Ladder constants ─────────────────────────────────────────────────────────
export const RUNG_ANSWER = 3;        // terminal rung: state the answer
export const MASTERY_THRESHOLD = 0.7; // objective considered mastered -> advance
export const CONFIDENCE_FLOOR = 0.25; // frustration accelerator threshold

// What the analyzer emits after each student message.
// Defined as a Zod schema so `generateObject` validates + coerces the model's
// output against it (and retries on mismatch) — no hand-rolled JSON parsing.
// Ranges are documented but NOT hard-enforced here: a model returning 1.2 for
// confidence shouldn't fail the whole turn — we clamp when folding it in.
export const AnalyzerSchema = z.object({
  /**
   * True only if the student's latest message is a genuine attempt to answer or
   * reason about the concept. False for meta requests ("reply in English"),
   * greetings, or off-topic text — those carry no evidence and must NOT move the
   * learner model. Gated in applyAnalysis so non-answers can't pollute state.
   */
  assessable: z.boolean(),
  /** Objective id the student's message engaged; "" if meta/off-topic/none. */
  addressedObjective: z.string(),
  /** Support signal relative to the focus objective; drives the ladder. */
  scaffoldSignal: z.enum(["stuck", "progressing", "solved"]),
  /** Did the student explicitly ask to be told the answer? */
  requestedAnswer: z.boolean(),
  /** objectiveId -> signed delta, small (roughly ±0.05..±0.15). */
  masteryDeltas: z.record(z.string(), z.number()),
  detectedMisconceptions: z.array(z.string()),
  resolvedMisconceptions: z.array(z.string()),
  /** Fresh estimate of learner confidence in [0,1]. */
  confidence: z.number(),
  reasoning: z.string(),
});

export type AnalyzerResult = z.infer<typeof AnalyzerSchema>;

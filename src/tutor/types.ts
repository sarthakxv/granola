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
  /** Assessable on-topic turns spent on the current focus objective (backstop counter). */
  turnsOnObjective: number;
  /** True once every objective's mastery is at or above MASTERY_THRESHOLD. */
  lessonComplete: boolean;
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
    turnsOnObjective: 0,
    lessonComplete: false,
  };
}

// ── Ladder constants ─────────────────────────────────────────────────────────
export const RUNG_ANSWER = 3;        // terminal rung: state the answer
export const MASTERY_THRESHOLD = 0.7; // objective considered mastered -> advance
export const CONFIDENCE_FLOOR = 0.25; // frustration accelerator threshold
export const MAX_TURNS_ON_OBJECTIVE = 5;  // #3a: after N turns on one objective, force the answer
export const STRUGGLE_THRESHOLD = 2;     // #3b: if N objectives needed answer reveals, start new ones higher
export const STRUGGLE_START_RUNG = 1;    // #3b: skip bare-question phase, go to hint

// What the analyzer emits after each student message.
// Defined as a Zod schema so `generateObject` validates + coerces the model's
// output against it (and retries on mismatch) — no hand-rolled JSON parsing.
// Ranges are documented but NOT hard-enforced here: a model returning 1.2 for
// confidence shouldn't fail the whole turn — we clamp when folding it in.
export const AnalyzerSchema = z.object({
  /**
   * True if the message is ON-TOPIC — engaging the concept in any way, INCLUDING
   * wrong attempts and on-topic "I don't know / I'm stuck" (a stuck ladder signal,
   * not a disqualifier). False ONLY for meta ("reply in English") / greetings /
   * off-topic text, which must NOT move the learner model. Gated in applyAnalysis.
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

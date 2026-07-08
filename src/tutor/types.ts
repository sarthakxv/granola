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
}

export function emptyLearnerModel(): LearnerModel {
  return {
    masteryByObjective: {},
    activeMisconceptions: [],
    confidence: 0.3,
    turnCount: 0,
  };
}

// What the analyzer emits after each student message.
// Defined as a Zod schema so `generateObject` validates + coerces the model's
// output against it (and retries on mismatch) — no hand-rolled JSON parsing.
// Ranges are documented but NOT hard-enforced here: a model returning 1.2 for
// confidence shouldn't fail the whole turn — we clamp when folding it in.
export const AnalyzerSchema = z.object({
  /** objectiveId -> signed delta, roughly [-0.3, +0.3]. */
  masteryDeltas: z.record(z.string(), z.number()),
  detectedMisconceptions: z.array(z.string()),
  resolvedMisconceptions: z.array(z.string()),
  /** Fresh estimate of learner confidence in [0,1]. */
  confidence: z.number(),
  reasoning: z.string(),
});

export type AnalyzerResult = z.infer<typeof AnalyzerSchema>;

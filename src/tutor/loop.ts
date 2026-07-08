import { generateText, Output, type LanguageModel } from "ai";
import type { ChatMessage } from "../llm/types.ts";
import type { Concept } from "../concept/photosynthesis.ts";
import { AnalyzerSchema, type AnalyzerResult, type LearnerModel } from "./types.ts";
import { buildAnalyzerSystem, buildTutorSystem } from "./prompts.ts";

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

// Generate the tutor's next Socratic move, adapted to the current learner model.
export async function tutorTurn(
  llm: LanguageModel,
  concept: Concept,
  model: LearnerModel,
  history: ChatMessage[],
): Promise<string> {
  const { text, finishReason } = await generateText({
    model: llm,
    system: buildTutorSystem(concept, model),
    messages: history,
    temperature: 0.7,
    // DeepSeek is a reasoning model: chain-of-thought counts against this
    // budget even though it's excluded from `text`. A tight cap (e.g. 300)
    // gets fully consumed by reasoning and truncates before any answer is
    // emitted, yielding empty text. Leave headroom for reasoning + the reply;
    // the "1–3 short sentences" limit is enforced by the prompt, not this.
    maxOutputTokens: 2048,
  });
  const reply = text.trim();
  // Fail loud rather than pushing a blank tutor message into the history — an
  // empty reply almost always means reasoning ate the token budget (finishReason
  // "length"). Silent blanks are the worst failure for our single core output.
  if (!reply) {
    throw new Error(
      `Tutor produced empty text (finishReason=${finishReason}) — likely maxOutputTokens too low for this model's reasoning.`,
    );
  }
  return reply;
}

// Analyze the student's latest message into a structured mastery/misconception
// update. `Output.object` validates the model's output against AnalyzerSchema
// (retrying on mismatch), so we get a typed object with no manual JSON parsing.
export async function analyzeTurn(
  llm: LanguageModel,
  concept: Concept,
  history: ChatMessage[],
): Promise<AnalyzerResult> {
  const { output } = await generateText({
    model: llm,
    system: buildAnalyzerSystem(concept),
    messages: history,
    temperature: 0,
    output: Output.object({ schema: AnalyzerSchema }),
  });
  return output;
}

// Fold an analyzer result into the learner model (pure — returns a new model).
export function applyAnalysis(
  model: LearnerModel,
  result: AnalyzerResult,
): LearnerModel {
  // Non-substantive messages (meta requests like "reply in English", greetings,
  // off-topic text) carry no evidence about mastery. Ignore deltas, misconception
  // changes, and the confidence estimate entirely — just advance the turn. This
  // stops a non-answer from silently moving the learner model.
  if (!result.assessable) {
    return { ...model, turnCount: model.turnCount + 1 };
  }

  const mastery = { ...model.masteryByObjective };
  for (const [id, delta] of Object.entries(result.masteryDeltas)) {
    if (typeof delta !== "number") continue;
    mastery[id] = clamp((mastery[id] ?? 0) + delta);
  }

  const active = new Set(model.activeMisconceptions);
  for (const id of result.detectedMisconceptions) active.add(id);
  for (const id of result.resolvedMisconceptions) active.delete(id);

  return {
    masteryByObjective: mastery,
    activeMisconceptions: [...active],
    confidence: clamp(result.confidence),
    turnCount: model.turnCount + 1,
  };
}

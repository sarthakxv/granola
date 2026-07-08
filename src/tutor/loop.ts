import { generateText, Output, type LanguageModel } from "ai";
import type { ChatMessage } from "../llm/types.ts";
import type { Concept } from "../concept/photosynthesis.ts";
import {
  AnalyzerSchema, type AnalyzerResult, type LearnerModel,
  RUNG_ANSWER, MASTERY_THRESHOLD, CONFIDENCE_FLOOR,
} from "./types.ts";
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
    // budget even though it's excluded from `text`. A tight cap gets fully
    // consumed by reasoning and truncates before any answer is emitted, yielding
    // empty text (finishReason "length"). The scaffold prompt is long and the
    // history grows, so give generous headroom; the "1–3 short sentences" limit
    // is enforced by the prompt, not this.
    maxOutputTokens: 4096,
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
  focusObjective: string | null,
): Promise<AnalyzerResult> {
  const { output } = await generateText({
    model: llm,
    system: buildAnalyzerSystem(concept, focusObjective),
    messages: history,
    temperature: 0,
    output: Output.object({ schema: AnalyzerSchema }),
  });
  return output;
}

// Choose the next objective to work: lowest mastery below threshold, preferring
// one not already answer-revealed (so a freshly told objective isn't immediately
// re-probed — a lightweight retrieval re-check). Null when all are mastered.
export function pickNextFocus(
  mastery: Record<string, number>,
  concept: Concept,
  revealed: string[],
): string | null {
  const revealedSet = new Set(revealed);
  const below = concept.objectives
    .map((o) => ({ id: o.id, m: mastery[o.id] ?? 0 }))
    .filter((o) => o.m < MASTERY_THRESHOLD);
  if (below.length === 0) return null;
  const fresh = below.filter((o) => !revealedSet.has(o.id));
  const pool = fresh.length > 0 ? fresh : below;
  pool.sort((a, b) => a.m - b.m); // V8 sort is stable -> concept order breaks ties
  return pool[0].id;
}

// Fold an analyzer result into the learner model (pure — returns a new model).
export function applyAnalysis(
  model: LearnerModel,
  result: AnalyzerResult,
  concept: Concept,
): LearnerModel {
  const turnCount = model.turnCount + 1;

  // Non-substantive messages (meta, greetings, off-topic) carry no evidence.
  if (!result.assessable) {
    return { ...model, turnCount };
  }

  // Mastery + misconceptions + confidence — independent of the ladder.
  const mastery = { ...model.masteryByObjective };
  for (const [id, delta] of Object.entries(result.masteryDeltas)) {
    if (typeof delta !== "number") continue;
    mastery[id] = clamp((mastery[id] ?? 0) + delta);
  }
  const active = new Set(model.activeMisconceptions);
  for (const id of result.detectedMisconceptions) active.add(id);
  for (const id of result.resolvedMisconceptions) active.delete(id);
  const confidence = clamp(result.confidence);

  let rung = model.scaffoldRung;
  let stuck = model.consecutiveStuck;
  let focus = model.focusObjective;
  let revealed = model.answerRevealed;

  // Initialize focus at lesson start BEFORE the ladder update, so the first real
  // answer's scaffold signal isn't wiped by focus selection running afterwards.
  if (focus === null) {
    focus = pickNextFocus(mastery, concept, revealed);
  }

  if (rung === RUNG_ANSWER) {
    // The tutor delivered the answer last turn. Record it (do NOT auto-bump
    // mastery), advance to a fresh episode on the next objective.
    if (focus && !revealed.includes(focus)) revealed = [...revealed, focus];
    focus = pickNextFocus(mastery, concept, revealed);
    rung = 0;
    stuck = 0;
  } else {
    const offTopic =
      result.addressedObjective !== "" && result.addressedObjective !== focus;
    if (!offTopic) {
      if (result.requestedAnswer && stuck >= 1) {
        rung = RUNG_ANSWER; // explicit ask, only after >=1 post-support attempt
      } else if (result.scaffoldSignal === "stuck") {
        stuck += 1;
        rung = Math.min(rung + 1, RUNG_ANSWER);
        if (confidence < CONFIDENCE_FLOOR && stuck >= 2) rung = RUNG_ANSWER;
      } else if (result.scaffoldSignal === "progressing") {
        rung = Math.max(rung - 1, 0); // decay, not reset
        stuck = 0;
      } else if (result.scaffoldSignal === "solved") {
        focus = pickNextFocus(mastery, concept, revealed);
        rung = 0;
        stuck = 0;
      }
    }
    // offTopic -> neutral: leave rung/stuck/focus unchanged.
  }

  // Advance to a fresh episode once the current objective is mastered.
  if (focus !== null && (mastery[focus] ?? 0) >= MASTERY_THRESHOLD) {
    focus = pickNextFocus(mastery, concept, revealed);
    rung = 0;
    stuck = 0;
  }

  return {
    masteryByObjective: mastery,
    activeMisconceptions: [...active],
    confidence,
    turnCount,
    focusObjective: focus,
    scaffoldRung: rung,
    consecutiveStuck: stuck,
    answerRevealed: revealed,
  };
}

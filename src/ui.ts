import type { Concept } from "./concept/photosynthesis.ts";
import type { LearnerModel } from "./tutor/types.ts";

// Renders the learner model as a compact panel so we can watch mastery move.
// In the real app this data drives the mastery dashboard.
export function renderPanel(concept: Concept, model: LearnerModel): string {
  const bar = (v: number) => {
    const filled = Math.round(v * 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
  };
  const lines = concept.objectives.map((o) => {
    const m = model.masteryByObjective[o.id];
    const val = m === undefined ? "  · unknown" : `${bar(m)} ${String(Math.round(m * 100)).padStart(3)}%`;
    return `  ${o.title.padEnd(38)} ${val}`;
  });
  const mc = model.activeMisconceptions.length
    ? model.activeMisconceptions.join(", ")
    : "none";
  return [
    "┌─ learner model " + "─".repeat(46),
    ...lines,
    "  " + "-".repeat(52),
    `  confidence: ${Math.round(model.confidence * 100)}%   active misconceptions: ${mc}`,
    "└" + "─".repeat(61),
  ].join("\n");
}

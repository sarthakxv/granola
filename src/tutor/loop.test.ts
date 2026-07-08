import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnalysis } from "./loop.ts";
import { emptyLearnerModel, type AnalyzerResult } from "./types.ts";

// Minimal analyzer result builder — override only what a test cares about.
function result(over: Partial<AnalyzerResult> = {}): AnalyzerResult {
  return {
    assessable: true,
    masteryDeltas: {},
    detectedMisconceptions: [],
    resolvedMisconceptions: [],
    confidence: 0.5,
    reasoning: "",
    ...over,
  };
}

test("assessable result folds in deltas, misconceptions, and confidence", () => {
  const before = emptyLearnerModel();
  const after = applyAnalysis(
    before,
    result({
      masteryDeltas: { inputs: 0.15 },
      detectedMisconceptions: ["soil_food"],
      confidence: 0.6,
    }),
  );
  assert.equal(after.masteryByObjective.inputs, 0.15);
  assert.deepEqual(after.activeMisconceptions, ["soil_food"]);
  assert.equal(after.confidence, 0.6);
  assert.equal(after.turnCount, 1);
});

test("non-assessable (meta) message does NOT move the model — only turnCount", () => {
  // Reproduces the transcript bug: "please only give output in english" bumped
  // confidence 30%->50%. A non-answer must leave mastery/confidence/misconceptions
  // untouched.
  const before = {
    masteryByObjective: { inputs: 0.2 },
    activeMisconceptions: ["soil_food"],
    confidence: 0.3,
    turnCount: 4,
  };
  const after = applyAnalysis(
    before,
    // Even if the analyzer hallucinates deltas/confidence, they must be ignored.
    result({ assessable: false, masteryDeltas: { inputs: 0.3 }, confidence: 0.5 }),
  );
  assert.deepEqual(after.masteryByObjective, { inputs: 0.2 });
  assert.deepEqual(after.activeMisconceptions, ["soil_food"]);
  assert.equal(after.confidence, 0.3);
  assert.equal(after.turnCount, 5);
});

test("mastery deltas are clamped to [0,1]", () => {
  const before = { ...emptyLearnerModel(), masteryByObjective: { inputs: 0.9 } };
  const up = applyAnalysis(before, result({ masteryDeltas: { inputs: 0.5 } }));
  assert.equal(up.masteryByObjective.inputs, 1);
  const down = applyAnalysis(before, result({ masteryDeltas: { inputs: -2 } }));
  assert.equal(down.masteryByObjective.inputs, 0);
});

test("resolved misconceptions are removed from the active set", () => {
  const before = { ...emptyLearnerModel(), activeMisconceptions: ["soil_food"] };
  const after = applyAnalysis(before, result({ resolvedMisconceptions: ["soil_food"] }));
  assert.deepEqual(after.activeMisconceptions, []);
});

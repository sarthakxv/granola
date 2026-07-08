import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnalysis, pickNextFocus } from "./loop.ts";
import { emptyLearnerModel, MASTERY_THRESHOLD, type AnalyzerResult, type LearnerModel } from "./types.ts";
import { PHOTOSYNTHESIS } from "../concept/photosynthesis.ts";

const C = PHOTOSYNTHESIS; // objective ids: purpose, inputs, outputs, location, transformation, significance

function result(over: Partial<AnalyzerResult> = {}): AnalyzerResult {
  return {
    assessable: true,
    addressedObjective: "",
    scaffoldSignal: "progressing",
    requestedAnswer: false,
    masteryDeltas: {},
    detectedMisconceptions: [],
    resolvedMisconceptions: [],
    confidence: 0.5,
    reasoning: "",
    ...over,
  };
}

function model(over: Partial<LearnerModel> = {}): LearnerModel {
  return { ...emptyLearnerModel(), ...over };
}

test("assessable=false only advances turnCount, nothing else moves", () => {
  const before = model({
    masteryByObjective: { inputs: 0.2 }, activeMisconceptions: ["soil_food"],
    confidence: 0.3, turnCount: 4, focusObjective: "inputs", scaffoldRung: 2, consecutiveStuck: 2,
  });
  const after = applyAnalysis(before, result({ assessable: false, masteryDeltas: { inputs: 0.3 } }), C);
  assert.deepEqual(after.masteryByObjective, { inputs: 0.2 });
  assert.equal(after.confidence, 0.3);
  assert.equal(after.focusObjective, "inputs");
  assert.equal(after.scaffoldRung, 2);
  assert.equal(after.consecutiveStuck, 2);
  assert.equal(after.turnCount, 5);
});

test("assessable=true folds deltas, misconceptions, confidence", () => {
  const after = applyAnalysis(
    emptyLearnerModel(),
    result({ masteryDeltas: { inputs: 0.15 }, detectedMisconceptions: ["soil_food"], confidence: 0.6 }),
    C,
  );
  assert.equal(after.masteryByObjective.inputs, 0.15);
  assert.deepEqual(after.activeMisconceptions, ["soil_food"]);
  assert.equal(after.confidence, 0.6);
});

test("mastery deltas clamp to [0,1]", () => {
  const up = applyAnalysis(model({ masteryByObjective: { inputs: 0.9 } }), result({ masteryDeltas: { inputs: 0.5 } }), C);
  assert.equal(up.masteryByObjective.inputs, 1);
  const down = applyAnalysis(model({ masteryByObjective: { inputs: 0.9 } }), result({ masteryDeltas: { inputs: -2 } }), C);
  assert.equal(down.masteryByObjective.inputs, 0);
});

test("resolved misconception removed from active set", () => {
  const after = applyAnalysis(model({ activeMisconceptions: ["soil_food"] }), result({ resolvedMisconceptions: ["soil_food"] }), C);
  assert.deepEqual(after.activeMisconceptions, []);
});

test("null focus is initialized to the lowest-mastery objective", () => {
  const after = applyAnalysis(emptyLearnerModel(), result({ scaffoldSignal: "progressing" }), C);
  assert.equal(after.focusObjective, "purpose"); // all mastery 0 -> first objective
});

test("first stuck answer at lesson start escalates (focus init before ladder)", () => {
  const after = applyAnalysis(
    emptyLearnerModel(),
    result({ scaffoldSignal: "stuck", addressedObjective: "", confidence: 0.8 }),
    C,
  );
  assert.equal(after.focusObjective, "purpose"); // focus gets initialized
  assert.equal(after.scaffoldRung, 1); // and the stuck signal is NOT wiped by that init
  assert.equal(after.consecutiveStuck, 1);
});

test("stuck increments rung and consecutiveStuck", () => {
  const before = model({ focusObjective: "inputs", scaffoldRung: 0, consecutiveStuck: 0 });
  const after = applyAnalysis(before, result({ addressedObjective: "inputs", scaffoldSignal: "stuck", confidence: 0.8 }), C);
  assert.equal(after.scaffoldRung, 1);
  assert.equal(after.consecutiveStuck, 1);
});

test("progressing decays rung by 1 (not to 0) and zeroes consecutiveStuck", () => {
  const before = model({ focusObjective: "inputs", scaffoldRung: 2, consecutiveStuck: 2 });
  const after = applyAnalysis(before, result({ addressedObjective: "inputs", scaffoldSignal: "progressing" }), C);
  assert.equal(after.scaffoldRung, 1);
  assert.equal(after.consecutiveStuck, 0);
});

test("requestedAnswer jumps to L3 ONLY after >=1 post-support attempt", () => {
  const yes = applyAnalysis(
    model({ focusObjective: "inputs", scaffoldRung: 1, consecutiveStuck: 1 }),
    result({ addressedObjective: "inputs", scaffoldSignal: "stuck", requestedAnswer: true, confidence: 0.8 }), C);
  assert.equal(yes.scaffoldRung, 3);

  const no = applyAnalysis(
    model({ focusObjective: "inputs", scaffoldRung: 0, consecutiveStuck: 0 }),
    result({ addressedObjective: "inputs", scaffoldSignal: "stuck", requestedAnswer: true, confidence: 0.8 }), C);
  assert.equal(no.scaffoldRung, 1); // hint, not an instant answer
});

test("frustration accelerator: low confidence + >=2 stalls jumps to L3", () => {
  const before = model({ focusObjective: "inputs", scaffoldRung: 0, consecutiveStuck: 1 });
  const after = applyAnalysis(before, result({ addressedObjective: "inputs", scaffoldSignal: "stuck", confidence: 0.1 }), C);
  assert.equal(after.consecutiveStuck, 2);
  assert.equal(after.scaffoldRung, 3);
});

test("off-topic answer is neutral for the ladder", () => {
  const before = model({ focusObjective: "inputs", scaffoldRung: 1, consecutiveStuck: 1 });
  const after = applyAnalysis(before, result({ addressedObjective: "outputs", scaffoldSignal: "stuck" }), C);
  assert.equal(after.scaffoldRung, 1);
  assert.equal(after.consecutiveStuck, 1);
  assert.equal(after.focusObjective, "inputs");
});

test("solved advances focus once the objective crosses the mastery threshold", () => {
  const before = model({ focusObjective: "purpose", masteryByObjective: { purpose: 0.65 } });
  const after = applyAnalysis(before, result({ addressedObjective: "purpose", scaffoldSignal: "solved", masteryDeltas: { purpose: 0.1 } }), C);
  assert.ok(after.masteryByObjective.purpose >= MASTERY_THRESHOLD);
  assert.equal(after.focusObjective, "inputs"); // purpose now mastered -> next lowest
  assert.equal(after.scaffoldRung, 0);
  assert.equal(after.consecutiveStuck, 0);
});

test("terminal: prior rung 3 records the reveal, advances focus, resets, no mastery bump", () => {
  const before = model({ focusObjective: "inputs", scaffoldRung: 3, masteryByObjective: { inputs: 0.2 }, answerRevealed: [] });
  const after = applyAnalysis(before, result({ addressedObjective: "inputs", scaffoldSignal: "progressing", masteryDeltas: {} }), C);
  assert.deepEqual(after.answerRevealed, ["inputs"]);
  assert.notEqual(after.focusObjective, "inputs"); // advanced past the revealed one
  assert.equal(after.scaffoldRung, 0);
  assert.equal(after.consecutiveStuck, 0);
  assert.equal(after.masteryByObjective.inputs, 0.2); // not bumped by the reveal
});

test("pickNextFocus: lowest mastery, skips revealed, null when all mastered", () => {
  assert.equal(pickNextFocus({}, C, []), "purpose");
  assert.equal(pickNextFocus({ purpose: 0.8 }, C, []), "inputs");
  assert.equal(pickNextFocus({}, C, ["purpose"]), "inputs");
  const allMastered = Object.fromEntries(C.objectives.map((o) => [o.id, 0.9]));
  assert.equal(pickNextFocus(allMastered, C, []), null);
});

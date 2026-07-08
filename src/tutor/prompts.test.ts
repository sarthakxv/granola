import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTutorSystem, buildAnalyzerSystem } from "./prompts.ts";
import { emptyLearnerModel } from "./types.ts";
import { PHOTOSYNTHESIS, type Concept } from "../concept/photosynthesis.ts";

test("tutor prompt injects the ladder level and focus objective title", () => {
  const model = { ...emptyLearnerModel(), focusObjective: "inputs", scaffoldRung: 2 };
  const p = buildTutorSystem(PHOTOSYNTHESIS, model);
  assert.match(p, /LADDER STATE/);
  assert.match(p, /scaffold level 2/);
  assert.match(p, /Inputs: carbon dioxide, water, light/); // focus objective title
  assert.match(p, /LESSON ARC/);
  assert.match(p, /FACTS vs IDEAS/);
  assert.match(p, /LANGUAGE: Respond only in English/);
  assert.match(p, /MISCONCEPTION CLOSE/);
});

test("tutor prompt with null focus gives the Predict opening, no rung", () => {
  const p = buildTutorSystem(PHOTOSYNTHESIS, emptyLearnerModel());
  assert.match(p, /PREDICTION|lesson is just starting/i);
});

test("tutor prompt honors concept.targetLanguage override", () => {
  const hindi: Concept = { ...PHOTOSYNTHESIS, targetLanguage: "Hindi" };
  const p = buildTutorSystem(hindi, { ...emptyLearnerModel(), focusObjective: "inputs", scaffoldRung: 0 });
  assert.match(p, /LANGUAGE: Respond only in Hindi/);
});

test("analyzer prompt asks for the new signals and attribution rule", () => {
  const p = buildAnalyzerSystem(PHOTOSYNTHESIS, "inputs");
  assert.match(p, /scaffoldSignal/);
  assert.match(p, /addressedObjective/);
  assert.match(p, /requestedAnswer/);
  assert.match(p, /working the objective "inputs"/);
  assert.match(p, /Do NOT credit/i);
});

test("analyzer prompt handles a null focus at lesson start", () => {
  const p = buildAnalyzerSystem(PHOTOSYNTHESIS, null);
  assert.match(p, /just starting/i);
});

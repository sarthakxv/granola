# bugs

- [ ] fix 1 — replace the single confidence scalar with ACRE (your idea, formalized) per student turn, analyzer emits four decoupled fields plus meta:
  ```
    json{
      "answer":     { "claim": "<paraphrase>", "correctness": -1.0 },  // -1..1, wrongness→rightness
      "confidence": 0.3,   // student's epistemic stance from hedging — NOT system confidence
      "reasoning":  0.0,   // did they give a mechanism / a "because" chain? 0..1
      "evidence":   0.0,   // did they ground it in an observation/example? 0..1
      "masteryDeltas": { "water_in": 0.15 },   // per ATOMIC objective only, clamp ±0.3
      "detected": [], "resolved": ["soil_food"],
      "scaffoldSignal": "progressing",         // "stuck" | "progressing" | "solved" → drives the ladder
      "systemConfidence": 0.8,                 // analyzer's confidence in ITS OWN read (meta, separate)
      "note": "one sentence"
    }
  ```
  - why this is the right move: the interesting pedagogical quadrant is confident-and-wrong vs right-but-unsure — the single scalar literally cannot represent it. ACRE can. correctness and confidence being orthogonal is the whole point ("track correctness, not right/wrong" — this is how).
- [ ] fix 2 — the two loops are orthogonal; encode them as passed-in state, not vibes
  you've drawn two different diagrams and they operate at different scales. don't conflate them:
  
  - struggle ladder (Question→Hint→Example→Analogy→…→Answer→Reflection) = micro, how you escalate scaffolding within one stuck moment.
  - POEGA (Predict→Observe→Explain→Generalize→Apply) = macro, the arc of the whole lesson. its "Explain" phase is where the struggle ladder runs.
  
  right now your tutor prompt encodes neither as state, so the model can't systematically escalate — it just picks a move each turn. give it a counter, the same way you already pass mastery:
  
  - pass scaffoldLevel per active objective. analyzer's scaffoldSignal: "stuck" increments it.
  - tutor prompt gets a rung table: "you are at rung {scaffoldLevel} for this objective; make that rung's move only."
  - terminal rung must give the answer. your current HARD RULE ("Never give a direct, complete answer") directly contradicts your own ladder, which ends in Answer→Reflection. this is the same never-answer/frustration collision from the sky+photosynthesis runs. encode the exception explicitly: "at rung=Answer (ladder exhausted, or ≥2 stalls after a hint, or explicit request post-struggle): state it plainly, then ask one reflection question." otherwise the hard rule wins and the kid loops — which is exactly what soil_food did.
  
  Predict is your cheapest, highest-value missing piece. the photosynthesis log has zero prediction — it's pure Q&A. adding a commit-first step ("before we work it out — what do you think happens to the water a plant drinks?") (a) generates commitment, (b) makes misconceptions fall out where your analyzer can catch them, (c) gives you a prediction-accuracy signal you don't currently collect. add it.


fix 3 — the thinking dimensions (the hard part; this is where the product lives or dies)
  Curiosity/Observation/Logical Reasoning/Abstraction/Systems Thinking are latent constructs measured from text. that is a validity problem, not a prompting problem. three things will sink this if unaddressed:
  a. false precision. "Systems Thinking = 18" off a few sessions implies a measurement you don't have. a parent will over-read it. use bands (emerging / developing / strong) until you have enough per-child data to justify integers. an integer that jitters like your mastery bars did (70→30 in one turn) destroys trust in the whole panel.
  b. attribution. if the tutor spoon-feeds the reasoning, the kid's next turn contains the tutor's reasoning. never credit a dimension for reasoning the tutor just supplied. scoring "most recent message only" helps but isn't sufficient — the analyzer needs the prior tutor turn to check whether the student originated the move or echoed it.
  c. operationalization. each dimension needs a concrete evidence rubric or the analyzer invents numbers. the useful realization: your per-turn ACRE fields + interaction events already are the dimension signals — you don't need a separate guess:
  
  ```text
  Curiosity = count of student-initiated "why/what-if/wonder" turns. measurable without an LLM judgment at all.
  Observation = the ACRE evidence field, aggregated.
  Logical Reasoning = the ACRE reasoning field (valid because-chains).
  Abstraction = success at the POEGA Generalize step (instance→rule).
  Systems Thinking = success at Apply + any multi-variable / feedback reasoning.
  ```
  
  that also cleanly maps POEGA stages to dimensions (Predict→hypothesis quality, Explain→Reasoning, Generalize→Abstraction, Apply→Systems). aggregate per-turn signals into per-child dimensions with an EWMA so one bad session doesn't swing the profile. this is the synthesis of your two ideas and it makes the dimensions derived and auditable rather than vibes.
  
fix 4 — finetuning is premature; sequence it last
  concrete reasons, in order: your tutor model can't hold a language lock or the never-answer constraint consistently, and your analyzer can't emit reliable JSON. finetuning on top of an unmeasured baseline means you can't tell if a finetune helped. and you have no labeled dataset of "good tutor turns" yet. sequence:

1. lock language + move analyzer to a structured-output model. (instrument reliability)
2. ship ACRE + atomic objectives + scaffold-state + Predict. (design correctness)
3. run sessions, log transcripts + the analyzer's per-turn ACRE, hand-label a few hundred "good/bad tutor turn" and "correct/incorrect analyzer read" examples. (dataset)
4. then distill or finetune — most likely the tutor first (for constraint-following and warmth at small size), analyzer second. the analyzer is a better distillation target (structured, verifiable) but only once your rubric is stable.

## drop-in deltas

tutor prompt — add:

```text
  LADDER STATE: You are at scaffold rung {scaffoldLevel} for the current objective. Make only that rung's move:
  0 Question · 1 Hint · 2 Worked example · 3 Analogy (then re-question) · 4 Concrete hint doing most of the work · 5 Answer.
  At rung 5 (ladder exhausted, ≥2 stalls after a hint, or an explicit ask post-struggle): state the answer plainly in one sentence, then ask ONE reflection question. This overrides "never give a direct answer" — the ladder terminates in the answer by design.
  
  LESSON ARC: Predict → Observe → Explain → Generalize → Apply. Open with a prediction the student commits to before reasoning. The Explain phase is where the ladder runs.
  
  FACTS vs IDEAS: Supply names, labels, and vocabulary directly (e.g. "carbon dioxide", "glucose"). Only withhold the underlying idea for the student to reason toward. Never try to make a student *derive* a proper noun.
  
  LANGUAGE: Respond only in {targetLanguage}. Never switch scripts.
  
  MISCONCEPTION CLOSE: If a misconception is active, you must surface it before the session ends — pose the observation that puts it in conflict with what the student now believes. Do not route around it.
```
  
  analyzer prompt — replace the single confidence with the ACRE block above, add scaffoldSignal and systemConfidence, score only atomic objectives, and add:
  text- Do NOT credit reasoning/evidence the tutor supplied in the previous turn; only score what the student originated.
  - Misconceptions are expensive to add: only tag when the message positively evidences the specific misconception, not merely a wrong guess. Prefer resolving over persisting.

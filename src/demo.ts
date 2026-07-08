// Scripted, non-interactive demo of the CLS loop.
// A simulated student starts with the classic "plants eat soil" misconception
// and is walked toward understanding. Watch the learner-model panel move and
// the misconception clear — that's the whole thesis of the product working.

import { getModel, modelLabel } from "./llm/index.ts";
import type { ChatMessage } from "./llm/types.ts";
import { PHOTOSYNTHESIS } from "./concept/photosynthesis.ts";
import { emptyLearnerModel } from "./tutor/types.ts";
import { analyzeTurn, applyAnalysis, tutorTurn } from "./tutor/loop.ts";
import { renderPanel } from "./ui.ts";

// A deliberately imperfect student: wrong at first, then gradually gets it.
const STUDENT_TURNS = [
  "Plants get their food from the soil through their roots, I think.",
  "Hmm, but the soil around a plant doesn't really disappear as it grows...",
  "Oh. So maybe they take something from the air? Like the air we breathe out?",
  "Carbon dioxide! And they need sunlight too, and water from the roots.",
  "They make sugar, glucose. And I think they let out oxygen for us to breathe.",
  "It happens in the leaves — the green stuff, chlorophyll, catches the light.",
];

async function main() {
  const llm = getModel();
  const concept = PHOTOSYNTHESIS;
  let model = emptyLearnerModel();
  const history: ChatMessage[] = [];

  console.log(`\n=== CLS prototype — concept: ${concept.title} ===`);
  console.log(`provider: ${modelLabel()}\n`);

  // Opening diagnostic probe (no student input yet).
  const opening = await tutorTurn(llm, concept, model, [
    { role: "user", content: "I'm ready to learn about photosynthesis." },
  ]);
  history.push({ role: "user", content: "I'm ready to learn about photosynthesis." });
  history.push({ role: "assistant", content: opening });
  console.log(`TUTOR: ${opening}\n`);

  for (const studentText of STUDENT_TURNS) {
    console.log(`STUDENT: ${studentText}`);
    history.push({ role: "user", content: studentText });

    // 1) Analyze the student's answer → update the learner model.
    const analysis = await analyzeTurn(llm, concept, history);
    model = applyAnalysis(model, analysis, concept);

    // 2) Tutor responds, adapted to the freshly-updated model.
    const reply = await tutorTurn(llm, concept, model, history);
    history.push({ role: "assistant", content: reply });

    console.log(`  ↳ analysis: ${analysis.reasoning}`);
    console.log(`TUTOR: ${reply}\n`);
    console.log(renderPanel(concept, model) + "\n");

    // Small courtesy gap between turns (OpenCode go has generous limits).
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("=== end of scripted demo ===\n");
}

main().catch((err) => {
  console.error("Demo failed:", err.message ?? err);
  process.exit(1);
});

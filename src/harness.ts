// Interactive CLI: talk to the CLS tutor yourself.
//   npm run chat
// Commands:  /state  → dump learner model    /quit → exit

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { getAnalyzerModel, getTutorModel, modelLabel } from "./llm/index.ts";
import type { ChatMessage } from "./llm/types.ts";
import { PHOTOSYNTHESIS } from "./concept/photosynthesis.ts";
import { emptyLearnerModel } from "./tutor/types.ts";
import { analyzeTurn, applyAnalysis, tutorTurn } from "./tutor/loop.ts";
import { renderPanel } from "./ui.ts";

// Show a live "thinking" indicator so a slow/rate-limited call never looks frozen.
async function withSpinner<T>(label: string, work: Promise<T>): Promise<T> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const timer = setInterval(() => {
    stdout.write(`\r${frames[i++ % frames.length]} ${label}`);
  }, 90);
  try {
    return await work;
  } finally {
    clearInterval(timer);
    stdout.write("\r\x1b[K"); // clear the spinner line
  }
}

async function main() {
  const tutorModel = getTutorModel();
  const analyzerModel = getAnalyzerModel();
  const concept = PHOTOSYNTHESIS;
  let model = emptyLearnerModel();
  const history: ChatMessage[] = [];
  const rl = createInterface({ input: stdin, output: stdout });

  console.log(`\n=== CLS — let's understand ${concept.title} ===`);
  console.log(`(provider: ${modelLabel()} · type /state or /quit)\n`);

  const seed = "I'm ready to learn about photosynthesis.";
  history.push({ role: "user", content: seed });
  const opening = await withSpinner(
    "tutor is thinking…",
    tutorTurn(tutorModel, concept, model, history),
  );
  history.push({ role: "assistant", content: opening });
  console.log(`TUTOR: ${opening}\n`);

  while (true) {
    let input: string;
    try {
      input = (await rl.question("you › ")).trim();
    } catch {
      break; // stdin closed (Ctrl-D / EOF / piped input) — exit cleanly
    }
    if (!input) continue;
    if (input === "/quit") break;
    if (input === "/state") {
      console.log("\n" + renderPanel(concept, model) + "\n");
      continue;
    }

    history.push({ role: "user", content: input });
    const analysis = await withSpinner(
      "assessing your answer…",
      analyzeTurn(analyzerModel, concept, history, model.focusObjective),
    );
    model = applyAnalysis(model, analysis, concept);
    const reply = await withSpinner(
      "tutor is thinking…",
      tutorTurn(tutorModel, concept, model, history),
    );
    history.push({ role: "assistant", content: reply });
    console.log(`\nTUTOR: ${reply}\n`);
    console.log(renderPanel(concept, model) + "\n");
    if (model.lessonComplete) {
      console.log("=== lesson complete — closing session ===\n");
      break;
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Chat failed:", err.message ?? err);
  process.exit(1);
});

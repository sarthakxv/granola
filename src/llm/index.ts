import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// ── The provider registry ────────────────────────────────────────────────────
// The ONLY place that knows which vendor we talk to. Everything downstream
// (tutor + analyzer) sees an opaque `LanguageModel`. Swap backends by editing
// this file alone — e.g. `import { anthropic } from "@ai-sdk/anthropic"`
// and returning `anthropic("claude-...")`. That's the whole abstraction.
//
// Default backend: OpenCode "go" — a cheap, OpenAI-compatible gateway to
// curated open models (DeepSeek, GLM, Kimi, Qwen…). It's just an authenticated
// HTTPS endpoint, so it runs identically on a laptop and on Vercel serverless.
//
// Tutor and analyzer get different models: the tutor has to hold the Socratic
// line under an instruction-following-heavy system prompt, so it gets the
// stronger/pricier model. The analyzer only scores structured JSON against a
// fixed schema, so a fast/cheap model is enough.

// The gateway doesn't support JSON-schema `response_format`, so the AI SDK logs
// a warning on every analyzer call. The fallback works (validated), but the
// warning leaks into the interactive chat UI. Silence it here. Remove this if we
// move to a model with native structured-output support.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const TUTOR_MODEL = process.env.OPENCODE_TUTOR_MODEL ?? "glm-5.2";
const ANALYZER_MODEL = process.env.OPENCODE_ANALYZER_MODEL ?? "deepseek-v4-flash";

function opencodeClient() {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No OPENCODE_API_KEY set. Add it to .env (subscribe at https://opencode.ai/docs/go/).",
    );
  }

  return createOpenAICompatible({
    name: "opencode-go",
    apiKey,
    baseURL: "https://opencode.ai/zen/go/v1",
  });
}

export function getTutorModel(): LanguageModel {
  return opencodeClient()(TUTOR_MODEL);
}

export function getAnalyzerModel(): LanguageModel {
  return opencodeClient()(ANALYZER_MODEL);
}

// Human-readable label for logs / the UI panel.
export function modelLabel(): string {
  return `opencode-go · tutor=${TUTOR_MODEL} · analyzer=${ANALYZER_MODEL}`;
}

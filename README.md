# CLS Prototype — Socratic tutor + analyzer loop

Proves the riskiest, highest-value part of CLS before any UI is built: an AI loop
that teaches **photosynthesis** by *never giving the answer*, while measuring real
mastery under the hood.

## The idea in one diagram

```
student message
      │
      ├─▶ ANALYZER call  ──▶ structured JSON ──▶ update Learner Model
      │   (assessment engine,                    (mastery per objective,
      │    reads last answer)                      misconceptions, confidence)
      │                                                    │
      └─▶ TUTOR call  ◀───────────── reads model ──────────┘
          (Socratic move, never
           a direct answer)  ──▶ next question to student
```

The nine "engines" in `docs/03_SYSTEM_ARCHITECTURE.md` collapse into **two LLM calls
per turn plus one piece of state** (the Learner Model). That is the core bet of the
product, and it runs here today.

## Run it

Needs Node ≥ 22 (native TypeScript type-stripping). Uses the **Vercel AI SDK**;
run `npm install` once. Set `OPENCODE_API_KEY` in `prototype/.env` (a cheap
OpenAI-compatible gateway — subscribe at https://opencode.ai/docs/go/).

```bash
cd prototype
npm install
npm run demo    # scripted student: starts wrong ("plants eat soil"), learns
npm run chat    # talk to the tutor yourself; /state shows the learner model
npx tsc --noEmit   # typecheck
```

The default model is `deepseek-v4-flash`; override with `OPENCODE_MODEL`
(see the gateway's `/v1/models`). Swapping to Anthropic/Google/OpenAI later is a
one-function edit in `src/llm/index.ts`.

## Layout (maps 1:1 onto the future Next.js `lib/`)

| File | Role | Future home |
|------|------|-------------|
| `src/llm/` | provider registry: `getModel()` returns a Vercel AI SDK model | `lib/llm/` |
| `src/concept/photosynthesis.ts` | concept graph: objectives + misconceptions | DB seed + `lib/concept/` |
| `src/tutor/prompts.ts` | Socratic tutor + analyzer system prompts | `lib/tutor/` |
| `src/tutor/loop.ts` | orchestration: `tutorTurn`, `analyzeTurn`, `applyAnalysis` | API route handlers |
| `src/tutor/types.ts` | `LearnerModel` shape | DB schema |
| `src/harness.ts` / `src/demo.ts` | CLI drivers | replaced by the chat UI |

## What this validates

- The tutor **withholds answers** and drives with questions (design principle #1).
- Misconceptions are **detected and cleared** as structured state, not vibes.
- The **learner model moves** turn to turn — the substrate for the mastery dashboard
  and the recall scheduler.
- Provider choice is **one function** (`getModel()`) — the tutor/analyzer never
  see a vendor. Validated live on OpenCode go / DeepSeek v4 flash.

## Next step toward the product

`docs/` build order: scaffold Next.js → move `src/` into `lib/` → wrap `loop.ts` in
an API route → build the single-page chat UI ("What do you want to learn today?" →
Photosynthesis card → chat) → persist the Learner Model in Supabase → mastery
dashboard → recall scheduler.

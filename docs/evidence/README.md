# Evidence: real Meta model calls

These files are unedited request/response pairs from real calls to Meta models, captured on 2026-10-31 and 2026-11-03. The `Authorization` header is replaced with `[REDACTED]`. Any other edit is named under the table.

| File | Model | Endpoint | Calls | Captured (UTC) |
|---|---|---|---|---|
| [`muse-spark-1.3-2026-10-31.json`](muse-spark-1.3-2026-10-31.json) | `muse-spark-1.3` | `https://api.meta.ai/v1/chat/completions` | 3, all HTTP 200 | 05:23:56 – 05:24:08 |
| [`muse-spark-open-2026-10-31.json`](muse-spark-open-2026-10-31.json) | `meta-models/muse-spark-open-1026` (Baseten) | `https://inference.baseten.co/v1/chat/completions` | 3, all HTTP 200 | 05:28:02 – 05:28:08 |
| [`sam-3.1-2026-11-03.json`](sam-3.1-2026-11-03.json) | `sam-3.1` | `https://api.meta.ai/v1/responses` | 1, HTTP 200 | 2026-11-03 13:36:36 |

**SAM 3.1 file.**
- **The request.** The image bytes are replaced with their size and SHA-256. The image is an illustrated room that `muse-image-1.0` drew for this test, not a photo of a real home. The body is the one [`buildSamBody`](../../web/src/consult/windows.js) builds.
- **The response.** It is unedited, mask payloads included. Ithaca reads only the boxes. `read_by_ithaca` shows what [`windowsSummary`](../../web/src/consult/windows.js) makes of it: 2 windows, 29.1 % of the photo inside their boxes.
- **A browser re-encode check.** The same photo re-encoded by the browser also got a 23 × 36 px box inside a window. Boxes under 0.5 % of the frame, or at least 90 % inside a larger box, are dropped. The card still says 2 windows.

## How the 2026-10-31 calls were captured

- **Path.** The product's own code path made the calls: `judgeHome` in [`web/src/judge/run.js`](../../web/src/judge/run.js) → `judgeSingle` → `complete` in [`web/src/judge/providers.js`](../../web/src/judge/providers.js).
- **Recording.** The capture passed a `fetchImpl` that records each request and response and then forwards it unchanged.
- **Scenario.** `scenarios/demo-two-homes.json`, home A: the household's first decisions in the run.
- **Settings.** `reasoning_effort: "low"`, `max_tokens: 2000`, structured output (`response_format: json_schema`).
- **What each call contains.**
  - The request: the decision prompt, which has only the context the engine computed (the member, the time of day, the options with their minutes and metres).
  - The response: the response `id`, `model`, `created`, the JSON choice with its reasons, and `usage`, including reasoning tokens.

## What the calls show

- **The model only chooses; the engine supplies every number.**
  - The prompt lists the options with the engine's minutes and metres. The model returns a `chosen_key` and short reasons.
  - [`web/src/judge/guards.js`](../../web/src/judge/guards.js) rejects a reply whose reason quotes a number that is not in the prompt.
- **Both models are asked the same thing.**
  - The same prompt goes to both models. Spark 1.3 picked `home` for the first decision and Spark Open picked `park`.
  - The full 154-decision comparison is in [`scenarios/decisions/compare-1029/`](../../scenarios/decisions/compare-1029/).

## What is not here

- **No fine-tuning.** Spark Open is served by Baseten as published; we did not fine-tune it.
- **No consult-chat transcripts.** The chat agent (`web/src/consult/agent.js`) uses the same provider module, through `completeWithTools`.
- **No customer data.** The household in these prompts is a synthetic scenario.

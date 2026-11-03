# Stage 60c1 — Muse Image illustrates one checked diary line: server side (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Why
Muse Image is not used anywhere. On request, it will draw a small illustration of one checked diary line. The illustration is decoration and is always labelled, so it can never pass for a photo of the real place. This part is the server only; the button comes in 60c2.

## Upstream, measured by the orchestrator on 2026-11-03 (same key as Muse Spark)
```
POST https://api.meta.ai/v1/images/generations   Authorization: Bearer <key>   content-type: application/json
{"model":"muse-image-1.0","prompt":"<text>","n":1,"size":"1024x1024"}
→ 200 (8 s) {"created":…, "data":[{"b64_json":"<base64>"}], "output_format":"webp", "background":"opaque",
             "usage":{"input_tokens":…, "output_tokens":…, "total_tokens":…}}
```
The returned bytes were WebP (`RIFF…WEBP`) at 1600×1600.

## Change

### 1. New `web/src/consult/diary-image.js`, modelled on `web/src/consult/voice.js` (read `voice.js:1-119` once)
- Constants:
  - `IMAGE_MODEL = "muse-image-1.0"`;
  - `IMAGE_URL = META_API_BASE + "/images/generations"`;
  - `IMAGE_SENTENCE_MAX = 200`;
  - `IMAGE_PROMPT_PREFIX = "Flat editorial illustration, soft muted colours, no text, no logos, no real addresses, no identifiable people: "`.
- `sceneSentence(text)`. It removes every whitespace-separated token that contains a digit, then the standalone tokens `Day`, `day` and `일째`, then collapses spaces and trims leading or trailing `,.:;·-` and spaces. Examples:
  - `"Day 16, walked home after sunset"` → `"walked home after sunset"`;
  - `"16일째 해 진 뒤 걸어서 귀가했어요"` → `"해 진 뒤 걸어서 귀가했어요"`.
  - The result never contains a digit.
- `imagePrompt(text)` = `IMAGE_PROMPT_PREFIX + sceneSentence(text)`.
- `createDiaryImageHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 45000 } = {})` → `async (req, res)`. Read a JSON body (≤ 4 KB) with `{ sentence, lang }`:

  | case | response |
  | --- | --- |
  | not POST | 405 `method` |
  | bad JSON, or `sentence` not a string | 400 `bad_request` |
  | `sentence` longer than `IMAGE_SENTENCE_MAX`, contains `http`, or `sceneSentence(sentence)` shorter than 3 characters | 400 `bad_sentence` |
  | no key (`metaApiKey(env)`) | 503 `no_key` |
  | fetch error, timeout (AbortController) or non-200 | 502 `upstream` with `status` (the number only) |
  | no `data[0].b64_json` | 502 `upstream` |

  - The upstream body is `{ model: IMAGE_MODEL, prompt: imagePrompt(sentence), n: 1, size: "1024x1024" }`.
  - Answer 200 `{ ok: true, model: IMAGE_MODEL, image: "data:image/" + (data.output_format || "webp") + ";base64," + b64 }`.
  - Never send the prompt or sentence back. Never store the image. Never log the key, prompt or bytes.

### 2. Relay route — `relay/handler.js`
- **Handler.** Next to `transcribeHandler` (`:232-237`), add `const diaryImageHandler = createDiaryImageHandler({ env, fetchImpl });` and buckets `img10`, `imgDay` and `imgGlobal`.
- **Route.** Add `if (path === "/api/image/diary") { … }` right after the voice route (`:359-392`) and copy its shape:
  - POST only;
  - **no judge branch**;
  - the limit is `Math.max(checkBucket(img10, client, t, 600000, 5), checkBucket(imgDay, client, t, DAY_MS, 20), checkGlobal(imgGlobal, t, DAY_MS, 100))`;
  - then `corsHeaders(res, cors); return diaryImageHandler(req, res);`. The handler reads its own body; if `req.body` is already parked, accept a string or Buffer there.
- **Imports.** Import `createDiaryImageHandler` from `../web/src/consult/diary-image.js`.

### 3. Dev server — `web/vite.config.js:258-259`
Mount `/api/image/diary` with `createDiaryImageHandler({ env: process.env })`, the same way as voice.

## Test — new `web/tests/diary-image-60c.test.js` (no network: inject `fetchImpl`)
- **`sceneSentence`:**
  - both examples above;
  - `/\d/.test(imagePrompt("Day 3, 12 min walk to 2 stores"))` is false.
- **Handler with a fake `fetchImpl`** that returns `{ status: 200, json: async () => ({ data: [{ b64_json: "UklGRg==" }], output_format: "webp" }) }`:
  - 200, and `image` starts with `data:image/webp;base64,`;
  - the captured upstream body has `model` `muse-image-1.0`, a `prompt` starting with the prefix, and no digits in it;
  - the captured header is `Bearer test-key` (`env: { META_API_KEY: "test-key" }`);
  - the response JSON has no `prompt` field.
- **Handler error cases:**
  - a 201-character sentence → 400 `bad_sentence`;
  - `"see http://x"` → 400;
  - `"12 34"` → 400 (nothing left after stripping);
  - no key → 503;
  - fetch throws → 502;
  - upstream 429 → 502 with `status` 429.
- **Relay** (use the way `web/tests/voice-29b.test.js` builds a relay request; read only that test's helper lines):
  - GET `/api/image/diary` → 405;
  - the 6th POST from one client inside 10 minutes → 429.

Run only: `cd web && node --test tests/diary-image-60c.test.js tests/voice-29b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`web/src/ui/*` (60c2), `web/src/consult/windows.js` (another stage), `web/src/engine/*`, `web/src/consult/guards.js`, `web/src/i18n/*`, other test files.

## Final message
Changed files, one line each.

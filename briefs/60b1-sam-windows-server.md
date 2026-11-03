# Stage 60b1 — SAM 3.1 finds windows in a room photo: server side (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Why
SAM 3.1 is listed as *coming soon* and no code calls it. The customer will be able to add a room photo to the listing check. SAM 3.1 finds the windows, and Ithaca shows a **photo cue**: never a measurement and never a pass. This part is the server only; the card comes in 60b2.

## Upstream, measured by the orchestrator on 2026-11-03 (same key as Muse Spark)
```
POST https://api.meta.ai/v1/responses          Authorization: Bearer <key>   content-type: application/json
{"model":"sam-3.1",
 "input":[{"type":"message","role":"user","content":[
    {"type":"input_text","text":"window"},
    {"type":"input_image","image_url":"data:image/jpeg;base64,<...>"}]}],
 "metadata":{"mask_encoding":"one_bit","include_confidence":"true"}}
→ 200 (2 s) {"object":"response","status":"completed","model":"sam-3.1",
   "output":[{"type":"message","content":[{"type":"output_text","text":"<see below>"}]}], ...}
```
The `text` from that call on a 1600×1600 image, with each mask payload shortened (the payload is arithmetic-coded and **we never decode it**):
```
<0f>0<|box;x1=261;y1=107;x2=715;y2=926;w=1600;h=1600;c=0.921951174736023|><|mask;x=0;y=0;c=0.921951174736023;data=820,455,!!!!&??c3Znc|>,1<|box;x1=881;y1=111;x2=1343;y2=913;w=1600;h=1600;c=0.9179486632347107|><|mask;x=0;y=0;c=0.9179486632347107;data=803,463,!!!!%k8:E^Zy|>\n
```
Grammar, from Meta's protocol doc:
- one line per frame, starting `<Nf>`;
- records are `id<|box;…|><|mask;…|>`, separated by an optional comma;
- token fields are `;`-separated `key=value` pairs, read by name (order is not significant);
- `x2`/`y2` are inclusive, so the half-open box is `[x1, y1, x2+1, y2+1]`;
- `w`/`h` are the frame size;
- `c` is the confidence, 0–1, and is optional;
- a payload never contains `|`, `;` or `,`.

## Change

### 1. New `web/src/consult/windows.js`, modelled on `web/src/consult/voice.js` (read `voice.js:1-119` once)
- Constants:
  - `SAM_MODEL = "sam-3.1"`;
  - `SAM_URL = META_API_BASE + "/responses"`;
  - `PHOTO_MAX_BYTES = 4_000_000`;
  - `WINDOW_MIN_SCORE = 0.5`.
- `parseSamBoxes(text)` → `[{ id, bbox: [x1, y1, x2+1, y2+1], frameW, frameH, score }]`:
  - read every `<|box;…|>` token; the id is the integer just before it;
  - split the fields on `;` and then on the first `=`;
  - `score` is the number from `c`, or `null` when absent or invalid;
  - skip a box with a missing or non-integer coordinate, or with `w`/`h` ≤ 0;
  - never read `mask` payloads.
- `windowsSummary(boxes, minScore = WINDOW_MIN_SCORE)` → `{ windows, frame: { w, h }, unionFrac }`:
  - keep boxes with `score === null || score >= minScore`;
  - each window is `{ bbox, boxFrac, score }`, where `boxFrac = boxArea / (w*h)` rounded to 0.001;
  - `unionFrac` is the exact union area of the kept boxes ÷ frame area (coordinate compression over the x edges), rounded to 0.001;
  - `frame` comes from the first box, or `{ w: 0, h: 0 }` with no boxes.
- `buildSamBody(bytes, mime)` returns the JSON body above. `mime` is `image/jpeg` or `image/png`, and the image goes in as a base64 data URL.
- `imageMime(bytes)` → `"image/jpeg"` for `FF D8 FF`, `"image/png"` for `89 50 4E 47`, else `null`.
- `createWindowsHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 25000 } = {})` → `async (req, res)`. Same shape as `createTranscribeHandler`, with its own `readRawBody` capped at `PHOTO_MAX_BYTES`:

  | case | response |
  | --- | --- |
  | not POST | 405 `method` |
  | body too large | 413 `too_large` |
  | `imageMime` is null | 400 `bad_image` |
  | no key (`metaApiKey(env)`) | 503 `no_key` |
  | fetch error, timeout (AbortController) or non-200 | 502 `upstream` with `status` (the number only) |

  - Read the text from `data.output[*].content[*]` where `type === "output_text"`.
  - Answer 200 `{ ok: true, model: "sam-3.1", frame, windows, unionFrac, count: windows.length }`.
  - Never store the image. Never log bytes, text or the key.

### 2. Relay route — `relay/handler.js`
- **Body limit.** `readRawBody(req)` at `:241-257` caps at `VOICE_MAX_BYTES`. Give it a second parameter `max = VOICE_MAX_BYTES` and use `max` inside.
- **Handler.** Next to `transcribeHandler` (`:232-237`), add `const windowsHandler = createWindowsHandler({ env, fetchImpl });` and buckets `win10`, `winDay` and `winGlobal`.
- **Route.** Add `if (path === "/api/vision/windows") { … }` right after the voice route (`:359-392`) and copy its shape:
  - POST only;
  - **no judge branch**;
  - the limit is `Math.max(checkBucket(win10, client, t, 600000, 10), checkBucket(winDay, client, t, DAY_MS, 30), checkGlobal(winGlobal, t, DAY_MS, 200))`;
  - read the body with `readRawBody(req, PHOTO_MAX_BYTES)` (413 `too_large` on error);
  - then `corsHeaders(res, cors); return windowsHandler(req, res);`.
- **Imports.** Import `PHOTO_MAX_BYTES` and `createWindowsHandler` from `../web/src/consult/windows.js`, as voice is imported at `:14`.

### 3. Dev server — `web/vite.config.js:258-259`
Mount `/api/vision/windows` with `createWindowsHandler({ env: process.env })`, the same way as voice, and import it next to `createTranscribeHandler`.

## Test — new `web/tests/sam-windows-60b.test.js` (no network: inject `fetchImpl`)
- **`parseSamBoxes`** on the measured text above:
  - 2 boxes;
  - the first has bbox `[261,107,716,927]`, frame 1600×1600 and score ≈ 0.922.
- **`windowsSummary`:**
  - a third box with `c=0.3` is dropped;
  - two overlapping 10×10 boxes on a 100×100 frame offset by 5 px in x give `unionFrac` 0.015;
  - the measured pair gives 2 windows and `unionFrac` 0.291.
- **Handler with a fake `fetchImpl`** returning `{ status: 200, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: MEASURED }] }] }) }`:
  - 200 with `count` 2;
  - the captured upstream body has `model` `sam-3.1`, `input_text` `window`, an `image_url` starting with `data:image/jpeg;base64,`, and `metadata.include_confidence` `"true"`;
  - the captured `Authorization` header is `Bearer test-key` (`env: { META_API_KEY: "test-key" }`).
- **Handler error cases:**
  - 4 000 001 bytes → 413;
  - `GIF8` bytes → 400 `bad_image`;
  - no key → 503;
  - fetch throws → 502;
  - upstream 500 → 502 with `status` 500.
- **Relay** (use the way `web/tests/voice-29b.test.js` builds a relay request; read only that test's helper lines):
  - GET `/api/vision/windows` → 405;
  - the 11th POST from one client inside 10 minutes → 429.

Run only: `cd web && node --test tests/sam-windows-60b.test.js tests/voice-29b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`web/src/ui/*` (60b2), `web/src/engine/*`, `web/src/render/*`, `web/src/places/*`, `web/src/i18n/*`, other test files.

## Final message
Changed files, one line each.

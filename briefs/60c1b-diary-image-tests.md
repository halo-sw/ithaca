# Stage 60c1b — tests for the diary image server (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Stop when done.

The previous run wrote `web/src/consult/diary-image.js`, the relay route `/api/image/diary` in `relay/handler.js` and the vite mount, then stopped on a network error before writing tests. **Do not change those files** unless a test below shows a real bug.

## New file `web/tests/diary-image-60c.test.js` (no network: inject `fetchImpl`)
Imports come from `../src/consult/diary-image.js`: `sceneSentence`, `imagePrompt`, `IMAGE_PROMPT_PREFIX` and `createDiaryImageHandler`.

Build a fake `req` as `{ method: "POST", body: JSON.stringify({ sentence, lang: "en" }) }`. The handler accepts a parked string body. Build a fake `res` with `statusCode`, `setHeader` and `end(body)` that stores the body.

- **`sceneSentence`:**
  - `"Day 16, walked home after sunset"` → `"walked home after sunset"`;
  - `"16일째 해 진 뒤 걸어서 귀가했어요"` → `"해 진 뒤 걸어서 귀가했어요"`;
  - `/\d/.test(imagePrompt("Day 3, 12 min walk to 2 stores"))` is false.
- **Handler with a fake `fetchImpl`** that records `(url, init)` and returns `{ status: 200, json: async () => ({ data: [{ b64_json: "UklGRg==" }], output_format: "webp" }) }`, with `env: { META_API_KEY: "test-key" }`:
  - 200, and `image` starts with `data:image/webp;base64,`;
  - the recorded URL ends with `/images/generations`;
  - the recorded JSON body has `model` `muse-image-1.0`, a `prompt` starting with `IMAGE_PROMPT_PREFIX`, and no digits;
  - `init.headers.Authorization` is `Bearer test-key`;
  - the response JSON has no `prompt` key.
- **Handler error cases:**
  - a 201-character sentence → 400 `bad_sentence`;
  - `"see http://x"` → 400;
  - `"12 34"` → 400;
  - a GET → 405;
  - no key (`env: {}`) → 503;
  - `fetchImpl` throws → 502;
  - upstream `{ status: 429 }` → 502 with `status` 429.
- **Relay:**
  - read only the helper lines of `web/tests/voice-29b.test.js` that build a relay with `createRelay` and send a request, and reuse that pattern;
  - GET `/api/image/diary` → 405;
  - six POSTs from the same client inside 10 minutes (stub `fetchImpl` as above, `env` with `META_API_KEY` and an allowed origin as that test does) → the 6th is 429.

Run only: `cd web && node --test tests/diary-image-60c.test.js tests/voice-29b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Final message
Changed files, one line each.

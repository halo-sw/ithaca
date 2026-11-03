# Stage 60b2 — room photo in the listing check card: SAM 3.1 window cue (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Context
60b1 added `POST /api/vision/windows`, implemented in `web/src/consult/windows.js` and mounted in the relay and the vite dev server.
- **Request:** the raw JPEG or PNG bytes, at most 4 MB.
- **Answer:** `{ ok: true, model: "sam-3.1", frame: { w, h }, windows: [{ bbox: [x1, y1, x2, y2] /* half-open, frame px */, boxFrac, score }], unionFrac, count }`.
- **Errors:** `{ ok: false, error }`.

It was verified with a real call on 2026-11-03: 2 windows, `unionFrac` 0.291.

Now the customer can add a room photo in the listing check card ("내가 본 매물 확인하기", `web/src/ui/listings.jsx`, `PasteCheck` at `:48-170`, read in full once). The result is a **photo cue**. It is never `측정`, never a pass, and it changes nothing else in the listing flow.

## Change

### 1. New `web/src/ui/windows-photo.js`
Pure where possible, and no React here.
- `export const SAM_PHOTO_ENABLED`:
  - `true` only when `import.meta.env && import.meta.env.VITE_SAM_PHOTO === "1"`;
  - guard `import.meta.env` being undefined under node, so it is `false` in tests.
- `export function windowsLine(result)` → a Korean source string:
  - `count > 0`: `` `이 사진에서 창 ${count}개 · 사진의 ${Math.round(unionFrac * 100)}%` ``;
  - `count === 0`: `"이 사진에서 창을 찾지 못했어요."`;
  - a bad or missing result: `"사진을 읽지 못했어요"`.
- `export async function downscaleToJpeg(file, maxSide = 1600, quality = 0.85)` (browser only):
  - `createImageBitmap(file)`, then a canvas scaled so the long side is ≤ `maxSide`, then `canvas.toBlob(…, "image/jpeg", quality)`;
  - it rejects on any failure.
- `export async function postWindowsWith(fetchImpl, url, blob)` → `{ ok, … }`. It never throws:
  - a network error gives `{ ok: false, error: "network" }`;
  - a non-JSON answer gives `{ ok: false, error: "upstream" }`;
  - otherwise it returns the JSON;
  - headers are `{ "Content-Type": "image/jpeg" }`.
- `export function postWindows(blob)`: `LIVE_API` false gives `{ ok: false, error: "offline" }`. Otherwise it calls `postWindowsWith(fetch, apiUrl("/api/vision/windows"), blob)`. `LIVE_API` and `apiUrl` come from `../paths.js`, exactly as `web/src/ui/voice.js:5` imports them.

### 2. `PasteCheck` in `web/src/ui/listings.jsx`
Only when `SAM_PHOTO_ENABLED`, add a block right after the first `HStack` of buttons (`:115-121`):
- Label `<Text>방 사진 추가 (선택)</Text>` and a visible file input:
  - `<input type="file" accept="image/*" aria-label="방 사진 추가 (선택)">`;
  - under it, `<Text type="supporting">사진은 창을 찾는 데만 쓰고 저장하지 않아요.</Text>`.
- **On change:**
  - set state `photo = { status: "reading" }` and show `<Text type="supporting">사진에서 창을 찾는 중…</Text>`;
  - then `downscaleToJpeg`, then `postWindows`;
  - on success, store `{ status: "done", url: URL.createObjectURL(blob), result }`, and revoke the previous URL;
  - on any error, `{ status: "error" }`.
- **Done.** Show:
  - a wrapper `<div style={{ position: "relative", maxWidth: 360 }}>` holding `<img src={url} alt="추가한 방 사진" style={{ width: "100%", display: "block" }} />`;
  - over it, `<svg viewBox={`0 0 ${frame.w} ${frame.h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">`;
  - inside the svg, one `<rect>` per window: `fill="none"`, `stroke="#1a56db"`, `strokeWidth={Math.max(2, frame.w / 200)}`, from its bbox;
  - then `<Text>{windowsLine(result)}</Text>` with a small tag `<span className="ui-tag">사진 근거</span>`;
  - then `<Text type="supporting">사진 한 장 기준이에요. 방향·층·앞 건물에 따라 실제 채광은 달라요. 현장에서 확인하세요.</Text>`;
  - then `<Text type="supporting">Meta SAM 3.1이 찾은 창 테두리 상자 기준이라 실제 유리 면적과 달라요.</Text>`.
- **Error.** Show `<Text>사진을 읽지 못했어요</Text>`. Leave the textarea, the parse result and the check button exactly as they are.
- Use no `측정`, no pass or fail, and no score anywhere in this block.

## Test — new `web/tests/sam-photo-60b2.test.js` (node, no browser, no network)
- **`windowsLine`:**
  - `{ ok: true, count: 2, unionFrac: 0.291 }` → `이 사진에서 창 2개 · 사진의 29%`;
  - `{ ok: true, count: 0, unionFrac: 0 }` → `이 사진에서 창을 찾지 못했어요.`;
  - `null` → `사진을 읽지 못했어요`.
- **`postWindowsWith`:**
  - a fake fetch that throws → `{ ok: false, error: "network" }`;
  - a fake whose `json()` throws → `error: "upstream"`;
  - a fake returning `{ ok: true, count: 1 }` → passed through;
  - the captured `init.headers["Content-Type"]` is `image/jpeg`.
- `SAM_PHOTO_ENABLED === false` under node.
- **Source checks** on `listings.jsx` as text:
  - contains `SAM_PHOTO_ENABLED &&`, `사진 근거`, the daylight disclaimer sentence, `사진을 읽지 못했어요` and `사진은 창을 찾는 데만 쓰고 저장하지 않아요.`;
  - the photo block contains no `측정`.

Run only: `cd web && node --test tests/sam-photo-60b2.test.js tests/sam-windows-60b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`web/src/consult/*`, `relay/*`, `web/src/i18n/*`, `web/src/ui/chat.jsx`, `web/src/ui/chatmap.jsx`, `web/src/basemap.js`, other test files.

## Final message
Changed files, one line each, then the new Korean strings, one per line.

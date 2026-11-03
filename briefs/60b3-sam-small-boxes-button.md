# Stage 60b3 — drop tiny or nested window boxes; a real button for the room photo (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Seen (orchestrator, real SAM 3.1 through the dev server, 2026-11-03)
The same room photo, re-encoded by the browser, came back with three boxes on a 1600×1600 frame:
- `[261,107,718,928]`, score 0.922;
- `[881,113,1343,916]`, score 0.918;
- `[640,742,663,778]`, score 0.515. This is a 23×36 px latch **inside** the first window.

The card then said `창 3개`, but the photo has 2 windows.

The visible native file input also looks out of place: it is full width and shows the browser's own `파일 선택 / 선택된 파일 없음`.

## Change

### 1. `web/src/consult/windows.js` (`windowsSummary`, `:53-89`)
- Add `export const WINDOW_MIN_FRAC = 0.005`. After the score filter, drop a box whose own area divided by the frame area is below it.
- Then drop a box when **at least 90 %** of its own area lies inside a larger box that was kept:
  - sort by area, largest first;
  - keep a box only if no box already kept covers ≥ 90 % of it;
  - return the kept boxes in their original order.
- `windows`, `unionFrac` and the `count` the handler returns all use only the boxes kept at the end.
- Keep `WINDOW_MIN_SCORE` at 0.5. Change nothing else in this file.

### 2. `web/src/ui/listings.jsx` (the photo block added in 60b2, after the first button `HStack`)
- Replace the visible `<input type="file">` and the separate `<Text>방 사진 추가 (선택)</Text>` label with:
  - a hidden input: `<input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />`, where `fileRef` is `useRef(null)` (add `useRef` to the `react` import on `:8`);
  - a button, same look as `예시로 채우기`: `<Button size="sm" variant="secondary" label="방 사진 추가 (선택)" onClick={() => fileRef.current && fileRef.current.click()} />`.
- At the end of `onPhoto`, success or error, set `e.target.value = ""` so the same file can be chosen again.
- Replace the supporting line `사진은 창을 찾는 데만 쓰고 저장하지 않아요.` with `사진은 창을 찾으려고 Meta SAM 3.1에만 보내요. Ithaca는 저장하지 않아요.`
- Everything else in the block stays as it is.

### 3. Tests
- **`web/tests/sam-windows-60b.test.js`.** Add a test with the three boxes above (frame 1600×1600, built the same way the existing `windowsSummary` tests build boxes). It expects:
  - 2 windows, the first two;
  - `unionFrac` 0.291.

  Add two more:
  - a lone box of score 0.95 that covers 0.3 % of the frame → 0 windows;
  - a box of score 0.95 that is 95 % inside a bigger kept box → dropped.
- **`web/tests/sam-photo-60b2.test.js`.** Update the source check from the old privacy sentence to the new one. Also check that the photo block has `hidden` on the file input and a `Button` with label `방 사진 추가 (선택)`.

Run only: `cd web && node --test tests/sam-photo-60b2.test.js tests/sam-windows-60b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/i18n/*`, `web/src/ui/chat.jsx`, `web/src/ui/chatmap.jsx`, `web/src/basemap.js`, other test files.

## Final message
Changed files, one line each, then the new Korean strings, one per line.

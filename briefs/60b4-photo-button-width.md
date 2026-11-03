# Stage 60b4 — room photo button at content width, accent token for the boxes (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Edit only `web/src/ui/listings.jsx` and `web/tests/sam-photo-60b2.test.js`. Stop when done.

## Seen (orchestrator, desktop browser)
The `방 사진 추가 (선택)` button from 60b3 sits directly in the photo `VStack`, so it stretches across the whole card. The three buttons above it (`읽어 보기`, `예시로 채우기`, `지우기`) are content width, inside `<HStack gap={2} vAlign="center" wrap="wrap">`.

## Change in `web/src/ui/listings.jsx` (photo block only)
1. Wrap that one `Button` in `<HStack gap={2} vAlign="center" wrap="wrap">…</HStack>`, the same props as the button row above.
2. In the window `<rect>`, replace `stroke="#1a56db"` with `style={{ stroke: "var(--ui-accent)" }}`. Keep `fill="none"` and the `strokeWidth` as they are.

Nothing else changes.

## Test — `web/tests/sam-photo-60b2.test.js`
- The photo block has no `#1a56db`.
- It contains `var(--ui-accent)`.
- The `방 사진 추가 (선택)` `Button` sits inside an `HStack`.

Run only: `cd web && node --test tests/sam-photo-60b2.test.js tests/sam-windows-60b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Final message
Changed files, one line each.

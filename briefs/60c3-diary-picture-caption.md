# Stage 60c3 — diary picture: caption on two lines; minute never 1440 (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Edit only `web/src/ui/chat.jsx` (the 60c2 picture block in `DiarySection`) and `web/tests/diary-picture-60c2.test.js`. Stop when done.

## Seen (orchestrator, real key, desktop browser)
1. The two caption `Text`s in `<figcaption>` render inline, so the page reads `1일째 07:32 장면Muse Image 일러스트 · …` with no break between them.
2. `Math.round(target.minute)` can give 1440 for a line at 23:59.5. The server answers 400 for that, and the whole block then hides for the session.

## Change (only the picture block in `DiarySection`)
1. Inside `<figcaption style={{ marginTop: 4 }}>`, wrap the two `Text`s in `<VStack gap={1}>…</VStack>`. Keep their text as it is.
2. Post `minute: Math.min(1439, Math.floor(target.minute))` instead of `Math.round(target.minute)`.

## Test — `web/tests/diary-picture-60c2.test.js`
Source checks on `chat.jsx`:
- the figcaption contains a `VStack`;
- `Math.min(1439, Math.floor(` is present;
- `Math.round(target.minute)` is gone.

Run only: `cd web && node --test tests/diary-image-60c.test.js tests/diary-picture-60c2.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Final message
Changed files, one line each.

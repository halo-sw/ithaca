# Stage 60c4 — commute scene names no mode of transport (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Edit only `web/src/consult/diary-image.js` and `web/tests/diary-image-60c.test.js`. Stop when done.

## Seen (orchestrator, real key)
For `menlo-month`, home A (777 Hamilton), the diary line "Day 1, commuted 14 min" was drawn as a figure walking to a train platform. That home's commute has no rail leg, so the picture suggests a mode the record does not have. A diary commute line does not say the mode.

## Change — `SCENES.commute` only
```js
commute: { kr: "a figure seen from behind on the way to work along a Korean apartment-district street",
           us: "a figure seen from behind on the way to work along a quiet Bay Area suburban street" },
```
Every other scene stays as it is.

## Test — `web/tests/diary-image-60c.test.js`
For both regions, `scenePrompt({ kind: "commute", ... })` contains none of `subway`, `train`, `platform`, `station` or `bus`.

Run only: `cd web && node --test tests/diary-image-60c.test.js tests/diary-picture-60c2.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Final message
Changed files, one line each.

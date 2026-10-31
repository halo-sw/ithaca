# Stage 29N2d — Fix three map regressions from 29N2b/29N2c (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Full suite after 29N2c (orchestrator) — the 29N2b/29N2c layout changes in `web/src/chatmap.js` broke pinned map tests:
- `tests/chatmap-18.test.js` "18d walkthrough map": `keeps every candidate pin and the workplace pin inside the viewBox` and `labels read at ≥ 11 px on a 1000 px panel` (`the moved tag's dot, got 2`).
- `tests/walk-19g.test.js` 19g-2: `ChatMap draws no leader for one pin, leaders for a close pair` → `isolated pill needs no leader`.
Likely: the new leader rule draws a leader (and an extra dot) for tags that did not really move (e.g. moved by the edge clamp ≤ 24 px, or measured from the wrong anchor), and a pin/workplace can end outside the viewBox on the 18d fixture.

## Changes
Fix the layout so these pinned tests pass **without editing them**, while 29N2b/29N2c behaviour stays (tags ≤ 120 px from their dot, leader only when moved > 24 px, no stacked tags, town-only groups, US Caltrain line). A leader and the second ("moved tag") dot appear only for a tag whose box centre moved more than 24 px from its natural position.

Run only:
```
cd web && node --test tests/chatmap-18.test.js tests/walk-19g.test.js tests/map-us-six-29N2c.test.js tests/us-corridor-29N2a.test.js tests/map-frame-29M2.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Tests, everything outside the map layout, `briefs/`.

## Final message
Changed files, one line each. Nothing else.

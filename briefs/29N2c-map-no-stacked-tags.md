# Stage 29N2c — Two tags never share one spot (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why — orchestrator capture after 29N2b (English, "I work at Meta HQ", desktop 1440×900, map SVG 921×844 css px)
Measured tag boxes (css px): candidates 5 `515 Cleveland Street` and 6 `553 West El Camino Real` are both at `x 555, y 285, 72×70` — 5 is hidden under 6 (phone: same, 5 invisible), and a leader line runs from an empty spot to 5's dot. The six homes (lon, lat): 1 `777 Hamilton` -122.1561971, 37.4795456 (us-menlo); 2 `1221 Willow Road` -122.1540321, 37.4746227 (us-menlo); 3 `344-348 Kipling Street` -122.1615958, 37.4486218 (us-st-palo-alto); 4 `275 Hawthorne Avenue` -122.1657664, 37.4482227 (us-st-palo-alto); 5 `515 Cleveland Street` -122.2344163, 37.4803242 (us-st-redwood-city); 6 `553 West El Camino Real` -122.2607653, 37.5080328 (us-st-san-carlos); workplace Meta HQ -122.14823, 37.48485. The 29M2/29N2b tests did not catch it.

## Changes
Find why the 120-px / free-area clamp (29N2b) can move a tag onto a spot already taken (likely the clamp runs after collision checks, or clamped positions are not re-checked). After any clamp, re-run the collision check; a tag that still collides takes the next candidate spot within 120 px, else the compact form, else joins a card (same town only), else gets a numbered dot + a row in a small "More here" card. Never two boxes overlapping, never a leader to an empty spot.

## Tests — new `web/tests/map-us-six-29N2c.test.js`
- These six homes + HQ, stage 921×844 and 390×600 with the real chrome obstacles (top-left filter/legend stack, right controls, credit): all six candidates are visible as tags or card rows; no two boxes overlap (intersection area 0); every leader ends on a drawn box; every box inside the free area.
Keep green: `tests/us-corridor-29N2a.test.js`, `tests/map-frame-29M2.test.js`, the 31-series map tests.

Run only:
```
cd web && node --test tests/map-us-six-29N2c.test.js tests/us-corridor-29N2a.test.js tests/map-frame-29M2.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Everything outside the map layout; `briefs/`.

## Final message
Changed files, one line each. Nothing else.

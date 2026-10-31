# Stage 29N2g — the workplace pill never covers a pin tag or anchor dot (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges you grep for. Stop when the named tests pass.

## Why (live capture, phone 390×844, English, "I work at Meta HQ")
The map layer is ~390×750 CSS px under the tab bar. The pill `Work · Meta HQ (1 Hacker Way)` sits at about x 89–330, y 510–536 (CSS px, map-local). Candidate 5's anchor dot is at about (111, 539) — directly under the pill's left edge — and the tags of candidates 5 (x 92–152) and 2 (x 191–250) start at y ~540, touching its bottom edge. The pill's leader to HQ goes down to (309, 541) between tags 2 and 1. Desktop 1440×900 is fine (pill clear of every tag).

## Change
In the workplace-pill placement (`web/src/chatmap.js` / `web/src/ui/chatmap.jsx`, grep `workplace` + `pill` / the 29M2 clamp), after pin tags are placed treat every tag box and every candidate anchor dot (radius 6) as an obstacle with an 8 px gap:
1. Try positions around the HQ point in order: above, below, left, right, then the four diagonals, at increasing leader length (up to 120 px), each clamped into the free area (29M2).
2. Pick the first with no overlap; if none, pick the least-overlap one and shorten the label to `Work · Meta HQ` / `회사 · 메타 HQ` (Seoul: keep `Work · Gangnam` as is).
3. The leader line from the pill to HQ must not cross a tag box where an alternative exists (prefer positions whose leader is clear).
Same rule on desktop and phone, Seoul and US.

## Tests — new `web/tests/map-pill-29N2g.test.js`
- Layout helper with a 390×750 stage, HQ at (309, 541), tags at (92,540,60,58), (191,540,60,58), (260,560,60,58), anchors at (111,539), (222,532): the pill box overlaps no tag (8 px gap) and covers no anchor dot.
- A stage with free space above HQ: pill stays above (today's position unchanged).
Keep green: `tests/map-frame-29M2.test.js`, `tests/map-us-six-29N2c.test.js`, `tests/map-us-ids-29N2f.test.js`, `tests/map-us-live-29N2e.test.js`, and every test matching `grep -l "workplace" tests/*.test.js` — list any expectation you updated.

Run only:
```
cd web && node --test tests/map-pill-29N2g.test.js tests/map-frame-29M2.test.js tests/map-us-six-29N2c.test.js tests/map-us-ids-29N2f.test.js tests/map-us-live-29N2e.test.js $(grep -l "workplace" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`pipeline/`, `data/`, `relay/`, `briefs/`.

## Final message
Changed files, one line each, plus any expectation you updated. Nothing else.

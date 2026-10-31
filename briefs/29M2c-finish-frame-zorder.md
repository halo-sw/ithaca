# Stage 29M2c — Finish 29M2b: two tests still red (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

The 29M2b edits (`web/src/chatmap.js`, `web/src/ui/chatmap.jsx`, `web/src/ui/ui.css`, `web/tests/map-frame-29M2.test.js`) are in the working tree, unfinished. Read `briefs/29M2b-map-centre-group-radius.md` for the goal. Two failures left:
1. `tests/map-frame-29M2.test.js` "29M2 tags stay inside the free area": the workplace pill box `{x:303,y:201,w:136,h:26}` is 3 px above the free area top (`y:204`) at 640×585 and 390×600. The workplace pill must be clamped into the free area like every tag (after the 29M2b edge rule), not only into the stage.
2. `tests/map-click-31b*.test.js` (or the file named "31b pin z-order"): "paints every tag after every location circle and leader line" and "renders the highlighted tag last". Keep the 31b paint order with the new grouping: all dots and leaders first, then tags and group cards, the highlighted tag (or the card containing the highlighted row) last. Do not weaken the 31b test; fix the render order.

Run only:
```
cd web && node --test tests/map-frame-29M2.test.js tests/map-stations-29L3.test.js tests/walk-19g.test.js tests/pins-commute-29k2.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Everything else; `briefs/`.

## Final message
Changed files, one line each. Nothing else.

# Stage 29N2h2 — fix the broken pin <g> tag from 29N2h (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full test suite. First edit within 2 tool calls.

`web/src/ui/chatmap.jsx:1138` reads `<g key={`pin-pill-${keyOf(p)}`}> data-layer="home-pin"` — the `>` closes the tag early, so `data-layer` and the `{...pinButtonProps(...)}` spread on the next line become children (TypeError "pinButtonProps is not a function or its return value is not iterable" in every SSR map test). Restore it to one opening tag: `<g key={…} data-layer="home-pin" {...pinButtonProps(…)}>`, matching the sibling tags at ~1242 and ~1280. Check the other 29N2h edits for the same slip (grep `}> data-` and `}>\n *{\.\.\.`).

Run only:
```
cd web && node --test tests/walk-19g.test.js tests/map-us-ids-29N2f.test.js tests/map-pill-29N2g.test.js tests/map-frame-29M2.test.js tests/map-us-six-29N2c.test.js tests/map-stations-29L3.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Final message: changed lines, one line. Nothing else.

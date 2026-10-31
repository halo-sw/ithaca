# Stage 29L2b — Follow-up: no ellipsis in the phone credit; the 19g pin speaks the new station names (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Full suite after 29L2 (orchestrator): 20 "no ellipsis / never truncates" CSS pins fail on one new rule in `web/src/ui/ui.css` (29L2 phone block):
```
.ui-simcredit { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```
The project never truncates text with dots. The short phone credit (`© VWorld · © OpenStreetMap`) already fits one line, so the rule is not needed.

And `web/tests/walk-19g.test.js:115-133` still expects the old station label text (`>야탑</text>`, `>판교</text>`), while 29L3 deliberately labels stations with 역 (`야탑역`).

## Changes
1. `ui.css`: in that phone rule keep `white-space: nowrap;` only — remove `overflow: hidden; text-overflow: ellipsis;`.
2. `web/tests/walk-19g.test.js` 19g-3: `!html.includes(">판교역</text>")` and `!html.includes(">판교</text>")` for "no station-name label for it"; `html.includes(">야탑역</text>")` for "picked home stop still labelled". Nothing else in that test changes.

Run only:
```
cd web && node --test tests/walk-19g.test.js $(grep -l "ellipsis" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Everything else; `briefs/`.

## Final message
Changed files, one line each. Nothing else.

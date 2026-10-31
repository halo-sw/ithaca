# Stage 36f2 — remove the text-overflow line from the 36f toolbar CSS (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no build. First edit within 2 tool calls.

36f added this inside `@media (max-width: 480px)` in `web/src/ui/ui.css:~121-124`:
`.ui-tools button { overflow: visible; text-overflow: clip; white-space: nowrap; }`

The repo bans any `text-overflow` in CSS, and 11 contract tests fail on it (`no truncation in ui.css`, e.g. `tests/chatfirst-26t.test.js:196`, `tests/street-credit-29h5.test.js:34`).
- Remove `text-overflow: clip`.
- Keep the wrap behaviour: whole buttons wrap to a second row, nothing is cut.
- If `overflow: visible` is not needed for that, remove it too.
- Keep `tests/home-and-dest-36f.test.js` green.

Run only:
```
cd web && node --test tests/home-and-dest-36f.test.js $(grep -lE "no truncation|text-overflow" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

Final message: the changed lines. Nothing else.

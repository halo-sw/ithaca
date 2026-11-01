# Stage 36j2 — the street-view link reads as a quiet side note (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named test passes.

## Why
36j's `.ui-cand-streetview` link (`web/src/ui/candidate-card.jsx:~574-590`) has no style of its own: on the card it renders as large and dark as the commute line, heavier than the price meta line above it.

## Change
Style `.ui-cand-streetview` in the stylesheet that holds the other `.ui-cand-*` rules (grep `ui-cand-` in `web/src/**/*.css`): same font size and muted color token as the card's meta line ("실거래 중간값 · 14건 …"), no underline until hover/focus-visible (underline then), a visible focus ring, the ↗ slightly smaller. Light and dark themes both via the existing tokens; no literal colors. No JSX change unless a class is missing.

Run only:
```
cd web && node --test tests/street-view-link-36j.test.js 2>&1 | grep -E "^# (pass|fail)|not ok"
```
Final message: changed files, one line each. Nothing else.

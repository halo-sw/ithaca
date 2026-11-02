# Stage 42k2 — try card on phones: caption overlaps the second button; key input has no field look (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

Capture after 42k, local production copy:
1. **390 px wide (landing, Korean)**: in the Muse group the caption `무료 체험 1회 · 이후 내 키 · 내 모델 키로 하기 ▸` is drawn on top of the `서울로 해 보기` button (the second button overlaps the caption row — looks like the stacked buttons keep a fixed row height or the caption is placed on a grid row the stacked buttons overflow). Under 900 px the Muse group must flow: eyebrow → button → button → caption, each in normal flow, 8 px token gap, nothing overlapping, at 320–900 px.
2. **Key form opened (wide)**: the `모델 키 붙여넣기` input shows no field — no border/background, so it reads as plain text. Give it the same field look as the composer / 42b banner key input (border, radius, padding, 44 px height, focus ring), and make `키 저장` a normal-width secondary button next to the input on wide screens (input grows), under it below 900 px.

## Tests — extend `web/tests/try-card-42k.test.js`
- CSS: under the 900 px media rule the Muse group's buttons and caption are in normal flow (no fixed grid row heights / absolute positions on them); the key input rule has a border and a height.
Run the file + 42b/42g tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Cause of item 1 in one sentence, changed files one line each, suite line, build line.

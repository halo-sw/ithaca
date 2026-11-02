# Stage 42k — the "바로 해 보기" card: clear hierarchy, no romanized labels (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` (the orchestrator already added `Muse 실시간` → `Live with Muse`, `키 없이` → `No key needed`, `녹화된 30일을 재생해요` → `Plays a recorded 30 days`).

## Why (owner, live English landing, 2026-11-02)
`web/src/ui/entry-hero.jsx:~109` renders three equal columns: a black `기록된 한 달 보기` with no heading, and two grey buttons each with a large `Muse 실시간` heading above (repeated twice, and shown in English as `Muse Silsigan`). The buttons sit at different heights, the heading is bigger than the buttons' own text, and the key toggle renders as `Nae Model Kiro Hagi ▸` because the arrow is in the same text node (`${LANDING_KEY_ROW_LABEL} ▸`), so the exact i18n entry never matches. The owner finds the hierarchy awkward.

## Change (EntryHero → both the landing and the chat empty state)
Two groups, one row on wide screens (grid 1fr : 2fr, gap from tokens), every group with the same three rows so all buttons share one baseline:
```
바로 해 보기
키 없이                    ● Muse 실시간
[■ 기록된 한 달 보기]      [Meta 본사 출근으로 해 보기] [서울로 해 보기]
녹화된 30일을 재생해요     무료 체험 1회 · 이후 내 키 · 내 모델 키로 하기 ▸
```
- Eyebrow row: small text (`--ds-t-12`, `--ds-ink-3`, same line height in both groups). `Muse 실시간` appears **once**, with a small live dot before it (decorative, `aria-hidden`).
- Button row: replay stays the one primary (black); the two Muse buttons are secondary, equal width, same 44 px height as the primary.
- Caption row: same caption style for both groups. In the Muse group the key toggle is an inline text button right after the caption (caption size, `--ds-ink-2`, no button chrome), label text node exactly `내 모델 키로 하기` with the arrow in its own `aria-hidden` span (`▸` / `▾`). The key form opens full width under the whole row (unchanged behaviour).
- Remove the old separate `ds-lp-byok` row above the proof strip.
- ≤ 900 px: groups stack (replay group first); the two Muse buttons stack full width; nothing truncated, no horizontal scroll, no `text-overflow`.
- No 13 px font size anywhere.

## Tests — new `web/tests/try-card-42k.test.js` (+ update 42b/42g tests that pinned the old markup)
- EntryHero: exactly one `Muse 실시간`; eyebrow `키 없이`; caption `녹화된 30일을 재생해요`; captions `무료 체험 1회 · 이후 내 키` once.
- Key toggle: its label element's text is exactly `내 모델 키로 하기`; the arrow lives in a separate `aria-hidden` element; toggling still opens the form with provider chips, input and `키 저장`.
- CSS: the try grid is two columns on wide, one column under 900 px; no `text-overflow`, no `13px`.
Run the new file + 42b/42g/42i tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, suite line, build line.

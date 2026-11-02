# Stage 42g — one entry screen: the chat's empty state uses the landing hero (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (owner, 2026-11-02)
The owner found two different "main screens": the landing at `/` (`web/src/ui/landing-page.jsx` hero: eyebrow `Pre-simulation by Muse Agent`, `어떤 집을 고민 중이세요?`, lede `Muse가 직접 확인하고, 대신 30일 살아 보고, 대화로 알려 줘요.`, composer, chips `출근지로 집 찾기 · 본 매물 붙여 넣기 · 예시로 써 보기`, the `바로 해 보기` card with three buttons + captions + 42b key row, coverage line) and the chat's empty state at `?chat=` (reached by the header `시작하기`; `web/src/ui/chat.jsx:~4900`, 3D glide backdrop, heading `계약 전에, 그 집에서 30일 먼저 살아 봐요`, sub, label, a row of 6 starter buttons, 4 example cards, coverage). Owner decision: **the landing hero is the standard**; the chat empty state shows the same content, keeping only its 3D backdrop + scrim.

## Change
1. Factor the landing hero content (eyebrow → coverage line, including the `바로 해 보기` card, captions and the collapsed `내 모델 키로 하기` key row) into one shared component (e.g. `EntryHero` in `web/src/ui/entry-hero.jsx`) with props for how actions are handled: on the landing the buttons navigate as today; inside the chat the composer, chips and buttons act in place (send the text / open listing paste / fill the example / open the replay / send the Meta HQ prompt / send the Seoul example), exactly like today's `starterAction`.
2. `landing-page.jsx` renders `EntryHero` (no visual change on the landing — same classes, same text, same order).
3. The chat empty state renders `EntryHero` over the existing 3D backdrop + scrim; remove the old heading/sub/label, the 6-button starter row and the 4 example cards there. The composer keeps its voice button and the voice notes. Readable over the backdrop (the hero sits on its own light panel if needed), wide and narrow (≤ 900 px) layouts, no horizontal scroll.
4. Keep `EXAMPLE_PROMPTS`, `LANDING_HEADING` etc. exported if other code/tests import them; drop only what nothing uses.

## Tests — new `web/tests/entry-hero-42g.test.js` (+ update tests that pinned the old empty state)
- Landing and chat empty state both contain: `어떤 집을 고민 중이세요?`, the lede, the three chips, `바로 해 보기` with its three buttons and captions (`키 없이 기록 재생`, `무료 체험 1회 · 이후 내 키` ×2), `내 모델 키로 하기`, the coverage line.
- Chat empty state no longer contains `계약 전에, 그 집에서 30일 먼저 살아 봐요` or the example cards.
- In-chat actions: chip/button handlers call send / listing / replay the same way the old starters did.
Run the new file + landing/chat tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, tests updated, suite line, build line.

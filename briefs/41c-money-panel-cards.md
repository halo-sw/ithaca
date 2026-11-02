# Stage 41c — money panel bugs, English tenure words, lot-name cards (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Parallel runs 41a (i18n/translate.js, romanize.js), 41b (consult/*, verify/compare.js), 41d (public rental removal) and 41e (relay) are running: touch only the real-deal line in `web/src/ui/money.jsx` (around line 379), the English tenure regex in `web/src/profile.js` (around line 223), `web/src/ui/candidate-card.jsx` and tests. 41d also edits money.jsx and profile.js in other places — keep your edits to those exact spots.

## Why (English audit on the live site, 2026-11-01)
1. Money panel, real-deal line: "실제로 거래된 값 30㎡ (단지 이름으로 찾은 NaN건 중)" — `h.parcel_rows + h.name_rows` (`web/src/ui/money.jsx:379`) is NaN when the housing object lacks those fields.
2. (Public rental rows are removed from the service by 41d; nothing to fix here. Do not touch `CandidateRow`.)
3. English UI words for 전세 are now "deposit lease" (orchestrator i18n change). The English parser (`web/src/profile.js:223`) only knows "jeonse"/"chonsei", so a customer who types what the UI shows ("Find me a deposit-lease home …") gets no tenure.
4. Cards in English show generated lot-number names twice: "산성역 근처 연립·다세대 (84-0) (Row house near Sanseong Stn (84-0))". The Korean is not a real name (`displayNameFor`, `web/src/homes.js:683-701`, built it), so English mode should not show it.

## Changes
1. `money.jsx:379`: the count is `(Number(h.parcel_rows) || 0) + (Number(h.name_rows) || 0)`; when both are missing, drop the "(…으로 찾은 N건 중)" part entirely (keep "실제로 거래된 값 {㎡}: …").
2. (none — see Why 2.)
3. `profile.js` English tenure: add "deposit lease", "deposit-lease", "lump-sum deposit", "key money" → "jeonse"; "monthly rent" stays → "wolse"; "buy"/"purchase" behavior unchanged.
4. `candidate-card.jsx` `HomeName`: in English mode, when the shown Korean name came from `displayNameFor` (the candidate's raw `name` is a bare lot number, `LOT_NAME_RE` in homes.js), show only the English name as the title (no Korean, no parentheses). Real Korean names keep today's Korean + English gloss.

## Tests — new `web/tests/money-cards-41c.test.js`
- Real-deal line with no row counts has no "NaN" and no "건 중".
- `extract_profile("I want a deposit lease up to 300M won")` → tenure "jeonse", depositMax 300000000.
- English HomeName for a lot-number candidate renders the English name only.

Run only:
```
cd web && node --test tests/money-cards-41c.test.js $(ls tests/*money*.test.js tests/*candidate*.test.js tests/*profile*.test.js 2>/dev/null | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
List old pins you changed (old → new).

## Final message
Changed files, one line each, plus pins changed.

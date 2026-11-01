# Stage 41c — money panel bugs, English tenure words, lot-name cards (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Parallel runs 41a (i18n/translate.js, romanize.js) and 41b (consult/*, verify/compare.js) are running: touch only `web/src/profile.js`, `web/src/ui/money.jsx`, `web/src/ui/candidate-card.jsx` and tests.

## Why (English audit on the live site, 2026-11-01)
1. Money panel, real-deal line: "실제로 거래된 값 30㎡ (단지 이름으로 찾은 NaN건 중)" — `h.parcel_rows + h.name_rows` (`web/src/ui/money.jsx:379`) is NaN when the housing object lacks those fields.
2. Money panel, public rental rows (`CandidateRow`, `money.jsx:236-247`): "[object Object] undefined㎡" and "보증금 – · –". `c.address` is now an object (`{road, sigungu}`) on some candidates, and the area / deposit / monthly fields have other names on this candidate shape.
3. English UI words for 전세 are now "deposit lease" (orchestrator i18n change). The English parser (`web/src/profile.js:223`) only knows "jeonse"/"chonsei", so a customer who types what the UI shows ("Find me a deposit-lease home …") gets no tenure.
4. Cards in English show generated lot-number names twice: "산성역 근처 연립·다세대 (84-0) (Row house near Sanseong Stn (84-0))". The Korean is not a real name (`displayNameFor`, `web/src/homes.js:683-701`, built it), so English mode should not show it.

## Changes
1. `money.jsx:379`: the count is `(Number(h.parcel_rows) || 0) + (Number(h.name_rows) || 0)`; when both are missing, drop the "(…으로 찾은 N건 중)" part entirely (keep "실제로 거래된 값 {㎡}: …").
2. `CandidateRow`: label = `(typeof c.address === "string" ? c.address : (c.address && c.address.road)) || c.complex_name || ""`; area = the first finite of `c.exclusive_area_m2`, `c.area_m2`, `c.unit_area_m2` (omit "㎡" part when none); deposit/monthly use the first finite of the known field names on this shape (read the public-rental candidate builder to find them); when a value is missing show "모름" instead of "–". Never print "[object Object]" or "undefined".
3. `profile.js` English tenure: add "deposit lease", "deposit-lease", "lump-sum deposit", "key money" → "jeonse"; "monthly rent" stays → "wolse"; "buy"/"purchase" behavior unchanged.
4. `candidate-card.jsx` `HomeName`: in English mode, when the shown Korean name came from `displayNameFor` (the candidate's raw `name` is a bare lot number, `LOT_NAME_RE` in homes.js), show only the English name as the title (no Korean, no parentheses). Real Korean names keep today's Korean + English gloss.

## Tests — new `web/tests/money-cards-41c.test.js`
- Real-deal line with no row counts has no "NaN" and no "건 중".
- CandidateRow text for `{ address: { road: "천호대로157길 45" }, complex_name: "X", deposit_won: 10000000, monthly_rent_won: 200000 }` contains "천호대로157길 45" and no "[object Object]"/"undefined" (render to a string the way existing money.jsx tests do, or test an extracted pure helper).
- `extract_profile("I want a deposit lease up to 300M won")` → tenure "jeonse", depositMax 300000000.
- English HomeName for a lot-number candidate renders the English name only.

Run only:
```
cd web && node --test tests/money-cards-41c.test.js $(ls tests/*money*.test.js tests/*candidate*.test.js tests/*profile*.test.js 2>/dev/null | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
List old pins you changed (old → new).

## Final message
Changed files, one line each, plus pins changed.

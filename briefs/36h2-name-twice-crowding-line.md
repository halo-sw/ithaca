# Stage 36h2 — the home name once, the crowding line names its lines (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (real Chromium, new demo, 2026-11-01)
1. **B's home pill says the name twice.**
   - Korean: `우리 집 · 분당 엠코 헤리츠 분당 엠코 헤리츠`. English: `Our home · Bundang Emco Heritz Bundang Emco Heritz`.
   - Building `w465862686` (`data/build/st-미금/area.json`) has `register.name` `분당 엠코 헤리츠` and `register.sub_name` `분당 엠코 헤리츠`.
   - `buildingNameOf` (`web/src/labels3d.js:155-163`) joins `name + " " + sub_name` without checking whether they are the same.
2. **The crowding line contradicts the measured leg.**
   - On A's 8호선 leg the panel shows `혼잡 100% 실측`. The line above it says only `혼잡 70%는 가정값이에요 (실측 없음)` (`web/src/evidence.js:189-192` EN, `:205-208` KO).
   - The real ride (day index 0, 07:44) has four legs:
     - 9호선, 70, `가정값`;
     - 8호선, 100.1, `서울교통공사`, `hasData: true`;
     - 수인·분당선, 70, `가정값`;
     - 경강선, 70, `가정값`.
   - The line must say which lines are assumed and which are measured.

## Change
1. **`buildingNameOf`.**
   - Skip `sub_name` when, after removing spaces, it equals `name` or is already contained in it.
   - `분당 엠코 헤리츠` + `분당 엠코 헤리츠` → `분당 엠코 헤리츠`.
   - `래미안 101동` + `101동` → `래미안 101동` (contained).
   - `래미안` + `101동` → `래미안 101동` (unchanged).
2. **Crowding lines** (`rideParts` in `evidence.js:66-110` collects `assumed`; also collect measured legs as `{lineName, pct}` from `c.hasData === true`). Then in `commuteLines`:
   - **Assumed line, Korean:** `{lines} 혼잡 {pct}%는 가정값이에요 (실측 없음)`, tag `가정값`. `{lines}` = the assumed legs' line names, de-duplicated in ride order, joined with `·`. Example: `9호선·수인·분당선·경강선 혼잡 70%는 가정값이에요 (실측 없음)`.
   - **Assumed line, English:** `Crowding {pct}% on {lines} is assumed (not measured)`. The line names come from the existing English line-name helper (`grep -n "Suin-Bundang\|lineNameEn\|LINE_EN" web/src/*.js web/src/i18n/*.js`). If there is none, use the Korean names; the orchestrator adds the words.
   - **Measured line** (new, only when any leg is measured). Korean: `8호선 혼잡 100%는 서울교통공사 실측이에요`, tag `측정`. English: `Crowding {pct}% on {line} is measured (Seoul Metro)`. With several measured legs, show the highest one with its line.
   - **Rounding:** round pct with `Math.round`, as today.
   - **Rides without legs** keep today's line unchanged.
   - Both languages are built in code, with no glossary dependency, like 29L2.

## Test — new `web/tests/name-crowding-36h2.test.js`
- **Name:** the three `buildingNameOf` cases above, through `labelItemsFor` (a fake area with one building). Plus the real B building (skip if `data/build/st-미금/area.json` is missing): the pill title is `우리 집 · 분당 엠코 헤리츠`.
- **Crowding:** `commuteLines` on a fake run with the four legs above gives:
  - the Korean assumed line `9호선·수인·분당선·경강선 혼잡 70%는 가정값이에요 (실측 없음)`;
  - the measured line `8호선 혼잡 100%는 서울교통공사 실측이에요` with tag `측정`;
  - English: no Hangul, except line names when no English helper exists.
- **Real build** (skip if `data/build/sim/demo-two-homes-A.json` is missing): A's day index 0 morning has both lines.
- **Keep green:** every test that greps `가정값이에요 (실측 없음)`, `Crowding .* is assumed`, `buildingNameOf`, `labelItemsFor` or `commuteLines`.

Run only:
```
cd web && node --test tests/name-crowding-36h2.test.js $(grep -lE "실측 없음|is assumed \(not measured\)|labelItemsFor|commuteLines" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If a kept test pins the old wording, update its expectation and name it in the final message. If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**` (list any new English string in the final message), `relay/**`, `data/`, `pipeline/**`, `README*`, `scenarios/`, `public/recorded/**`.

## Final message
Changed files, one line each. Old tests changed, with why. New English strings, if any. Nothing else.

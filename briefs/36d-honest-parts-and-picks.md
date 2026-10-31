# Stage 36d — honest per-part tags, the real home building, one photo per card, the price read in either order (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (fidelity audit 2026-11-01, `docs/3d-fidelity.md`)
1. **One `측정` tag covers a partly assumed line.** `오늘 출근 44분 = 걷기 14분 + 지하철 26분 + 기다림 4분` carries a single `측정` tag (`web/src/evidence.js:141`: `const tag = bikeTrips.length === 0 ? "측정" : "가정값";`).
   - Only the walk is measured, on the graph.
   - The 26 subway minutes come from the scenario's `ride_minutes` (source `user_assumption`), split by km.
   - The 4 minutes are the transfer assumption.
2. **The home is a guard booth.** Home B (`백현마을`) resolved to a 16.8 ㎡ one-floor `경비실5`. `resolveHome` (`web/src/engine/scenario.js:497-520`) picks the complex building nearest a graph node, whatever it is.
3. **Two cards, one photo.** Cards 1 and 2 of the same candidate list show the same Mapillary photo (`web/src/ui/candidate-card.jsx`, the row thumbnail / street photo choice around `:245`).
4. **The price cap reads the savings.** "10억 이하 매매로 찾아 줘. 모은 돈 3억" parses `priceMax = 300,000,000`.
   - `nearMoney` (`web/src/profile.js:438-475`) lets money *after* the anchor win at any distance inside the window.
   - So `모은 돈 3억` beats `10억 이하` right before `매매`.
   - The reverse order parses correctly.

## Change
1. **Per-part tags** (`web/src/evidence.js:110-160`, the 오늘 출근/퇴근 line, Korean and English):
   - **Split into parts.** Each part becomes its own entry `{ text, tag }`:
     - walk → `측정` (graph);
     - subway → `측정` only when every ride's minutes come from the timetable or interstation data (the ride source is the schedule); else `가정값`;
     - the transfer/wait part → `가정값`;
     - bike → `가정값` as today.
   - **Total.** The total line is `측정` only when every part is `측정`; else `가정값`.
   - **Rename.** `기다림` becomes `환승·기다림` (EN `transfer & wait`).
   - **Display.** Keep the one-line summary text for screens that show one line, but carry `parts: [{label, minutes, tag}]` so the panel can show one tag per part. In the side panel where these lines render (find the consumer with `grep -n "evidenceLines\|tag" web/src/ui/app.jsx | head`; read only the found range), render each part's tag after its part. No new layout system: an inline small tag as today, wrapping allowed, no ellipsis.
   - **Where the ride source lives.** Use the run's ride/journey data, the same fields `rideParts(a)` reads (`:125-130`); extend `rideParts` to report the source if it does not.
2. **Real dwelling buildings first** (`web/src/engine/scenario.js` `resolveHome`, `:497-520`):
   - **Dwellings.** Before choosing the nearest-to-graph building, keep only buildings whose `register.sub_name` / `name` does not match `경비|관리|상가|주차|기계|전기|경로당|어린이집|노인정|커뮤니티|부속`, and whose `levels` ≥ 3 when levels are known.
   - **Choice.** Among those, pick the nearest to the graph as today; ties go to the larger `area_m2`.
   - **Fallback.** If none are left, fall back to all buildings, as today.
   - Record `anchor.dwelling_filter: true|false` in the returned anchor.
   - **Determinism.** The same input gives the same building.
3. **One photo per card** (`web/src/ui/candidate-card.jsx`, the list that renders rows): keep a per-list set of used photo ids/urls. A row whose first photo is taken uses its next unused photo, else the silhouette/model thumbnail it uses today when it has none. Pure helper `assignListPhotos(candidates)` → `Map(id → photo|null)`, used by the list.
4. **Price cap in either order** (`web/src/profile.js`):
   - In `nearMoney`'s callers for the price, deposit and monthly hits, exclude money already taken by the cash or salary hit (`모은 돈 …`, `연봉 …`): compute those first, then pass the remaining monies.
   - For the price anchor, an amount directly before it with `이하|까지|안쪽|미만` between them (gap ≤ 6 characters, e.g. `10억 이하 매매`) beats an amount after it.
   - Apply the same rule to the 36b buying-verb anchors (`… 이하로 집을 사고`).

## Test — new `web/tests/honest-parts-36d.test.js`
- **Tags:**
  - For a run fixture whose ride source is `user_assumption` (follow the evidence tests' fixtures, `grep -l "evidence" web/tests/*.test.js`), the 출근 line is not tagged `측정`. Its parts are walk `측정`, subway `가정값`, transfer `가정값`.
  - With a schedule-sourced ride, subway is `측정`.
  - The English line says `transfer & wait`.
- **Dwelling:** a fake area whose complex has a 16 ㎡ 1-floor `경비실` closest to the graph and a 20-floor `101동` slightly farther: `resolveHome` returns `101동`. A complex with only the 경비실 returns the 경비실, with `dwelling_filter: false`.
- **Photos:** `assignListPhotos` with two candidates that share the same first photo gives them different photos, or one gets null.
- **Price:**
  - "10억 이하 매매로 찾아 줘. 모은 돈 3억" → `priceMax` 1,000,000,000 and `cash` 300,000,000;
  - "모은 돈 3억, 10억 이하 매매" → the same;
  - "강남 출근, 매매 9억 이하" → 900,000,000;
  - "전세 4억 이하, 모은 돈 1억" → `depositMax` 400,000,000.
- **Keep green:** every test that mentions `evidence`, `resolveHome`, `candidate-card`, `extract_profile` or `nearMoney`. Run them. Update only tests that pinned the single `측정` tag on the commute line or the 경비실 pick, and name them.

Run only:
```
cd web && node --test tests/honest-parts-36d.test.js $(grep -lE "evidence|resolveHome|candidate-card|extract_profile|nearMoney" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/money/**`, `relay/**`, `data/`, `README*`, `scenarios/`, `src/aerial/**`, `src/journey-scene.js` (36c owns those).

## Final message
Changed files, one line each. Old tests you changed, with why. Nothing else.

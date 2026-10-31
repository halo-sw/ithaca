# Stage 36b — 동네별 후보 fixes found in a real run: the price cap, origins that are not subway stations, the workplace used as a region (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. 36a is committed. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator
The input was "예비부부예요. 둘 다 판교로 출근해요. 모은 돈 3억, 9억 이하로 집을 사고 싶어요." The orchestrator ran it through the server tools (`SEARCH_HANDLERS.extract_profile` then `find_homes`, real `data/build`) and live in the browser. Three problems:

1. **The price cap is lost.** `priceMax` stays null, so `find_homes` returns 12억–37억 homes.
   - `profile.js:545-546` only anchors the price on `매매|매매가|집값` (or English buy/purchase/price).
   - "9억 이하로 집을 사고 싶어요" has none of them.
   - The live map filter showed `budget ▾` unset as well.
2. **A non-subway origin.** One candidate's origin reads `한국도심공항터미널(KCAT) → 판교 2분`.
   - That home's `station.station` is not a subway station in the network, so `findPath` fails, ride stays unknown, and the "total" is the walk alone (2 min).
   - `pickByNeighbourhood` (`homes.js:591-…`) accepts any `walk.station`.
3. **The workplace narrows the search.** In the live run Muse passed the workplace word as `regions`, so every candidate sat beside 판교 (5–7 min) and the spread never happened.
   - The `regions` description (`tools-search.js:386`) says "only when the customer named any". "판교로 출근해요" names 판교, but as the workplace.

## Change
1. **Price anchor** (`web/src/profile.js:545-546`): add buying-verb anchors to the KRW price hit. Match these when an amount is near:
   - `사고 싶|사려고|살 생각|사고 싶어|집을 사|집 사|구매|구입|내 집 마련`.
   - Never match `살 집` alone, because it means "a home to live in".
   - Keep the existing anchors and their order: `매매|매매가|집값` first, then the new verbs, then English.
   - **Tenure.** When this anchor fires and no tenure word was said, the tenure becomes `trade` with source `customer` (evidence = the verb phrase), not `default`.
   - **Cash stays cash.** "모은 돈 3억" must still go to `cash`, and "9억 이하로 집을 사고" to `priceMax`. The money nearest to the verb wins.
2. **Origins must ride** (`web/src/homes.js` `pickByNeighbourhood`): a row takes part only when one of these holds:
   - `r.commute.ride.known && Number.isFinite(r.commute.ride.minutes)`;
   - `r.commute.sameStation || r.commute.ride.sameStation`.

   Rows whose walk station has no path to the workplace are left out of the spread, the same way origin-less rows are today. The no-origins fallback (`rows.slice(0, limit)`) stays for US rows.
3. **The workplace is not a region** (`web/src/consult/tools-search.js` `find_homes`, `:217-231`):
   - **Drop workplace regions.** When the sort is `areas` and `args.regions` is given, drop every region name that equals a workplace's `text` or `resolved.station` (compare with and without a trailing `역`). If nothing is left, search all regions.
   - **Report it.** Add `regions_ignored: [...]` to the result when something was dropped.
   - **Tool description** (`:386`): `regions` → "Region ids/words where the customer wants to LIVE, only when they named one. Never the workplace (출근지) — the default 동네별 sort already spreads homes around it."

## Test — new `web/tests/neighbourhood-fixes-36b.test.js`
- **Price:**
  - `extract_profile("예비부부예요. 둘 다 판교로 출근해요. 모은 돈 3억, 9억 이하로 집을 사고 싶어요.")` gives `priceMax` 900,000,000, `cash` 300,000,000 and tenure `trade` from source `customer`.
  - "혼자 살 집 찾아 줘, 모은 돈 1억" leaves `priceMax` null.
  - "강남 출근, 매매 9억 이하" still gives 900,000,000.
- **Origins:** with a synthetic row whose `walk.station` is `X터미널` and `ride.known` false (walk 2 min), plus rows at three stations with known rides, `pickByNeighbourhood` leaves out the `X터미널` row.
- **Regions:** with a fake session (follow the shape in `tests/` that calls `SEARCH_HANDLERS.find_homes`, or build one as `{ context:{}, loadHomes, loadRegion, loadTransit }`):
  - `find_homes({ profile with workplace 판교, regions: ["판교"] })` returns `regions_ignored` containing `판교` and searches all regions;
  - `regions: ["잠실"]` with workplace 판교 keeps 잠실.
- **Real data (skip when `data/build` is missing):** the server path for the sentence above returns candidates that are all ≤ 900,000,000 and come from ≥ 3 distinct origin stations. No origin label contains `터미널` or `(KCAT)`.
- **Keep green:** every test that mentions `extract_profile`, `priceMax`, `pickByNeighbourhood` or `find_homes`.

Run only:
```
cd web && node --test tests/neighbourhood-fixes-36b.test.js $(grep -lE "extract_profile|priceMax|pickByNeighbourhood|find_homes" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/engine/**`, `src/money/**`, `relay/**`, `data/`, `README*`, `scenarios/`.

## Final message
Changed files, one line each. Old tests you changed, with why. Nothing else.

# Stage 36a — candidates compare neighbourhoods: 잠실 → 판교 / 강남 → 판교 / 미금 → 판교 (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md` (Astryx first, tokens, no `text-overflow: ellipsis`, never 13 px). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
The customer said (2026-11-01): "옵션을 고를 때, 강남→판교 출퇴근 이렇게 비교할게 아니라 잠실 → 판교 / 강남 → 판교 / 미금 → 판교 이런 형태로 비교해야지."

Today `find_homes` defaults to `commute` (출퇴근 짧은 순), so all 6 candidates sit next to the workplace.
- A real run, "강남역 근처 출근, 9억 이하 매매", gave 6 homes within 1.5 km of 강남역, each 3–5 min away.
- There is nothing to compare: the question a buyer weighs is *which neighbourhood*, with the workplace fixed.

## Change
1. **New default sort `areas` (동네별)** in `web/src/homes.js`.
   - `:28-40`:
     - `HOME_SORTS = ["areas", "commute", "monthly", "deals", "priority"]`;
     - `DEFAULT_HOME_SORT = "areas"`;
     - `HOME_SORT_KO.areas = "동네별로 한 곳씩"`;
     - `HOME_SORT_SHORT_KO.areas = "동네별"`.
   - In `find_homes` (`:577-726`), after `sortResults` returns `sorted` (`:706`) and only when `sort === "areas"`, replace `sorted.slice(0, limit)` with `pickByNeighbourhood(sorted, limit, commuteMax)`.
   - Make `sortResults` treat `areas` like `commute` for ordering, so `sorted` is commute order. Set its note to `정렬: 동네별로 한 곳씩 (가까운 동네부터 먼 동네까지 고르게)`.
2. **`export function pickByNeighbourhood(rows, limit, commuteMax)`** (pure, in `homes.js`):
   - **Origin.** The origin of a row is `r.commute.walk.station` when `r.commute.walk.known`. Rows without one have no origin and are left out of the spread.
     - If *no* row has an origin (US rows carry `commute.work` instead), return `rows.slice(0, limit)` unchanged.
   - **Commute minutes.** A row's minutes = walk + ride, the same total as `commuteRowLine` (`ui/candidate-card.jsx:129-151`).
   - **Default cap.** When `commuteMax` is null, use a cap of 60 minutes and mark it as assumed: add `commute_cap: { minutes: 60, source: "default" }` to the result.
     - Rows above the cap are dropped.
     - A cap the customer gave is used as is, with `source: "customer"`.
   - **One per origin.** Within each origin keep one representative: the first in `rows` order (commute order, so the shortest walk to that station). Thin-deal rows only when nothing else exists for that origin.
   - **Spread.** Sort origins by minutes.
     - If there are `limit` or fewer, take all of them.
     - Otherwise take `limit` origins spread evenly from the shortest to the longest: index `round(i × (n − 1) ÷ (limit − 1))` for `i = 0 … limit − 1`, de-duplicated.
     - The workplace's own station may be one of them (it is a real option).
   - **Labels.** Every returned row gets:
     - `origin: { station, dest: r.commute.destStation, label_ko: "잠실 → 판교" }` (station names as in the data, no 역 suffix added);
     - `commute_total_min`.
   - **Order.** Rows come back in ascending `commute_total_min`.
   - `find_homes` returns `commute_cap` next to `sort_note` when the spread ran.
3. **Card and pin line** (`ui/candidate-card.jsx` `commuteRowLine`, `:129-151`): when `candidate.origin` exists and ride and walk are known, the text reads `잠실 → 판교 총 41분 · 잠실역 걸어서 7분 + 지하철 34분`. Without `origin`, keep today's text. `pinCardModel` already uses this function.
4. **Sort tabs** (`ui/chat.jsx:501-509`) map over `HOME_SORTS`, so `동네별` shows first automatically. Check that the tab row still fits at 390 px. If it does not, let the tabs wrap; no ellipsis.
5. **Muse's instructions** (`consult/agent.js`): after the 매매 sentence (`:75`), add:
   > "후보는 직장을 고정하고 서로 다른 동네에서 한 곳씩 고른다(find_homes 기본 정렬 '동네별'). 비교는 '잠실 → 판교 41분 / 강남 → 판교 25분 / 미금 → 판교 12분'처럼 출발 동네와 직장으로 말한다. 직장 바로 옆 집만 늘어놓지 않는다. 고객이 출퇴근 시간 상한을 말하지 않았으면 60분 안쪽을 정해 둔 값으로 쓰고 그렇다고 밝힌다."
   - Add the same rule to the English agent text wherever 35c put the English 매매 rule.
   - In `find_homes`'s tool description (`consult/tools-search.js:380`), change "Sorting is the customer's choice (default 출퇴근 짧은 순, shown)" to "Sorting is the customer's choice (default 동네별: one home per neighbourhood, spread from near to far within the commute cap, shown)". Add `areas` to the `sort` parameter description (`:386`).

## Test — new `web/tests/by-neighbourhood-36a.test.js`
- **Spread:** a synthetic index with homes at 6 origin stations whose commutes to `판교` are 5/12/20/28/41/55 min, plus a second home at the 12-min station. `pickByNeighbourhood(..., 4, null)`:
  - returns 4 rows from 4 distinct stations, including the 5- and 55-min ones;
  - rows ascend by minutes;
  - each row has `origin.label_ko` like `X → 판교`;
  - the result says the cap is 60 with source default.
- **Cap:** with `commuteMax` 30, no row is over 30 and the cap source is customer.
- **No origins:** rows without `commute.walk.known` (US style with `commute.work`) come back as `rows.slice(0, limit)`.
- **Default:** `DEFAULT_HOME_SORT === "areas"`, and `HOME_SORTS[0] === "areas"`.
- **Card line:** `commuteRowLine` for a candidate with `origin` starts with `잠실 → 판교 총`. Without `origin` the text is unchanged.
- **Agent:** the Korean and English agent text contains the 동네별 rule.
- **Real data:** if `data/build/homes/*.json` and the network files exist locally, run the real `find_homes` path the way existing tests do (find one that loads real homes, e.g. grep `homes-index` in tests). Use a 판교 workplace with 매매 9억, and expect at least 3 distinct `origin.station` values. Skip when the data is missing (CI has no data).
- **Old tests:** update existing tests only where they pinned `DEFAULT_HOME_SORT === "commute"`, the sort-tab order or the first candidate being the shortest-commute home. Name each in the final message.

Run only:
```
cd web && node --test tests/by-neighbourhood-36a.test.js $(grep -lE "DEFAULT_HOME_SORT|HOME_SORTS|find_homes|commuteRowLine|pinCardModel|sort_note" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**` (the orchestrator adds English), `src/engine/**`, `src/money/**`, `relay/**`, `data/`, `README*`.

## Final message
Changed files, one line each. Old tests you changed, with why. Nothing else.

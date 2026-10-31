# Stage 36h4 — public rentals measure distance from the real workplace, not the home station (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (2026-11-01)
`data/build/sim/demo-two-homes-money.json`:
- `public_listings.workplace` is `{label: "송파나루역", area: "st-송파나루"}`.
- `workplace_note` is `직장(송파나루역)에서 직선 거리예요`.

The couple works in 판교. The scenario says so twice: `household.members[0].work.destination_station {A: 판교, B: 판교}` and `work.place {name: "직장 (가정: 판교역 인근)", lon: 127.111187, lat: 37.394364}`.

Cause, in `findWorkplace` (`web/scripts/money.mjs:408-445`):
1. It looks for station POIs only in the loaded home areas (`areasById`), so 판교 is never found.
2. It then falls back to `work.station_name`. That is the station each home **boards at**, not the workplace.

The money tab shows this under `직장: … ·` (`web/src/ui/listings.jsx:271`).

## Change (`findWorkplace`)
Use these in order:
1. **`work.place` with finite `lon`/`lat`** → `{label: <place.name>, lon, lat, area: null}`. Show the label as written (`직장 (가정: 판교역 인근)`).
2. **Else `work.destination_station`** (string, or the first value of the per-home object), resolved through:
   - the loaded areas' station POIs, as today;
   - else the region network stops (`data/build/region/network.json` `lines[].stops[]` `{name, lon, lat}`, matched with the same `matchName`), label `<name>역`.
3. **Never `work.station_name`**: that is the home's boarding station. If nothing resolves, return `null`; the existing `직장 위치를 찾지 못해서…` note shows.

Keep the note wording. With a place label it reads `직장(직장 (가정: 판교역 인근))에서…`. Avoid the double parenthesis: when the label already contains `(`, write `직장 위치(<label>)에서 직선 거리예요. 출퇴근 시간은 아니에요.` Otherwise keep today's sentence.

## Test — new `web/tests/listings-workplace-36h4.test.js`
- **Pure resolution** (export `findWorkplace` or a pure `resolveWorkplace(scenario, areasById, network)`):
  - a scenario with `work.place` → the place;
  - without a place but with `destination_station "판교"` and a fake network stop 판교 → `판교역`;
  - with only `station_name` → `null`.
- **Real build** (skip when `data/build/region/network.json` or `scenarios/demo-two-homes.json` is missing): the demo scenario resolves to lon `127.111187`, lat `37.394364`, and the note contains `판교`, not `송파나루`.
- **Keep green:** tests that mention `public_listings`, `workplace_note`, `listings.jsx` or `money.mjs`.

Run only:
```
cd web && node --test tests/listings-workplace-36h4.test.js $(grep -lE "public_listings|workplace_note|listings\.jsx|money\.mjs" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
Tests that compare against `data/build/sim/demo-two-homes-money.json` change once the orchestrator regenerates it. List them; do not edit them. If anything else still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `relay/**`, `data/`, `pipeline/**`, `README*`, `scenarios/`, `public/recorded/**`.

## Final message
Changed files, one line each. Tests waiting for regenerated data. Nothing else.

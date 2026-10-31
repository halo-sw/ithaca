# Stage 29N2f — US home ids unique across areas; the map's network follows every candidate path (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep for the rest). Stop when the named tests pass.

## Why (measured on the live page by the orchestrator)
1. **Two candidates drawn on one spot.** Live Meta HQ search: candidate 5 (515 Cleveland Street, Redwood City) and candidate 6 (553 West El Camino Real, San Carlos) both render at the same client box (555,285 72×70); 5 is invisible. Cause: `pipeline/homes_us.py:~900/916/978` restarts `seq` per area, so every area has `us-home-0001…` — 55 ids collide across the eight `homes/us-*.json` files (`us-home-0021` exists in all eight). The map and cards key by id.
2. **No Caltrain line on the live map.** The network log shows only `/data/region/network.json` fetched. The 29N2e swap (`web/src/ui/chat.jsx:~2189-2205`) runs only inside `runSearch`; the consult-agent path `appendToolCards` (`chat.jsx:~2772-2790`, `setCandidatesData` at ~2788) and the restore paths (`setCandidatesData` at ~2914, ~3025, ~3050) never swap, and the map build (`chat.jsx:~3409`, `network: dataRef.current?.network`) reads whatever was loaded before the search.

## Changes
1. **Pipeline — unique ids.** In `pipeline/homes_us.py`, ids stay in the `us-home-NNNN` shape (the 29a11 scrub regex `/\b(?:us-)?home-\d{3,}\b/` and the agent text depend on it) but get a per-area block: `us-menlo` keeps `0001…` (offset 0); each `US_CALTRAIN_BOXES` entry (`pipeline/regions.py:~415`) gets offset `1000 * (its index + 1)` → San Francisco `us-home-1001…`, Belmont `2001…`, etc. Derive the offset from the area id in one helper (`us_home_id_offset(area_id)`); an unknown area raises. Keep `{:04d}`.
2. **Web — network follows the candidates, on every path.** Move the 29N2e swap out of `runSearch` into one `useEffect` keyed on the shown candidates (`candidatesData`) and the profile currency: when `usSearchActive(profile, candidates)` differs from `dataRef.current.usNetwork`, load the other network (`loadUsNetwork(fetchJson)` / `loadNetwork(fetchJson)`), store it on `dataRef.current`, then bump a small state counter so the map re-renders. Remove the inline block from `runSearch` (one code path). Guard against a stale load finishing after the candidates changed again (compare a request token). Never show Seoul lines for US candidates; if the US load fails, show no lines rather than Seoul's.
3. **Web — defensive.** Where the map/cards build pin anchors keyed by id (`web/src/chatmap.js`, grep `byId\|\.id\b` near the candidate layout), a repeated id must not merge two homes: key by `id` + `region` (or the candidate index) so even old data with colliding ids draws both pins.

## Tests
- Python, add to `tests/test_homes_us.py` (or a new `tests/test_us_ids_29N2f.py`): `us_home_id_offset("us-menlo") == 0`, `("us-st-san-francisco") == 1000`, last box `== 7000`; building two fixture areas yields disjoint id sets; the existing menlo expectation `["us-home-0001", "us-home-0003"]` stays.
- Web, new `web/tests/map-us-ids-29N2f.test.js`:
  - `buildChatMap` (or the layout helper the map uses) with two candidates that share `id: "us-home-0021"` but differ in `region`/coords (use the two real coordinates: −122.2344163, 37.4803242 Redwood City and the San Carlos one, any nearby point) → two distinct pin anchors at different positions.
  - Source check on `chat.jsx`: the US/Seoul network swap lives in a `useEffect` that depends on the candidates, and `appendToolCards` no longer needs its own swap (assert the old inline `wantUsNow` block is gone from `runSearch`).
Keep green: `tests/map-us-live-29N2e.test.js` (update only the expectation that pinned the swap inside `runSearch`, and list it), `tests/us-corridor-29N2a.test.js`, `tests/map-us-six-29N2c.test.js`, `tests/map-frame-29M2.test.js`, `tests/us-citations-29a11.test.js`.

Run only:
```
.venv/bin/pytest -q tests/test_homes_us.py tests/test_caltrain_29N1.py 2>&1 | tail -3
cd web && node --test tests/map-us-ids-29N2f.test.js tests/map-us-live-29N2e.test.js tests/us-corridor-29N2a.test.js tests/map-us-six-29N2c.test.js tests/map-frame-29M2.test.js tests/us-citations-29a11.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`data/`, `relay/`, `briefs/`, the 30-day engine.

## Final message
Changed files, one line each, plus any pinned expectation you updated. Nothing else.

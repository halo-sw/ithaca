# Stage 29N3c — "one per neighbourhood" (sort "areas") works for US searches (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why (live)
36a made `sort: "areas"` the consult agent's default ("동네별로 한 곳씩"). A Meta HQ search now calls `find_homes` with `sort: "areas"`; `pickByNeighbourhood` (`web/src/homes.js:~694`) groups by `commute.walk.station` + a known ride, which US rows don't have, so it falls back to `rows.slice(0, limit)` → six Belle Haven homes. The 29N2a US spread (`spreadUsFirstPage`, dispatch at `homes.js:~917-937`) only runs for `sort === "commute"`.

## Change
In the dispatch at `homes.js:~917-937`: when the result is a multi-area US set (the existing `usAreas.size > 1` + all-USD test), `sort: "areas"` picks **one home per US area** in headline-commute order (`spreadUsFirstPage(sorted, limit, 1)`, then fill remaining slots in commute order if fewer areas than `limit`), and `sort: "commute"` keeps today's at-most-2-per-area first page. The sort note for US "areas" says `one home per area (closest area first)` / `동네마다 한 곳씩(가까운 동네부터)`. Korean `pickByNeighbourhood` is unchanged.

## Tests
Add to `web/tests/us-measured-first-29N3b.test.js` (or a new `us-areas-29N3c.test.js`): 12 fake US rows over 6 areas (2 each, `currency: "USD"`, `best_min` set) with `sort: "areas"`, limit 6 → six distinct regions in `best_min` order; 3 areas × 4 rows, limit 6 → 3 distinct first then commute order; a Korean `areas` fixture (reuse one from `grep -l pickByNeighbourhood tests/*.test.js`) unchanged.
Run only:
```
cd web && node --test tests/us-measured-first-29N3b.test.js $(ls tests/us-areas-29N3c.test.js 2>/dev/null) tests/us-corridor-29N2a.test.js $(grep -l "pickByNeighbourhood\|sort: \"areas\"" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`pipeline/`, `data/`, `relay/`, `briefs/`, the engine.

## Final message
Changed files, one line each. Nothing else.

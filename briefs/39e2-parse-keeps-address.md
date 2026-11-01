# Stage 39e2 — parseScenario keeps the home address (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Touch only `web/src/engine/scenario.js` and one new test.

## Why (diagnosed)
39e copies `address` into `scenarioFromProfile` homes, but the relay's `build_scenario` (`web/src/consult/tools-search.js:385-395`) returns `parseScenario(...)`, and `parseScenario` rebuilds each home as `{ label, area, complex_name, lon?, lat? }` (`web/src/engine/scenario.js:379-386`). The address is dropped, so a live run's 3D home pill still shows no road address.

## Change — `web/src/engine/scenario.js:379-386`
After the lon/lat copy: when `h.address` is an object with a non-empty string `road`, set `out.address = { road: h.address.road, sigungu: typeof h.address.sigungu === "string" ? h.address.sigungu : "" }`. Any other `address` value is ignored (no error). Nothing else changes.

## Test — new `web/tests/scenario-address-39e2.test.js`
- `parseScenario` on a minimal valid scenario (reuse the fixture of an existing parseScenario test) whose home has `address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구" }` keeps it on `homes[0].address`.
- Without `address`, no `address` key; with `address: "x"`, no `address` key and no throw.

Run only:
```
cd web && node --test tests/scenario-address-39e2.test.js tests/home-address-3d-39e.test.js $(ls tests/*scenario*.test.js | head -5 | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed lines and the test counts.

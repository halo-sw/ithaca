# Stage 39e3 — last address hop + the complex sub regression (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Touch only `web/src/chat/engine.js`, `web/src/main.js` and one new test.

## Why (diagnosed on the live English run)
1. The in-browser chat path builds the scenario homes with `homeForScenario` (`web/src/chat/engine.js:386-402`), which copies `id, name, scene, pnu, station, lon, lat` (+ `commute`) and drops the candidate's `address`. So `scenarioFromProfile` (39e) never sees it and the 3D home pill still has no road-address line.
2. Regression from 39e in `web/src/main.js` (~line 1781-1787): `sub.setAttribute("data-no-i18n", "")` is applied to EVERY sub line in English, including the complex pills ("최고 15층"), which used to be translated by the DOM translator ("max 15 floors"). On the English phone run they now stay Korean.

## Changes
1. `homeForScenario`: when `candidate.address` is an object with a non-empty string `road`, set `home.address = { road, sigungu: typeof sigungu === "string" ? sigungu : "" }`.
2. `main.js` painter: put `data-no-i18n` and the `subEn` choice only on the home pill's sub (the `home:` accent item). Complex subs go back to exactly the pre-39e behavior (`sub.textContent = item.sub`, no attribute).

## Tests — new `web/tests/home-address-path-39e3.test.js`
- `homeForScenario({ id: "h1", name: "X", scene: "st-x", lon: 127, lat: 37.5, address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구" } })` keeps the address; without one, no `address` key.
- Source pin on main.js: the `data-no-i18n` line sits inside a branch that tests the `home:` id, and the complex sub branch assigns `item.sub` without `data-no-i18n`.

Run only:
```
cd web && node --test tests/home-address-path-39e3.test.js tests/home-address-3d-39e.test.js tests/scenario-address-39e2.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed lines and the test counts.

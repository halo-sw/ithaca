# Stage 39e — the 3D home pill shows the road-name address (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. A parallel run (39d) edits translate.js / mapwalk.js / romanize.js; touch only the files named here.

## Why
39c gave the home label item `sub` (Korean road) and `subEn` (English road via `roadAddressEn`) in `labelItemsFor` (`web/src/labels3d.js:241-253`), read from `opts.homeCandidate.address`. On a live run the pill still reads only "우리 집 · 강남역 센트럴 푸르지오 시티" (English "Our home · …"), because:
1. `scenarioFromProfile` (`web/src/profile.js:1270`) copies only `label, area, complex_name, lon, lat` from the picked home — the candidate's `address: { road, sigungu }` (39c2) is dropped.
2. `paintLabels20b` (`web/src/main.js:1802-1810`) never passes `homeCandidate`.
3. The painter (`web/src/main.js:1774-1785`) and the box size (`main.js:1828-1830`) draw a sub line only for `item.level === "complex"`; the home pill is level `"always"`.

## Changes
1. `web/src/profile.js:1270` — when `home.address` is an object with a non-empty string `road`, add `out.address = { road: home.address.road, sigungu: home.address.sigungu || "" }`. Nothing else in the scenario changes.
2. `web/src/main.js` `paintLabels20b` — pass `homeCandidate: homeEntry && homeEntry.address ? { address: homeEntry.address } : null` to `labelItemsFor`.
3. `web/src/main.js` painter and box: treat a home item (`item.accent` and `item.id` starting with `"home:"`) that has `sub` like a complex item with a sub line: two lines, centered, sub at 10px in the existing accent sub color `#dbe6ff`. The sub text is `currentLang() === "en" ? (item.subEn || item.sub) : item.sub`. In English mode the sub node gets `data-no-i18n` (it is already English). The box width/height call uses the same rule (`labelBoxW(item.title, lang, { sub, subEn, glyph })`, height 36 when a sub line shows). Other items unchanged.

## Tests — new `web/tests/home-address-3d-39e.test.js`
- `scenarioFromProfile` with one picked home carrying `address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구" }` gives `scenario.homes[0].address` equal to that; a home without `address` gives no `address` key. Reuse the fixture of an existing `scenarioFromProfile` test.
- `labelItemsFor(area, { homeBuildingId, homeCandidate: { address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구" } } })` home item: `sub === "천호대로157길 45"`, `subEn === "45 Cheonho-daero 157-gil, Gangdong-gu, Seoul"` (reuse a minimal area fixture from an existing labels3d test).
- `labelBoxW("우리 집 · X", "en", { sub: "천호대로157길 45", subEn: "45 Cheonho-daero 157-gil, Gangdong-gu, Seoul" })` is at least as wide as the English sub alone.
- A source pin for main.js is fine (the file is not unit-loadable): the painter's sub condition mentions `home:` and `subEn`.

Run only:
```
cd web && node --test tests/home-address-3d-39e.test.js tests/english-names-39c.test.js tests/labels3d*.test.js tests/profile*.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each, plus any old pins changed (old → new).

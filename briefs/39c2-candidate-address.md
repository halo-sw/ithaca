# Stage 39c2 — home candidates carry the road-name address (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. A parallel run (39c) edits romanize/labels/candidate-card; touch only the files named here.

## Why
39b gave every Korean home in the index `address: { road, sigungu }`. `find_homes` builds each candidate from a fixed field list (`web/src/homes.js:870-890`) and drops it, so the card and the 3D label never see it.

## Change — `web/src/homes.js:882-884` only
After `osm_name: …,` add:
```
      ...(home.address ? { address: home.address } : {}),
```

## Test — extend `web/tests/` with `homes-address-39c2.test.js`
`find_homes` over a one-home index whose home has `address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" }` (reuse the minimal index fixture of an existing `find_homes` test) returns a candidate with that same `address`. A home without `address` gives a candidate with no `address` key.

Run only:
```
cd web && node --test tests/homes-address-39c2.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each.

# Stage V3 — video tests follow the real script instead of pinning v1 (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no build, no render. Branch `video-demo`, folder `video/` only. Stop when this part is done.

## Why
The orchestrator replaced `data/script.json` with v2.0 (107 s, 11 scenes) and `data/stats.json`. Two tests pinned v1 content and now fail:
- `tests/timeline.test.js:24` "total duration is the end of the last scene" expects 5400 frames (180 s).
- `tests/copy.test.js:95` "real meta rows: last row drops, first three stay" reads the meta scene's `rows_en`; v2 uses `table_en`.

## Change (tests only)
1. `timeline.test.js:24`: derive the expected total from the real file (`last.start + last.duration` × fps), and keep the fixture-based checks as they are.
2. `copy.test.js:95`: test the real meta scene through whichever list it has (`table_en` via `fillTable`, else `rows_en` via the old path). Assert that every row with only non-null stats stays and that a row with a null stat drops (use a copied stats object with one key set to null, e.g. `spark_open_same`).
Never edit `data/*.json` or `src/`.

Run only (**run it before you finish**):
```
cd video && npm test 2>&1 | tail -15
```

## Final message
Changed files, one line each. Nothing else.

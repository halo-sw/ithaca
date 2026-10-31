# Stage 29N1d — No "· 2" home names: same-name buildings are one home (pipeline, brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite. Run the pipeline only on fixtures. First edit within 3 tool calls. Stop when the named tests pass.

## Why
After 29N1c the US homes still carry disambiguation suffixes: `1221 Willow Road · 2`, `275 Hawthorne Avenue · 1`, `Apartments on Laurel Street · 8` (Sunnyvale 40, San Carlos 17, Menlo 6, Mountain View 6, Belmont 3, Redwood City 3, Palo Alto 2). They appear on cards and in Muse's answers.

## Changes (`pipeline/homes_us.py`)
- Before suffixing, homes in one area whose base display name is identical (same address or same name) and whose centroids are within 200 m merge into one home (largest building's centroid, `buildings: n`, max levels) — like 29N1c's complex rule.
- If two same-name homes are farther apart than 200 m, distinguish them by their street address when it differs (`Ironworks Apartments, 1000 Alma St`), never by `· n`. Only if nothing distinguishes them keep `· n`.

## Tests — extend `tests/test_caltrain_29N1.py`
- Two `1221 Willow Road` buildings 40 m apart → one home `1221 Willow Road`, `buildings: 2`.
- Two `Ironworks Apartments` 600 m apart with different addresses → names carry the address, no `· `.

Run only:
```
.venv/bin/pytest -q tests/ -k "caltrain or homes_us or boxes or regions or us_area" 2>&1 | tail -3
```

## Do not touch
`web/`, `relay/`, `data/`, `briefs/`.

## Final message
Changed files, one line each. Nothing else.

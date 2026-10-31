# Stage 29N1c — US complexes: buildings inside a named residential area are one home named after it (pipeline, brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite. Run the pipeline only on test fixtures. First edit within 3 tool calls. Stop when the named tests pass.

## Why — orchestrator rebuild after 29N1b
- **Anton Menlo is still missing.** In OSM it is `way 704937327: landuse=residential, name=Anton Menlo Park`; its buildings are `building=apartments, name=Building A|B|C, addr:housenumber=3639, addr:street=Haven Avenue` (one is relation 14879282, a multipolygon). `NO_NAME_RE` (`^Building\s+\S+$`) rejects those names and the named node from 29N1b is only the polygon's first vertex, so nothing names them.
- **Mountain View** homes are now named `A`, `B`, `C` — buildings of complexes whose names live on the surrounding area.
- San Carlos shows `Apartments on Laurel Street · 2`, `· 8` — one complex split into numbered homes.

## Changes (`pipeline/homes_us.py`, reuse the Korean complex idea in `pipeline/complexes.py` where it fits)
1. Read named `landuse=residential` (and `residential=*` / `building=apartments` area) **polygons and multipolygons** in the area extract.
2. Candidate buildings whose centroid lies inside such a polygon form **one home per polygon**: name = the polygon's name with a trailing ` Park`/` Apartments` kept as-is (`Anton Menlo Park`), coordinate = the largest building's centroid, `buildings: <count>`, `levels_max`, address from the buildings if they share one (`3639 Haven Avenue`), `match: "osm_area_name"`. Building-letter names (`A`, `Building C`, digits) never become home names.
3. Buildings sharing one `addr:street` + `addr:housenumber` and one name stem (`Apartments on Laurel Street · 2`, `· 8`) outside any named polygon merge into one home the same way.
4. Single-letter or `Building X` names alone are not names: address, else the existing fallback.
5. Everything else (ZIP rent, station, commute modes, `best`) is computed once per resulting home exactly as 29N1/29N1b do.

## Tests — extend `tests/test_caltrain_29N1.py`
- Fixture: a named residential polygon with three `Building A/B/C` apartments inside → one home `Anton Menlo Park`, `buildings: 3`, address `3639 Haven Avenue`.
- A multipolygon variant works the same.
- Single-letter names outside any polygon fall back to the address.
- Two `Apartments on Laurel Street` buildings at one address merge into one home.

Run only:
```
.venv/bin/pytest -q tests/ -k "caltrain or homes_us or boxes or regions or us_area" 2>&1 | tail -3
```

## Do not touch
`web/`, `relay/`, `data/`, `briefs/`.

## Final message
Changed files, one line each, and the rebuild command. Nothing else.

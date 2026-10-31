# Stage 29N1e — Street-named US homes without "· n" (pipeline, brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite. Run the pipeline only on fixtures. First edit within 3 tool calls. Stop when the named tests pass.

## Why
After 29N1d, unnamed buildings named after their street still get numbers: San Carlos `Apartments on Laurel Street · 1/2/6/8`, `Apartments on Oak Street · 1/2`; Sunnyvale `Apartments on North Sunnyvale Avenue · 5/6/7/8` (two of them have an address: `158 North Sunnyvale Avenue`, `174 North Sunnyvale Avenue`), `Apartments on Oak Court · 9`. 17 such names in San Carlos, 29 in Sunnyvale.

## Changes (`pipeline/homes_us.py`)
1. A home that has an address (own tags or `nearest_address` within 30 m) is named by it (`158 North Sunnyvale Avenue`), never by the street template.
2. Street-template homes (no name, no address) on the same street within 150 m of each other merge into one home: `Apartments on Laurel Street`, `buildings: n`.
3. If the same street template still repeats in the area (clusters farther apart), name each by the nearest cross street from the area roads: `Apartments on Laurel Street near Arroyo Avenue`. Only if that still collides, keep `· n`.

## Tests — extend `tests/test_caltrain_29N1.py`
- Three unnamed buildings on one street within 100 m → one home `Apartments on Laurel Street`, `buildings: 3`.
- An unnamed building with an address 20 m away is named by the address.
- Two street clusters 600 m apart → `… near <cross street>` names, no `· `.

Run only:
```
.venv/bin/pytest -q tests/ -k "caltrain or homes_us or boxes or regions or us_area" 2>&1 | tail -3
```

## Do not touch
`web/`, `relay/`, `data/`, `briefs/`.

## Final message
Changed files, one line each. Nothing else.

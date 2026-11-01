# Stage 39b — every Korean home carries its road-name address from the RTMS rows (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named test passes. A parallel run (39a) is editing `web/**`; do not touch it.

## Why
The user wants English screens to show Korean homes by their road-name address in English (도로명주소 영문), not by a romanized name like "Eseukeiheobeujin". Every RTMS CSV row (`data/raw/rtms/*.csv`, cp949 website exports) already has a `도로명` column, e.g. `중앙공원로 17`. Of 231,917 rows, 792 have it empty. The pipeline drops it today.

## Change (`pipeline/homes.py`)
1. **Row parse** (`:100-134`, both the trade and the rent dicts): add `"road": (rec.get("도로명") or "").strip()`.
2. **Home** (`:592-610`): add `"address": {"road": <mode of the group's non-empty row roads, ties → lexicographically first>, "sigungu": <mode of the group's row sigungu>}`. Use `None` for a value that is missing.
3. **Slim index entry** (`:725-747`): pass `"address": home.get("address")` through.
4. Nothing else changes. Keep ids, order and every other field byte-identical for the same input.

## Test — extend `tests/test_homes.py`
- A two-row group whose rows have roads `["천호대로157길 45", "천호대로157길 45"]` and sigungu `서울특별시 강동구 천호동` gives `address == {"road": "천호대로157길 45", "sigungu": "서울특별시 강동구 천호동"}` on the home and on its slim index entry.
- A group whose rows have empty roads gives `address.road is None`.
- An existing test still passes unchanged: ids and the other fields are unaffected.

Run only:
```
.venv/bin/pytest -q tests/test_homes.py 2>&1 | tail -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`web/**`, `data/`, other `pipeline/*.py`, `README*`.

## Final message
Changed files, one line each. Nothing else.

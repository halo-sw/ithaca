# Stage 29N4b — the public data bundle carries region-us (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full test suite. First edit within 2 tool calls.

`web/scripts/runtime-data-list.mjs:~12-21` ships `.json`/`.csv` under `homes/`, `region/`, `sim/`, `walkgraph/` only. The US Caltrain network lives in `region-us/` (`network.json`, `caltrain-am.json`), so the public site returns 404 for `/data/region-us/network.json` and US runs/maps fall back to no lines. Add `region-us` to the shipped subtrees (same rules as `region/`), update the header comment, and extend the script's existing test (grep `runtime-data-list` in `web/tests/`) with a fixture `region-us/network.json` that must be listed.

Run only:
```
cd web && node --test $(grep -l "runtime-data-list" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
Final message: changed files, one line each. Nothing else.

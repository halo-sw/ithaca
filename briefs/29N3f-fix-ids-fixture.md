# Stage 29N3f — 29N2f id test fixture needs a station walk (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full test suite. First edit within 2 tool calls.

29N3e made `pipeline/homes_us.py` drop station-box homes with no station walk. `tests/test_us_ids_29N2f.py::test_two_areas_yield_disjoint_id_sets` builds a `us-st-san-francisco` fixture whose homes have no reachable Caltrain station on the fixture graph, so both are now dropped (`assert len(sf) == 2` gets 0). Give that fixture a Caltrain station POI connected on its walk graph (the way `tests/test_homes_us.py`'s new 29N3e test or `tests/test_caltrain_29N1.py` builds one), so the two homes keep a station walk. Do not change `homes_us.py` or weaken the assertion.

Run only:
```
.venv/bin/pytest -q tests/test_us_ids_29N2f.py tests/test_homes_us.py tests/test_caltrain_29N1.py 2>&1 | tail -2
```
Final message: changed lines, one line. Nothing else.

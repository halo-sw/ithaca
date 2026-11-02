# Stage 43b7 — update one 43b5 source check for 43b6 (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Edit only `web/tests/coverage-chips-43b5.test.js`, lines 61–68 (the `describe("43b5 handleCoverageChip sends turns"` block). Every other line stays.

43b6 made `handleCoverageChip` use the direct path (`liveResearch`, `handleTrayWorkplace`, `handleTrayNoCommute`) when `dataRef.current` is loaded and `send(` otherwise. Change that one `it` so it asserts: the body contains `send(`, contains `dataRef.current`, and the `send(` calls sit in the branch taken when the rule data is not loaded. Rename the `describe`/`it` titles to match.

Run only: `cd web && node --test tests/coverage-chips-43b5.test.js tests/coverage-label-43b6.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.

## Final message
One line: the changed file.

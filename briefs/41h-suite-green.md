# Stage 41h — make the suite green after 41d/41d2/41g (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why
41d/41d2 removed public rental (owner decision: the product no longer offers it; keep only the `isPublicRentalHome` exclusion filter at `web/src/homes.js:92`). 41g fixed Meta HQ details but ran out of steps. Full suite now: 3170 tests, 3143 pass, **25 fail**. Failing tests:

- Old public-rental expectations (update or delete; a test that only checked public rental is deleted, a test that also checks other tenures keeps those cases):
  `32a SSR chat shell` (chip count 3 → 2), `compare tab groups`, `support_programs tool`, `search tool defs`, `find_public_rentals tool`, `18-1 public rentals never appear in jeonse/wolse/trade results` (keep: it guards the exclusion filter — fix its imports, not its intent), `demo tour step machine`, `tests/find-homes.test.js`, `glossary`, `explainLoadError`, `money format`, `tenure costs (worked examples)`, `orb data builder`, `26y find_homes (US)`, `sources page data`, `stage 10b UI render smoke (SSR, no DOM)`, `27f walkthrough fixes`.
- `source scan: no public rental strings in web/src` (`web/tests/no-public-rental-41d.test.js`): its allowlist uses `path.join("money","homes.js")` but the filter lives in `web/src/homes.js` — fix the allowlist path (test bug). Any other hit it reports is a real leftover: remove it from the source.
- 41g's own tests (`web/tests/meta-hq-details-41g.test.js`):
  - Korean Meta HQ sentence: the test helper misreads `extract_profile`'s return shape — use the real shape.
  - Diary tolerates Spark Open: empty content gives zero failures so no retry fires; assert rule-diary lines after 1 call for empty content, and use a throwing first call for the retry path (2 calls).
  - Report check tolerates Spark Open: inspect and fix (fixture or code).
- 41g leftovers (production wiring): stamp the 30-day run mode onto the picked candidates after a run so the pin and card headline use it (`commuteMinutesOf(c, runMode)`), and make the client diary/report calls use the same baseten → meta fallback as chat (41f `basetenFallbackProvider`).

Before changing any test, run it alone and read the failure. If a failure shows a real source bug (a crash, a missing import, a broken render), fix the source, not the test.

## Run
At the end, once: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -30`. Also `cd .. && .venv/bin/pytest -q tests 2>&1 | tail -3`.

## Final message
Tests deleted or changed (old → new) one line each, source files changed one line each, and the two suite summary lines.

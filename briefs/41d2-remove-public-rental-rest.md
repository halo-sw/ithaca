# Stage 41d2 — finish removing public rental (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

> Parallel run: 41g (Meta HQ details: `ui/agent-float.js` US citations, `ui/landing-page.jsx`, map pins, 3D labels, report text join, diary) runs at the same time in this tree. Re-read a shared file right before each edit and change only your own lines.

## Why
41d (`briefs/41d-remove-public-rental.md`, read it for the full rule) ran out of steps halfway. Done: profile, tenure.js, worthit.js, custom-money.js, format.js, homes.js (keeps the `isPublicRentalHome` exclusion filter), sources.js, glossary.js, copy.js, share.js, store.js, and `web/tests/no-public-rental-41d.test.js`. The tree is broken right now:

`web/src/consult/tools-search.js` still imports `NO_PUBLIC_RENTAL_NOTE` from `../homes.js` → `SyntaxError ... does not provide an export named 'NO_PUBLIC_RENTAL_NOTE'`, so relay and agent tests cannot load.

## Do, in this order
1. Fix the broken import first (`consult/tools-search.js`: remove `find_public_rentals` and the note).
2. Then the rest of the 41d list:
   - `consult/agent.js` prompts and dispatch cases; `consult/tools-money.js` `recommend_public_rental` and `include_public_rental`; `consult/tools.js:228`; `consult/guards.js:759`.
   - `ui/chat.jsx` public-rental chip, branch and US note; `ui/money.jsx` TENURES and the CandidateRow public section; `ui/support.jsx:139-141`; `ui/listings.jsx` public sub-tab; `ui/app.jsx:955,1079` source line; `ui/worthit.jsx`.
   - `ui/agent-float.js` public-rental labels, links and tab (only those entries; 41g edits the US citation logic in the same file).
   - `orb.js` / `ui/orb.jsx` publicRental; `load-error.js` rentals label; `verify/compare.js` wolse/public branch; `engine/scenario.js` TENURE_KINDS.
   - `ui/demotour.js:34-35` public step and `web/tests/demotour.test.js`.
3. Update or delete the old public-rental tests: `find-homes`, `consult-search`, `consult-tools`, `server-us-homes-26y`, tenure/chip listing tests. A test that only checked public rental is deleted; a test that checked other tenures too keeps those cases.
4. Run the full suite once at the end: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head -20`. Fix failures you caused (at most 2 rounds); list any others.

## Final message
Changed files, one line each; tests deleted or changed (old → new); the suite's pass/fail line.

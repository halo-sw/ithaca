# Stage 39d3 — segment split only after whole-string matches miss (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Touch only `web/src/i18n/translate.js`.

## Why (diagnosed)
The 39d segment block sits at the very top of `translateCore`, so it now wins over whole-string phrases and patterns that themselves contain " · ". The full suite has 8 failures, e.g. "앉아서 출근: A 12/20일 · B 3/20일 (혼잡 34% 이하 실측)" used to match its whole pattern ("Got a seat on the way to work: A 12/20 days · B 3/20 days (measured crowding ≤ 34%)"); now each piece is translated alone and the first piece is romanized ("Anaseo Gan commute: …"). Failing suites: createTranslator, 29c1 English, 29a6c evening moment, 29a6e replay bar, 29a2 candidate list (8 subtests).

## Change
Order inside `translateCore`:
1. Whole-string exact phrase and every pattern EXCEPT the bare joiner pattern (a pattern whose `ko` is made only of slots and " · ", i.e. `{ ko: "{0} · {1}" }` at `en.js:736`) — with the existing money-first localization pass exactly as before. If any of these hits, use it (old behavior).
2. Only when step 1 misses and the core contains " · ": the 39d segment block (split the un-localized core, `translateCore` each piece, accept only when every piece is Hangul-free).
3. Otherwise the rest as before (bare joiner pattern, chip frames, word/name fallback).
The simplest correct way is fine (e.g. a flag to `exactOrPattern` that skips joiner-only patterns on the first try). Keep 39d2's `result === undefined` guard.

Run the five failing files plus 39d:
```
cd web && node --test tests/english-leftovers-39d.test.js $(grep -l "createTranslator\|29c1 English\|29a6c evening moment\|29a6e replay bar\|29a2 candidate list" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed lines and the test counts.

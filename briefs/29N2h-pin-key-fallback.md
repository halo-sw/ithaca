# Stage 29N2h — pins without `key` keep their own identity (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
29N2f made `web/src/ui/chatmap.jsx` key layout identity, geometry lookup, clustering and React keys by `pin.key` (`id::region::index`, set in `web/src/chatmap.js`). Pins that reach `ChatMap` without `key` — the test helper `pin()` in `tests/walk-19g.test.js`, and restored/old map docs — all share `undefined`, so they merge: `walk-19g` "ChatMap draws no leader for one pin, leaders for a close pair" now fails (4 pins render with no leaders). It passed before 29N2f.

## Change
One helper in `chatmap.jsx` (or `chatmap.js`, exported), e.g. `pinKeyOf(pin, index)` = `pin.key` if set, else `` `${pin.id}::${pin.region || ""}::${index}` `` — and use it everywhere 29N2f/29N2g read `pin.key`. No other behaviour change.

## Tests
Add to `web/tests/map-us-ids-29N2f.test.js`: `ChatMap` with two key-less pins of different ids at nearby coords renders two pin tags (and a key-less duplicate-id pair still renders two).
Run only:
```
cd web && node --test tests/walk-19g.test.js tests/map-us-ids-29N2f.test.js tests/map-pill-29N2g.test.js tests/map-frame-29M2.test.js tests/map-us-six-29N2c.test.js tests/map-stations-29L3.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`pipeline/`, `data/`, `relay/`, `briefs/`, test expectations other than the new ones.

## Final message
Changed files, one line each. Nothing else.

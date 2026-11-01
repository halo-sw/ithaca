# Stage 38g2 — one more stale demo-tour pin (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call.

## Change — `web/tests/demotour.test.js:106` only
Replace
```
    assert.match(rec.a, /용답역 근처 연립·다세대 \(291-22\).*4\.35억/);
```
with
```
    assert.match(rec.a, /서울숲 더샵.*6\.4억/);
```

Run only:
```
cd web && node --test tests/demotour.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each.

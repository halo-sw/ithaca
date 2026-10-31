# Stage 29L2d — English Today list: rewrite only Home and Work rows, keep the translated ride rows (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
After 29L2c (orchestrator capture, English, `?mode=sim&home=A&day=3&t=18:40`), the Today list romanises whole Korean rows instead of translating them, and drops the minutes and crowding:
```
before 29L2c:  Line 2 Jamsil→Gangnam (9 min, crowding 91%)   Gangnam transfer 4 min   Jamsil (14 min walking)   Lake Palace
after 29L2c:   2hoseon Jamsil→gangnam                         Gangnam Hwanseung        Jamsil                    Home
```
Also `Your partner · Home · evening` has a lower-case `evening`.

## Changes
In the English Today-list helper added in 29L2/29L2c (grep `Work (assumed` in `web/src`):
- Only two row kinds are built in code: the home row → `Home` **only when the Korean row is exactly `집`**; the workplace row → `Work (assumed: near <romanised station>)`. A row naming the complex (`레이크팰리스`) shows its English name (`Lake Palace`) as before.
- Every other row (rides, transfers, walks with minutes, crowding, shops) is **not** built in code: leave the Korean text and let the existing DOM translator / `en-table` patterns translate it exactly as before 29L2 (remove `data-no-i18n` from those rows).
- `romanizeName` is used only on bare place names, never on a whole row.
- Household rows: capitalise the activity word (`Evening`, `Working`, `Asleep`…) in English.

## Tests — extend `web/tests/scene-chrome-29L2.test.js`
- English Today helper: `집` → `Home`; `레이크팰리스` → `Lake Palace`; the workplace row → `Work (assumed: near Pangyo Stn)`; `2호선 잠실→강남 (9분, 혼잡 91%)` is returned unchanged (left for the translator) and its node is not marked `data-no-i18n`.
- English household row for 배우자 at home in the evening is `Your partner · Home · Evening · Tiredness 23/100`.

Run only:
```
cd web && node --test tests/scene-chrome-29L2.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Everything else; `briefs/`.

## Final message
Changed files, one line each. Nothing else.

# Stage 36i3 — four old tests follow the 36i fallback wording (brief for Muse)

Agent mode, rules in `AGENTS.md` and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls. Change test files only.

36i changed the Korean fallback wording on purpose:
- `도구 결과의 수치만 정리합니다 (가정값 포함):` → `도구가 낸 수치만 정리했어요 (가정값 포함):`
- `도구 호출이 N라운드를 넘었다.` → `확인할 게 많아서 여기서 멈췄어요.`

Four assertions still pin the old text. Update only those expectations to the new wording, and keep each test's intent:
- `tests/i18n-deterministic-26t.test.js` (or the file holding "numbers-only fallback has no data-no-i18n in English mode"): `msg.includes("도구 결과의 수치만")`.
- `tests/consult-9a.test.js` "falls back to numbers-only when the fake provider insists on a verdict": `/도구 결과의 수치만/`.
- `tests/consult-agent.test.js` "retries once on guard failure, then answers numbers-only": `/도구 결과의 수치만/`.
- `tests/consult-agent.test.js` "stops after six tool rounds with the numbers so far": `/6라운드/`.
  - Assert `/여기서 멈췄어요/` instead.
  - Keep the check that the numbers so far are in the reply.

Run only:
```
cd web && node --test $(grep -lE "도구 결과의 수치만|6라운드|도구가 낸 수치만|여기서 멈췄어요" tests/*.test.js | tr '\n' ' ') tests/english-intake-36i.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Do not touch
Anything under `src/`.

## Final message
Changed files, one line each. Nothing else.

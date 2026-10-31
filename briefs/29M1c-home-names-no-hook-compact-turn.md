# Stage 29M1c — Follow-up: HomeName stays a plain component; the turn block stays compact (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Full suite after 29M1 (orchestrator), two regressions:
1. `tests/english-trust-29a1.test.js` "29a1b name gloss": `Cannot read properties of null (reading 'useSyncExternalStore')` — 29M1 added `useSyncExternalStore(subscribeHomeNamesEn, …)` inside `HomeName` (`web/src/ui/candidate-card.jsx:~160`); the test (and other callers) call `HomeName({...})` as a plain function.
2. `tests/next-step-29h2.test.js` "appendToolCards runs before the text pushMsg": the check looks within 800 chars after `const bubble = turnBubble(out);` in `web/src/ui/chat.jsx`; 29M1 inserted the name-registration lines there, pushing `pushMsg({ role: "assistant", kind: "text", content: bubble.content` out of the window.

## Changes
1. `HomeName`: no hook. Read `homeNameEn` directly. Re-render comes from the chat state update that follows every consult response (registration happens before the messages are set — keep it so). If a list must refresh when names arrive later (e.g. storage event in the 3D frame), subscribe once in a parent that already uses `useSyncExternalStore` (the chat panel / candidate list), not in `HomeName`.
2. `chat.jsx`: move the 29M1 registration block out of the turn block into one helper call (e.g. `absorbHomeNamesEn(out, replyText, koNames)` defined near `reportNameFor`), placed **before** `const bubble = turnBubble(out);` or as a single line after it, so the 29h2 window still holds `appendToolCards(out.messages);` and the text `pushMsg` in that order. Do not edit the 29h2 test.

Run only:
```
cd web && node --test tests/english-trust-29a1.test.js tests/next-step-29h2.test.js tests/home-names-29M1.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Everything else; `briefs/`.

## Final message
Changed files, one line each. Nothing else.

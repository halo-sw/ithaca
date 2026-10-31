# Stage 36i2 — in a recorded replay, every moment opens the 3D at its minute (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (`?replay=seoul-couple&lang=en`, fresh browser profile)
- **What happens.** After "See the result", clicking a moment row ("Day 2 08:04 · Longest commute day: 34 min") opens the scene panel. The panel says `저장된 살아 보기를 찾지 못했어요. 대화에서 다시 실행해 주세요.` ("Couldn't find the saved Live it run").
- **Cause.** The recording's simulation card (`web/public/recorded/seoul-couple.json`, message `m11`) carries `customId: "cmvwxbyxq1806"`.
  - Moment links use `?custom=<id>`, and `bootSim` (`web/src/main.js:~1376-1384`) reads that id from IndexedDB.
  - In a replay nothing is saved there. The run existed only in the recorder's browser.
  - The replay boot (`web/src/ui/chat.jsx:3055-3099`) only reveals messages.
- **What the recording already has.** It has everything needed to recompute the run:
  - `doc.scenario`, a full scenario object with `seed`;
  - the card's `labels`, `names`, `moneyDoc`, `moneyMissing`, `moments`;
  - the worker is deterministic per seed.
- This is what judges see first on the public site, so every moment link in the replay must work.

## Change
1. **Pure helper** in `chat.jsx` (or `web/src/chat/recording.js`): `replayRunPlan(doc)`.
   - Returns `{ customId, scenario, labels, names, moneyDoc, moneyMissing }` from the last `kind: "simulation"` message whose `data.status === "done"` and has a `customId`, plus `doc.scenario`.
   - Returns `null` when any of those is missing.
2. **Replay boot.**
   - Once the recording loads and `replayRunPlan(doc)` is not null, check `loadCustomRun(plan.customId)`.
   - If it is missing, run the same worker runner the live path uses (`createWorkerRunner(...)` with `../sim-worker.js`, as at `chat.jsx:~2488`) on `plan.scenario` with `plan.labels`.
   - Then `saveCustomRun({ id: plan.customId, scenario: plan.scenario, runs, labels: plan.labels, moneyDoc: plan.moneyDoc, moneyMissing: plan.moneyMissing, names: plan.names })`.
   - Never add messages or tool rows. Never call the consult client.
   - Keep the promise in a ref, `replayRunReady`. A failure resolves to `false`, with no throw and no chat message.
3. **Opening a scene while the run is still computing** (`setScene` callers at `chat.jsx:~3152` and `~3254`, and the SceneFrame "Open in new window").
   - When `replayRunReady` is pending and the scene URL carries `custom=<plan.customId>`, show the panel with the same header and a centred line instead of the iframe:
     - `3D를 준비하고 있어요…`
     - English: `Preparing the 3D…`, rendered in the component with `currentLang()`, `data-no-i18n`.
   - Set the iframe `src` once the promise resolves `true`.
   - If it resolves `false`, show `이 기록의 3D를 다시 계산하지 못했어요.` / `Couldn't rebuild the 3D for this recording.`
   - "Open in new window" waits the same way before `window.open`.
4. **No other change.** Live runs, restores and `main.js` stay as they are.

## Tests — new `web/tests/replay-3d-36i2.test.js`
- `replayRunPlan(<the real recording JSON read from public/recorded/seoul-couple.json>)` returns `customId === "cmvwxbyxq1806"`, labels `["A","B"]`, a scenario with a numeric `seed`, and a non-null `moneyDoc`.
- `replayRunPlan({ messages: [] })` and `replayRunPlan(null)` return `null`.
- **Source checks:**
  - the replay boot calls `saveCustomRun` with the plan's id, never `newCustomId()`;
  - the replay path never calls the consult client.
- **SceneFrame SSR:** with a pending/ready prop (name it as you like), it renders the preparing line and no `<iframe` while pending, and the `<iframe` when ready.
- **Keep green:** every test that mentions `replay`, `SceneFrame`, `saveCustomRun` or `recording`.

Run only:
```
cd web && node --test tests/replay-3d-36i2.test.js $(grep -lE "replay|SceneFrame|saveCustomRun|recording" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `relay/**`, `data/`, `pipeline/**`, `README*`, `scenarios/`, `public/recorded/**`, `src/main.js`, `src/profile.js`, `src/consult/**` (another brief is editing these).

## Final message
Changed files, one line each. Nothing else.

# Stage 42a — map tags follow zoom, the right stage shows the 30-day run, the after-run chips always answer (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` (if a new Korean line needs English, list it in the final message; the orchestrator adds it).

## Why (owner, 2026-11-02, production copy + local repro, Korean UI)
Owner's flow: `판교에서 둘 다 일하는 예비부부예요. 연봉은 6천만 원, 5천만 원이고 모은 돈은 2억 원이에요. 7억 원 이하로 50㎡ 이상 집을 사고 싶어요.` → `1번이랑 2번 저장해 줘` → 30일 살아 보기 → chips.

1. **Map tags stay put when the map zooms.** Wheel / + / − zoom the base tiles, the lines and the ground dots, but the home tags (`6 · 60㎡ / 6억 4,000 / 출근 37분`), the group card and the `회사 · 판교` marker keep their screen position, so after a zoom they float over the wrong places with long leader lines. Cause: `layoutChatStage` (`web/src/chatmap.js:1471`) lays the boxes out on `fit.toXY` (zoom 1), while the dots draw through `toXYz` (`web/src/ui/chatmap.jsx:~522`, `geom()` at ~1084 uses `l.box` from that unzoomed layout).
2. **The right stage never shows the run.** While the 30-day run works and after it is done, the right side stays on the candidate map. The result lives only in the chat card; 3D opens only on a moment-row click or a Muse `open_panel`.
3. **After-run chips get no answer when Muse is not available.** Second browser session from the same IP → relay `429 server_key_used` (41e/41k). Then the diary fails ("일기는 이번에 못 썼어요"), and `출근길 보여 줘`, `동네 걸어 보기`, `한 달에 얼마 들어?` add only the user's bubble — nothing answers. `askAgent` falls back to `structuredFlow(text)` (`web/src/ui/chat.jsx:~2896-2930`), which has no rule for these chips, and the 27j "answered" guard in `send()` only runs on the local route, not on this in-agent fallback. Same on the keyless path and after 3 Muse failures.
4. **Result stays locked after a failed check.** The report check fails on that connection (`status: "failed"`, card says "리포트 검증을 하지 못했어요 (연결 문제)"), and `reportUnlocked` (`chat.jsx:745`) returns false for `failed`, so `결과 보기` says "비교 리포트를 검증하는 중이에요. 통과하면 결과를 열게요." forever — it is not checking.

## Change
1. **Tags follow the map.** At any zoom/pan, every home tag, the group card and the work marker sit on (or leader to) their pin's *current* projected point, the same way they do at zoom 1. Lay out in the zoomed screen space (e.g. hand `layoutChatStage` a fit whose `toXY` is `T.apply(fit.toXY(...))`, keeping `allowRefit` off when zoomed) — your call, but: tag sizes stay constant in px, zoom 1 output is unchanged (existing chatmap layout tests stay green), and the fit/regroup logic does not re-run per wheel tick beyond what zoom 1 already does. Tags whose point leaves the frame may hide.
2. **The right stage follows the run** (wide layout only; on the narrow ≤ 900 px layout nothing auto-switches).
   - While `status: "running"`: the stage title line (`stageContextLine`) reads `A·B 30일 살아 보는 중` and the map shows only the picked homes + workplace (fit to them).
   - When the run is `done` with a `customId`: the right stage opens the A commute replay automatically — the same scene `sceneForEffect({ panel: "commute", home: "A" }, { latestRun })` gives (`simMomentUrl … follow: 1, embed: true`, title `A 출근길`). This is the simulation itself, so it opens right away; the report check keeps running in the chat card. `후보 지도` in the scene header still returns to the map.
   - The tray `결과 보기` opens the same scene on the right (and still scrolls the chat to the result card).
3. **The after-run chips always answer, with or without Muse.** Add deterministic handling used whenever the turn does not reach Muse (local route, `server_key_used`, keyless, failure fallback) for these exact chip texts (and their English forms `Show the commute`, `Walk the neighborhood`, `How much a month?` — check `web/src/i18n/en.js` for the exact strings):
   - `출근길 보여 줘` → open the A commute scene on the right (as above) + one line from `compare.one_way`: `A {name}은 출근 편도 평균 N분, B {name}은 N분이에요. 오른쪽에서 A 출근길을 보여 드려요.` (no run yet → `먼저 두 집을 담고 30일 살아 보기를 해 주세요.`; `noCommute` run → say there is no commute and open the A day scene instead).
   - `동네 걸어 보기` → open the tour scene for A (`sceneForEffect({ panel: "tour", home: "A" }, …)`) + `A {name} 동네를 오른쪽에 열었어요.`; no 3D data → the existing `이 집은 아직 3D 동네 자료가 없어요.`
   - `한 달에 얼마 들어?` → open the money tab (`compareOpen: true, compareTab: "money"`) + one line with each home's monthly total from the run's `moneyDoc` (the same `합계 월 …` numbers the card shows); no money doc → open the tab only with `내가 내는 돈 탭에서 볼 수 있어요.`
   - Then the 27j guard applies on every non-Muse path: if still nothing replied, push `localNoAnswerLine(content)`. No user bubble is ever left without a reply.
4. **Failed check does not lock.** `reportUnlocked` returns true for `failed` (the card already says the check could not run and offers 다시 검증하기). The "검증하는 중이에요" line is used only when the status really is `checking`.

## Tests — new `web/tests/stage-run-42a.test.js` (pure functions; export what you need)
- Layout at zoom 2 and with a pan: each home tag's anchor/leader end equals `toXYz(pin)` within 1 px; at zoom 1 the result is identical to today's.
- Stage line while running: `A·B 30일 살아 보는 중`; after done back to the normal line.
- Run done with customId → the auto scene is `{ url: simMomentUrl({ custom, home: "A", … follow: 1, embed: true }), title: "A 출근길" }`; narrow → no auto scene.
- Chip rules: each of the 3 chips (Korean + English text) on a thread with a done run returns its scene/tab effect and a non-empty line with the right minutes / monthly totals; with no run → the "먼저 두 집을…" line; unknown text → falls to `localNoAnswerLine`.
- `reportUnlocked` → true for `failed`, still false for `checking` and unconfirmed `handoff` (update `report-check-29j3.test.js` only for the `failed` case).
Run the new file + `report-check-29j3`, chatmap and chat tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Cause in one line per item (1–4), changed files one line each, new Korean lines that need English, suite line, build line.

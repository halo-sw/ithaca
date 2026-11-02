# Stage 42c — every 30-day run keeps a per-person log, readable in the chat and on the right stage (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` (list new Korean lines that need English in the final message).

## Why (owner, 2026-11-02)
"모든 시뮬레이션을 돌릴 때 채팅이든 우측 바든 각각의 인물이 어떤 일들을 했는지 30일 시뮬레이션 로그가 기록되어야 하는데 지금은 그게 기록되지 않는 느낌이야."

Today the chat result card shows two "살아 보니" moments, a few life-event rows and the Muse diary. When Muse is not available (429 `server_key_used`), the diary is missing and nothing says what each person did on each day. The 3D stage has a day strip and a hidden `30일 보기` month strip (`web/src/ui/timeline.jsx:~331`) but no written log. The data is all there: each run has `agents` (key, label, role, household) and `aways` (`{ agent, day, kind, start_min, end_min, label, cause, detail }` — `web/src/engine/routines.js:~280`, detail carries rides/legs/minutes), plus `trips`.

## Change
1. **Pure log builder** — new `web/src/diary/person-log.js`: `personMonthLog(run, { lang = "ko" })` → `{ people: [{ key, label, role }], days: [{ day, entries: { [personKey]: [{ minute, end_minute, kind, text }] }, summary: { [personKey]: string } }] }` for the household members only, days 1..30 in order. Entry text in plain words from the record: `07:37 집에서 출발 → 08:19 회사 도착 (지하철 32분, 서서 12분)`, `18:00 회사에서 나옴 → 18:42 집 도착`, `19:10 장보기 25분 (마트까지 걸어서 6분)`, `공원 40분`, `22:14 늦은 귀가`. Kinds map to the same activity words the 3D legend uses (집·걷기·지하철·직장·장보기·공원·기타). Day summary = one short line per person (`출근 7분 · 장보기 · 18:42 귀가`). Numbers come only from the record; no record → no entry (never invent). English with `lang: "en"` (activity words from `web/src/i18n/en-activity.js`).
2. **Kept with the run.** `handleRun` stores the built log in the done simulation payload (`payload.personLog = { A: …, B: … }`), so it survives the thread state, transcripts and share like the rest of the payload (keep it compact: text strings + minutes, no detail objects).
3. **Chat — result card section `30일 기록`** (collapsed by default, under 살아 보니): home tabs A / B, person tabs (나 / 배우자 … from `label`), then 30 day rows `1일차 · {summary}`; a row expands to its entries. Each entry has a small `›` that opens that moment on the right stage — `simMomentUrl({ custom, home, day, t: hh:mm, follow: <person index>, embed: true })` via the same `onScene` the moment rows use.
4. **Right stage — `기록` panel in the sim view** (the embed the chat opens, `web/src/ui/timeline.jsx` area): a `기록` toggle next to `30일 보기` opens a panel listing the followed person's entries for the current day (from the same builder, run in the sim page from its own run data), the current entry highlighted as the clock moves; clicking an entry jumps the clock there (`onJump`). Switching day / person updates the list. Panel never covers the timeline bar; on narrow it is a bottom sheet.
5. Nothing here needs Muse — the log is built in code, so it is there even when the diary could not be written.

## Tests — new `web/tests/person-log-42c.test.js`
- A small synthetic run (2 household agents, 2 days, a work away with rides, a shopping away, a late return) → exact entry texts, order by minute, day summaries; background agents excluded; a day with no records has empty entries (no invented text).
- Every number in every entry text appears in the source record (minutes / clock).
- `lang: "en"` → no Hangul.
- `payload.personLog` present after a done run (unit-level: the payload builder you factor out includes it, compact — no `detail` objects).
- Chat card: section collapsed by default; expanding a day shows its entries; the `›` builds the expected `simMomentUrl`.
- Sim `기록` panel helper: entries for (day, person) and the highlighted index for a given minute.
Run the new file + chat/timeline/diary tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, new Korean lines needing English, suite line, build line.

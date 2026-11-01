# Stage 29N3h — the English diary request sends an English digest (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why (public site, English UI, after 29N3g)
The diary request body is `{task:"diary", lang:"en", digests:[…]}` but every fact text is still Korean: `11일째 저녁 공원 30분 (19:21 출발)`, commute facts in Korean too. 29N3g gave `runDigest` (`web/src/diary/digest.js`) a `lang` option, but its only caller `web/src/ui/chat.jsx:~2612` (`runDigest(runs[l], l, { name })`) never passes it, and only the evening facts were translated. Muse then writes `gongwon (공원)` and times like `8:0`, `19:6`.

## Change
1. `chat.jsx:~2612` passes the current language (`currentLang()`), the same value sent as `lang`.
2. In `runDigest`, for `lang: "en"` every fact kind has an English text built in code — commute (`day 1 commute 37 min (08:00 start)`, longest-day / crowded wording), crowded, evening (already), late return, decision — with times always `HH:MM` (zero-padded, the existing `hhmm`). Generic words from `web/src/i18n/en-activity.js`. Korean output byte-identical.
3. Keep the fact `id`, `day`, `minute` unchanged (the verifier matches on them); only the text changes. If the verifier compares numbers inside text, make sure the English text carries the same numbers.

## Tests
Add to `web/tests/en-diary-words-29N3g.test.js`: `runDigest(run, "A", { lang: "en" })` on a fixture with a commute, an evening park and a late return → no Hangul in any fact text, times `08:00`-style; `lang: "ko"` unchanged; a source check that `chat.jsx` passes `lang` to `runDigest`.
Keep green: `$(grep -l "runDigest\|diary" tests/*.test.js)`.

Run only:
```
cd web && node --test $(grep -l "runDigest\|diary" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`. Final message: changed files, one line each. Nothing else.

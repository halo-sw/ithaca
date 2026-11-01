# Stage 39d — English leftovers on the live run (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Touch only the files named here.

## Why
An English run on the production build ("I live alone and go to the office in Digital Media City 3 days a week…") still shows romanized Korean in three places:

1. Profile chip: "Digital Media City commute · 1 person · **Ju 3 days commute** · jeonse ₩300M or less". The chip is one string (`web/src/chat/engine.js:560` builds it with " · "). The orchestrator added the pattern `{ ko: "주 {0}일 출근", en: "office {0} days a week" }` to `en.js`, and `translate("주 3일 출근")` now gives "office 3 days a week" — but the whole chip never matches a pattern, so it falls to `wordFallback`, which romanizes 주 as "Ju".
2. 2D map walk status line: "09:22 · **Work (assumed: Near Dijiteolmidieositi Stn) Geunmu**". The stay label is "직장 (가정: 디지털미디어시티역 인근) 근무"; `activityLine` (`web/src/mapwalk.js:302-303`) sends it whole to `toEnglish`, which romanizes the full sentence.
3. Card gloss / 3D label for generated lot-number names: "산성역 근처 연립·다세대 (84-0)" shows "(Sanseong Stn Geuncheo Yeollip·Dasedae (84-0))". `homeNameEn` falls back to `romanizeName` (`web/src/i18n/home-names.js:119`), which does not know the shapes `displayNameFor` builds (`web/src/homes.js:695-700`).

## Changes

### A. `web/src/i18n/translate.js` — segment fallback in `translateCore`
Right before the `wordFallback` / `nameFallback` branch (around line 285), when `cand` contains " · ", split on " · ", translate each segment with `translateCore` (recursive; each piece goes through the same exact → pattern → fallback order) and join with " · ". Use that as `result` only when no segment comes back still containing Hangul; otherwise continue to the existing branch. A string without " · " behaves exactly as today.

### B. `web/src/mapwalk.js` — workplace stay rows
In `activityLine`, for a non-walk, non-ride segment in English: if the label ends in "근무" (same test as `todayStepEn`, `web/src/ui/scene-chrome.js:155`), output the English workplace label. Pull the station out of "직장 (가정: X역 인근) 근무" (or "직장 (가정: X 인근) 근무") and return `workplaceLabel(X, "en", romanizeName(X))` from `scene-chrome.js` (import it; if that creates an import cycle, move the small `workplaceLabel` function into a new `web/src/workplace-label.js` and re-export it from scene-chrome.js so existing imports keep working). A "근무" label without a recognizable station gives "Work". Korean output unchanged.

### C. `web/src/i18n/romanize.js` — generated lot-number names
At the top of `romanizeName` (before the per-word map), recognize the five shapes from `displayNameFor` using the new `HOME_KINDS` table the orchestrator added to `web/src/i18n/en-loanwords.js` (아파트 Apartment, 연립·다세대 Row house, 오피스텔 Officetel, 단독·다가구 House):
- `{X}역 근처 {kind} ({lot})` → `{KindEn} near {romanizeName(X+"역")} ({lot})` — "산성역 근처 연립·다세대 (84-0)" → "Row house near Sanseong Stn (84-0)"; "디지털미디어시티역 근처 오피스텔 (12)" → "Officetel near Digital Media City Stn (12)".
- `{X}역 근처 ({lot})` → `Near {Stn} ({lot})`.
- `{동} {kind} ({lot})` → `{romanizeName(동)} {kindEn lower-cased} ({lot})` — "대치동 연립·다세대 (242-4)" → "Daechi-dong row house (242-4)". ("Officetel" lower-cases to "officetel".)
- `{동} ({lot})` → `{romanizeName(동)} ({lot})`.
- `{kind} ({lot})` → `{KindEn} ({lot})`.
A kind not in `HOME_KINDS` skips this step (normal per-word path).

## Tests — new `web/tests/english-leftovers-39d.test.js`
- Translator built like `web/src/i18n/index.js` (phrases, patterns, WORDS): "디지털미디어시티 출근 · 1인 · 주 3일 출근 · 전세 3억 원 이하" → contains "office 3 days a week" and no "Ju"; no Hangul in the output. A segment string with one untranslatable Korean sentence keeps the old behavior (compare with the pre-change result for one existing pinned string from `english-trust-29a1.test.js`).
- `activityLine({ kind: "stay", label: "직장 (가정: 디지털미디어시티역 인근) 근무" }, 562, "en")` → "09:22 · " + the same text `workplaceLabel("디지털미디어시티", "en", "Digital Media City")` returns; contains "Digital Media City", no "Geunmu", no Hangul. Korean call unchanged.
- `romanizeName` on the five examples above gives exactly those strings; "래미안대치팰리스" is unchanged from today ("Raemian Daechi Palace").

Run only:
```
cd web && node --test tests/english-leftovers-39d.test.js tests/english-names-39c.test.js tests/en-names-29L6.test.js tests/english-trust-29a1.test.js tests/mapwalk*.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
If an old pin changes, update it only when the new English is clearly better and list it.

## Final message
Changed files, one line each, plus any old pins changed (old → new).

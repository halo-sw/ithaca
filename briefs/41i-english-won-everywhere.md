# Stage 41i — English won in full digits everywhere, clean English summaries (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` (the orchestrator owns the tables).

## Why
Owner rule (2026-11-01): English money is full digits + " won" — "170,000,000 won", never "₩170M", "₩950K", "1.7M". 41a fixed the translator path, but an English production run (Baseten, 2026-11-02) still shows the abbreviations, all built in code:
- Candidate card price and its aria-label: "Candidate 3: Deo Rich Ville · ₩117M · 26 min commute", "₩960K / ₩10M", "₩370M", "₩262M".
- Map pins: `chatmap.js:575` (`J ₩260M`, `M ₩600K / ₩10M`).
- Source: `web/src/money/currency.js:11-23` makes `₩…B/M/K` for English.

And the post-run summary in English still carries Korean and romanized lot names, e.g.:
"Finished living there. For your reference, the average one-way commute is 5 minutes from Pangyo-yeok geuncheo opiseutel (판교역 근처 오피스텔) and 24 minutes from Suseo Hyundai Venture Ville." and "Dear customer, both Dongin Levant Officetel (동인 레반트 오피스텔) and Wangsimni Station Nearby Yeonrip Dasedae (왕십리역 근처 연립·다세대) …".

## Changes
1. `money/currency.js`: in English, KRW is always `toLocaleString("en-US") + " won"` ("117,000,000 won", "960,000 won / 10,000,000 won"). No ₩, no K/M/B. USD unchanged ("$4,261"). Every English caller (cards, aria-labels, pins, charts, money panels) goes through it; find any other place that builds `₩` or `M won` for display and route it here. Pins may wrap to two lines; nothing may be cut (no text-overflow).
2. The English post-run summary, diary lines and report sentences pass through the same deterministic cleanup 41b added for chat answers (strip Hangul parentheticals, `jeonse` → deposit lease, `원` → won), and the model is given each home's English name (`homeNameEn`, which already turns "판교역 근처 오피스텔" into "Officetel near Pangyo Stn") instead of the Korean raw name. Drop salutations like "Dear customer," at the start.
3. `N차` / `N단지` inside romanized names ("정원스테이-4차" → today "Jeongwon Stay-4cha") → " Phase N" / " Complex N" on the `romanizeName` path too (41a did the translator path).

## Tests — new `web/tests/english-won-41i.test.js`
- English `formatMoney` (or the currency.js export) for 117000000, 960000, 10000000, 1500000000 → full digits + " won"; Korean output unchanged; USD unchanged.
- Card aria-label and pin label for a KRW candidate contain "117,000,000 won" and no "₩".
- Summary cleanup: the two sentences above → no Hangul, no "Dear customer", contain "Officetel near Pangyo Stn".
- `romanizeName("정원스테이-4차")` ends with "Phase 4".
Update old pins that assert `₩…M` in English (list them).

Run the new file plus the files you touch, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`.

## Final message
Changed files one line each, pins changed (old → new), suite summary line.

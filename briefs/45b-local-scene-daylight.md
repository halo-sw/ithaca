# 45b — Regional daylight uses the region's local clock

Product code/tests by Muse Code. Read AGENTS.md. One bounded rendering fix; no sub-agents, git, keys/network tools, full suite/build, data edits or result notes. Read only named ranges. Keep changes small.

## Reproduced

Chrome `/?area=us-menlo&time=12:00&lang=en&quality=low` loads 110 USGS tiles successfully but is almost black, with night windows. Pangyo at 12:00 is daylight. The scene isn't missing data: US scene has terrain, 12,964 road records, 18,285 tree records. Wrong local-to-UTC conversion drives the sky.

`web/src/main.js:150–163` tourSun hardcodes +09:00; default SUN_DATE at :106 is also KST. `:896–901` calls tourSun with no area. `:2258–2264` uses `simInstant(start_date, day, minute)` for all scenes. `web/src/sim.js:39–50` hardcodes (minute - 540). `simInstant` is used only in main.js and sim.test.js. `web/src/render/sky.js:1–36` and `web/src/lighting.js` solarPosition take an absolute Date. The clock in the UI represents local household time. US scope here is California / Meta HQ, not the whole USA.

## Change

1. Add a small pure helper module `web/src/scene/time.js` for the supported scene time zones. Use `Asia/Seoul` for Korean/default areas and `America/Los_Angeles` for these Bay Area scene IDs/country+bbox (reuse the existing area country/bbox classification; `aerial/drape.js:28–45` or `basemap.js` exposes classification). A valid explicit IANA time zone may win if the area carries one; do not invent a single USA-wide time zone.
2. Convert `(dateISO, dayIndex, minuteOfDay)` to a real Date in the chosen zone using Intl date/time zone offsets, respecting California summer/winter DST. Default Korean results must be exactly unchanged. Invalid values must fail clearly rather than NaN reaching the render loop. Keep this render-clock helper separate from simulation calculations: do NOT alter trips, schedules, saved timestamps/numbers, replay seed or model decisions. Keeping existing simInstant API unchanged and calling the new helper in main.js is preferred.
3. `tourSun(area)` must use local scene time for both ?time= and the default 15:00 on 2026-10-15. Pass actual loaded area at :897. `updateLighting` uses the same helper for run.meta.start_date/day/minute and loaded area. Preserve the actual minute passed into skyParams and all UI clocks.

## Tests

New `web/tests/scene-time-45b.test.js`: Korea exact old timestamps (including day rollover); Menlo July noon = 19:00Z and January noon = 20:00Z; Nov 2, 2026 noon uses winter offset. With existing solarPosition/skyParams at Menlo coordinates, local noon is day and local midnight is night. Test both default tour-like date and run date conversions. Explicit supported/valid zone behavior; invalid date/minute handling. If implementing DST ambiguity/nonexistent times, choose/document deterministic behavior, but don't broaden to a scheduling engine.

Run only `node --test web/tests/scene-time-45b.test.js web/tests/sim.test.js web/tests/render-sky.test.js` (short output). Stop after at most 2 fix attempts. Final: changed files and targeted test result only.

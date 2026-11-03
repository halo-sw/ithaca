# Listing-style commute vs Ithaca's door-to-door commute

*Measured on 2026-11-03 with Ithaca's own data and engine. This is an analysis. It adds no product feature.* · [한국어](baseline-commute.ko.md)

## The question
A listing usually says how far the nearest station is, for example "3 min to the station". Add the scheduled train ride to that. How close does it come to the commute you would actually make every morning?

## What we compared
We took every candidate home in three fixed recorded runs, with no hand-picking:
- `seoul-couple.json`;
- `pangyo-reviewed-month.json`;
- `menlo-month.json`.

For each home we compared two figures:

- **Listing-style figure.** This is our stand-in for the convention, not text from real listings; we don't collect listing text.
  - Straight-line distance from the home to its boarding station ÷ 80 m/min, a common listing convention.
  - Plus the scheduled ride on the same line.
  - No waits, no transfers, no last mile.
- **Ithaca door-to-door.** This is the engine's average one-way commute for that home. It is the same number the app shows (`C01`, `oneWayCommuteOfRun` in `web/src/verify/numbers.js`).
  - 10 paired seeds and the same household.
  - Rule-based decisions, so no model calls.
  - The same tool path as the app: `build_scenario` → `run_simulation`.

## Result

| Commute | Homes | Listing-style | Ithaca door-to-door | Gap (Ithaca − listing-style) |
|---|---:|---:|---:|---:|
| **Meta HQ, 1 Hacker Way** (Caltrain corridor) | 5 | 5.1–18.1 min | 33.4–44.1 min | **+26.0 to +31.6 min** (mean +28.7, median +28.3) |
| **Pangyo** (two recorded runs) | 12 | 2.9–50.0 min | 4.8–52.2 min | **+0.2 to +2.6 min** (mean +1.0, median +0.6) |

The listing-style figure was lower for all 17 homes. One more US home was excluded (see below).

### Where the gap comes from
The engine's one-way minutes split into walk, ride and wait (means over the counted homes):

| Commute | Walk (and bike) | Ride | Wait |
|---|---:|---:|---:|
| Meta HQ | 26.1 | 8.4 | 5.3 |
| Pangyo | 3.9 | 28.9 | 0.0 |

**Meta HQ.** A "3 min to Caltrain" line leaves out two things:
- **Waiting for the train**: 3.8–7.5 min per one-way trip on average. The engine takes the wait from the Caltrain GTFS timetable (source tag `caltrain_gtfs_half_headway`).
- **The last mile from Menlo Park station to Meta HQ**, about 22 min per trip by bike on the OpenStreetMap bike graph. This is the engine's walk-and-bike minutes minus the graph walk to the boarding station: 22.2–22.3 min for every home.

The ride itself is the same in both figures.

**Pangyo.** The two figures are close for three reasons:
- the scenarios place the workplace at Pangyo Station ("assumed: near Pangyo Stn"), so there is no last mile;
- the ride is the same scheduled time in both;
- **the engine adds no platform wait in Korea yet**: the ride minutes are Seoul Metro standard times.

The only difference is the walking route against the straight line: −0.1 to +2.6 min to the station. At a slower listing walk of 67 m/min (4 km/h), the Pangyo gap is −0.5 to +1.7 min (mean +0.4), and the listing-style figure is lower for 8 of 12 homes. At 67 m/min the Meta HQ gap is still +25.8 to +31.4 min.

### Excluded
**777 Hamilton** (Menlo Park): the engine's commute from this home has no train leg. Its nearest stop in the data is Chilco Bus Station, so there is no station-plus-train figure to compare.

## Per home

### Meta HQ (`menlo-month.json`)
In this table the walk column includes the bike ride from Menlo Park station to Meta HQ.

| Home | Boarding station | Straight line ÷ 80 m/min | Walk on the map graph | Scheduled ride | **Listing-style** | **Ithaca door-to-door** | **Gap** | Ithaca walk / ride / wait |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 777 Hamilton | Chilco Bus Station | — | 18.9 | — | — | — | — | — |
| 124 University Avenue | Palo Alto | 2.1 | 4.4 | 3.0 | 5.1 | 33.4 | +28.3 | 26.7 / 3.0 / 3.8 |
| 515 Cleveland Street | Redwood City Transit Center | 8.1 | 9.8 | 4.0 | 12.1 | 39.9 | +27.8 | 32.1 / 4.0 / 3.8 |
| 553 West El Camino Real | San Carlos | 1.1 | 1.1 | 8.0 | 9.1 | 38.8 | +29.7 | 23.3 / 8.0 / 7.5 |
| Loft House Apartments | Sunnyvale Transit Center | 1.1 | 1.1 | 17.0 | 18.1 | 44.1 | +26.0 | 23.4 / 17.0 / 3.8 |
| Sterling Point | Belmont | 1.1 | 2.9 | 10.0 | 11.1 | 42.7 | +31.6 | 25.2 / 10.0 / 7.5 |

### Pangyo, two adults (`seoul-couple.json`)

| Home | Boarding station | Straight line ÷ 80 m/min | Walk on the map graph | Scheduled ride | **Listing-style** | **Ithaca door-to-door** | **Gap** | Ithaca walk / ride / wait |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 백궁 동양파라곤 | 정자 | 2.5 | 3.1 | 4.1 | 6.6 | 7.2 | +0.6 | 3.1 / 4.1 / 0.0 |
| 그린빌리지(1동) | 남한산성입구 | 2.4 | 3.3 | 20.6 | 23.0 | 24.5 | +1.5 | 3.9 / 20.6 / 0.0 |
| 유지빌라3차 | 송파나루 | 1.6 | 2.3 | 32.2 | 33.8 | 34.5 | +0.7 | 2.3 / 32.2 / 0.0 |
| 신광빌라 | 거여 | 1.9 | 2.2 | 37.1 | 39.0 | 39.3 | +0.3 | 2.2 / 37.1 / 0.0 |
| (47-4) | 고덕 | 2.1 | 2.3 | 44.0 | 46.1 | 46.3 | +0.2 | 2.3 / 44.0 / 0.0 |
| (291-22) | 용답 | 4.3 | 6.9 | 43.8 | 48.1 | 50.7 | +2.6 | 6.9 / 43.8 / 0.0 |

### Pangyo, reviewed month (`pangyo-reviewed-month.json`)

| Home | Boarding station | Straight line ÷ 80 m/min | Walk on the map graph | Scheduled ride | **Listing-style** | **Ithaca door-to-door** | **Gap** | Ithaca walk / ride / wait |
|---|---|---:|---:|---:|---:|---:|---:|---|
| (647) | 판교 | 2.9 | 5.0 | 0.0 | 2.9 | 4.8 | +1.9 | 4.8 / 0.0 / 0.0 |
| 미래하이빌 | 단대오거리 | 4.2 | 4.1 | 19.4 | 23.6 | 23.9 | +0.3 | 4.5 / 19.4 / 0.0 |
| 마일스디오빌 | 학동 | 1.9 | 1.8 | 28.1 | 30.0 | 31.0 | +1.0 | 2.9 / 28.1 / 0.0 |
| 현진타워 | 개롱 | 0.8 | 0.9 | 35.8 | 36.6 | 37.0 | +0.4 | 1.2 / 35.8 / 0.0 |
| 신우아트빌 | 응봉 | 3.2 | 3.5 | 38.4 | 41.6 | 41.9 | +0.3 | 3.5 / 38.4 / 0.0 |
| 왕십리씨티빌 | 한양대 | 6.7 | 8.9 | 43.3 | 50.0 | 52.2 | +2.2 | 8.9 / 43.3 / 0.0 |

All times are minutes, one way, rounded to 0.1.

## How this was computed
- **Script.** [`web/scripts/baseline-commute.mjs`](../web/scripts/baseline-commute.mjs). Tests: [`web/tests/baseline-commute-60a.test.js`](../web/tests/baseline-commute-60a.test.js).
- **Output.** [`docs/evidence/baseline-commute.json`](evidence/baseline-commute.json). It has every row, the parameters and the summaries.
- **Command.** `node --max-old-space-size=8192 web/scripts/baseline-commute.mjs --data-dir <runtime data> --scen-dir scenarios --out docs/evidence/baseline-commute.json` takes about 11 min on a laptop.
- **Data.** The `data-v1` runtime data release (`runtime-data.tgz`), the copy downloaded on 2026-11-01 at 09:57 UTC (sha256 `f0a9934a77a375fbf6ade5819b8b98faa75addfe8fa9ac73e0891b0a408177ca`). The asset was re-uploaded at 10:23 UTC that day to add road-name addresses to the homes (PR #22). This analysis does not use addresses.
- **Boarding station and ride.**
  - The station is the one the scenario household boards at.
  - Its point comes from the area's station places, as the engine does, or else from the region network.
  - The ride is `rideMinutesForHome` for the same line pair: Seoul Metro standard times, or Caltrain GTFS.
- **Walk speeds.**
  - Listing-style: 80 m/min, with a 67 m/min sensitivity in the JSON.
  - The engine walks the real map graph at 78 m/min.
- **Seeds.** The 10 seeds from `defaultSeeds`, 2452535568–2452535577. Decisions are rule-based.

## Limits
- **Seventeen homes.** They come from three recorded runs. This is not a sample of the market.
- **No platform waits in Korea.** Ithaca's Korean door-to-door figure has none yet. Real waits would widen the Pangyo gap.
- **The US last mile assumes a bike** from Menlo Park station. A Meta shuttle or a car would change it.
- **The listing-style figure is our stand-in.** It follows the convention; we did not collect or scrape listing text.

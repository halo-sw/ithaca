# How close is the 3D neighbourhood to the real city?

[한국어](3d-fidelity.ko.md)

This page takes the gallery's "Follow one person" scene apart, piece by piece. It checks the home building, the walking path, the subway legs, and the ground and roof photo against the real records. Where they do not match, it says so.

- **Checked on:** 2026-11-01
- **Scene:** the recorded month `demo-two-homes`. A two-income couple who work in Pangyo (salaries ₩60M and ₩50M, ₩200M saved) buy a home for ₩700M or less.
  - Home A is Hyosung Olympic County in Bangi-dong, Songpa-gu (apartment, 56.22 m²).
  - Home B is Bundang Emco Heritz in Gumi-dong, Bundang-gu, Seongnam (officetel, 61.18 m²).
- **Screens:** the running app on a real GPU (Apple M4 Max, Metal), 1440×810 @2x and phone 390×844 @3x.
- **Numbers:** all read from build outputs and engine code.
  - Build outputs: `data/build/<scene>/buildings.json`, `data/build/region/*`, `data/build/sim/demo-two-homes-*.json`.
  - Prices: MOLIT real-transaction records (rt.molit.go.kr), deals from 2025-11 to 2026-10.

## Why these two homes

The old demo's Home A was Lake Palace in Jamsil, which this couple's salaries and savings could not buy. So the homes were picked again from real deals: ₩700M or less, 50 m² or more, a Pangyo commute.

| | A Hyosung Olympic County | B Bundang Emco Heritz |
|---|---|---|
| Median deal | ₩625M (5 deals, lot number + name match) | ₩587M (5 deals, name match) |
| Kind | Apartment (register: 공동주택, multi-unit housing) | Officetel (register: 업무시설, business use) |
| Acquisition tax | 1.1667% (₩600M–900M formula, Local Tax Act Art. 11(1)8) | 4% (Local Tax Act Art. 11(1)7(b)) |
| Monthly housing cost | ₩2,079,245 | ₩1,990,522 |
| Commute | Songpanaru → Pangyo, 4 subway lines | Migeum → Pangyo, Shinbundang Line, 2 stops |

## What the 3D is built from

| Layer | Source | Used for |
|---|---|---|
| Building footprints | OpenStreetMap buildings + GIS building data (MOLIT) | 3D buildings, home lookup |
| Building height | ① OSM `height` ② OSM levels × 3 m ③ building register height ④ register floors × 3 m ⑤ Building HUB title record ⑥ otherwise estimated (kind/area rule) | 3D height |
| Walking paths | OpenStreetMap road and footway graph | Walk minutes and distance |
| Subway lines | OpenStreetMap route relations (ODbL) | Line paths and km |
| Run times | Seoul Metro inter-station distance and time (OA-12034, KOGL Type 1) | Lines 1–8 minutes |
| Crowding | Seoul Metro crowding, 30-minute slots | Measured crowding, lines 1–8 |
| Ground and roof photo | VWorld aerial photo (MOLIT Spatial Information Open Platform). Fetched live on every view, never stored | Home scenes, workplace scene, the map between stations |

## 1. Where the building heights come from

| Scene | Buildings | Register height/floors | Building HUB | OSM height/levels | Estimated | Estimated (by count) | Estimated (by footprint) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Around Songpanaru Stn (home A) | 3,917 | 2,910 | 27 | 693 | 287 | 7.3% | 4.5% |
| Around Migeum Stn (home B) | 1,230 | 558 | 0 | 223 | 449 | 36.5% | 12.0% |
| Around Pangyo Stn (workplace) | 1,204 | 249 | 136 | 152 | 667 | 55.4% | 6.4% |
| Simple map between stations (Songpanaru→Pangyo) | 11,071 | 8,460 | – | – | 2,611 | 23.6% | – |
| Simple map between stations (Migeum→Pangyo) | 1,489 | 922 | – | – | 567 | 38.1% | – |

Most estimated heights belong to small buildings. The median footprint of an estimated building is 14.1 m² in Pangyo, 19.5 m² in Migeum and 47.5 m² in Songpanaru. So Migeum and Pangyo have high estimated shares by count, but only 4.5–12% by footprint.

## 2. The home buildings

| | A Hyosung Olympic County | B Bundang Emco Heritz |
|---|---|---|
| 3D building | OSM way 677796358 | OSM way 465862686 |
| How it was picked | Register record at the deal's lot (Bangi-dong 51-4) with a matching name; 4 m from the deal point | The scenario point lies inside the footprint (`point-in-footprint`) |
| Register use | Multi-unit housing | Business use (officetel) |
| Floors | 18 above ground = 18 in 3D | 12 above ground = 12 in 3D |
| Height | Register 54.05 m, 3D 54.0 m | Register 58.6 m, 3D 59.0 m |
| Approved | 2003-09-30 | 2014-01-06 |
| Footprint | 696 m² | 2,797 m² |

![Walking from home A to Songpanaru Station](../briefs/img/fid-a-home-walk.jpg)

![Walking from home B, Bundang Emco Heritz, to Migeum Station](../briefs/img/fid-b-home-walk.jpg)

## 3. The commute

**A: Hyosung Olympic County → Songpanaru → Seokchon → Bokjeong → Imae → Pangyo**

| Leg | Value in the 3D scene | Basis |
|---|---|---|
| Home → Songpanaru Stn, walk | 544 m · 7 min (440 m straight) | OSM walking graph |
| Line 9 Songpanaru → Seokchon | 0.822 km · 1.2 min | Estimate: line distance × 1.43 min/km. Line 9 is not in the Seoul Metro table |
| Line 8 Seokchon → Bokjeong | 4.228 km · 6 min | Seoul Metro timetable |
| Suin-Bundang Line Bokjeong → Imae | 7.705 km · 10.9 min | Estimate (line distance × 1.43 min/km) |
| Gyeonggang Line Imae → Pangyo | 1.498 km · 2.1 min | Estimate (line distance × 1.43 min/km) |
| 3 transfers (Seokchon, Bokjeong, Imae) | 4 min each, 12 min | Assumed |
| Crowding (07:30–08:00) | Line 8 100% measured; Line 9, Suin-Bundang, Gyeonggang 70% assumed | Seoul Metro crowding covers lines 1–8 only |

**B: Bundang Emco Heritz → Migeum → Jeongja → Pangyo**

| Leg | Value in the 3D scene | Basis |
|---|---|---|
| Home → Migeum Stn, walk | 133 m · 2 min (94 m straight) | OSM walking graph |
| Shinbundang Line Migeum → Pangyo | 4.63 km · 6.6 min | Estimate (line distance × 1.43 min/km). Shinbundang is not in the Seoul Metro table |
| Crowding | 70% assumed | No measured data for Shinbundang |

**Over 30 days:**
- The average one-way commute is 39 min for A and 8 min for B.
- Time walked in the month is 13 h 28 min for A and 5 h 43 min for B.

The screen calls the subway time "official" only when every leg comes from the timetable. So A's 20 subway minutes are tagged "Assumed".

![A on Line 8 under Songpa-daero: the map between stations with photo and buildings](../briefs/img/fid-a-line8.jpg)

![B on the Shinbundang Line passing Jeongja](../briefs/img/fid-b-ride.jpg)

![A arrives at work in Pangyo: the workplace scene has the photo too](../briefs/img/fid-a-work.jpg)

![Phone, 390 px, Korean and English](../briefs/img/fid-phone-ko-en.jpg)

## 4. Fixed in this round

| Problem | Fixed in |
|---|---|
| Nine line patterns stored their line backwards: Line 8, Line 5, Line 7 down, Gyeonggang and others. The Line 8 rider ran north toward Cheonho, and the Gyeonggang leg jumped to Yeoju. The minutes were right; the drawing was wrong | 5384d71 |
| The walk ended at the OSM station node and the ride started at the line's stop, so the follow marker jumped at the station | 6a2484b |
| The whole subway time was labelled "official" when only one leg came from the timetable | 395ce2e |
| Home B landed on a nearby villa: the officetel is registered as business use, so it was dropped as a dwelling | 925b576 |
| The Pangyo workplace scene had black ground and no photo | 925b576 |
| The map between stations had no photo | aca5eeb, bf8ce61 |
| One "Measured" tag covered walking, subway and waiting together | 58b903d |
| The home name showed twice ("Bundang Emco Heritz Bundang Emco Heritz") | dff0b2f |
| The crowding line did not say which line it meant | dff0b2f |
| Station dots grew past 40 px and the pin's dot sat 48 px off the line: size and position were computed before the camera moved, and the whole pill was centred on the point | 36c97f6 |
| The public-rental list measured the distance to work from the boarding station (Songpanaru) | 36c97f6 |
| The aerial credit stayed Korean on the English screen | 6a2484b |
| On an English phone the credit ran off the screen | e26b489 |
| The phone toolbar was cut off in English | 925b576 |

## 5. What still differs

1. **Most subway minutes are estimates.** Of A's four lines, only Line 8 is in the Seoul Metro timetable. Line 9, Suin-Bundang, Gyeonggang and Shinbundang use line distance × 1.43 min/km, the median of lines 1–8.
2. **Transfers are not measured.** Each transfer is assumed to take 4 minutes. Walking distance, stairs and train intervals are not included.
3. **Measured crowding exists for lines 1–8 only.** The other lines are assumed at 70%.
4. **The map between stations is simplified.** 24–38% of its building heights are estimated. The photo covers roofs and ground only, in a band along the line; outside the band the ground stays beige.
5. **There is no station exit data.** Walks are measured to the OSM station node, which may not be the exit a person uses.
6. **The Migeum scene has many estimated heights.** 36.5% by count. Most are small buildings, so it is 12.0% by footprint.
7. **The chat's 2D map is not the photo.** It uses the same VWorld source, but as the grey base map (`white` layer), so price pins and lines stay readable. The 3D scenes use the aerial photo.

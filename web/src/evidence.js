// Stage 20c: how the scene on screen counts toward the result.
//
// sceneEvidence({ run, agentKey, day, minute, now }) returns 0-3 short
// lines shown under the sim hero's big number, each { text, tag } where
// tag is "측정", "가정값" or null. Commute lines reuse the same helpers
// as the result card (commuteOneWayMinutes), so the numbers match.
// At home / work / lingering somewhere: [] (nothing to clutter).
import { commuteOneWayMinutes } from "./verify/numbers.js";
import { currentLang } from "./i18n/lang.js";
import { commuteBreakdownEn } from "./ui/scene-chrome.js";

// Same half-day cut as verify/numbers.js (AM_END_MINUTES = 12:00).
const AM_END_MINUTES = 720;
// Source value the engine stamps on assumption-based congestion
// (engine/journey.js FALLBACK_SOURCE).
const ASSUMED_SOURCE = "가정값";

const ERRAND_WORD = { errand: "장보기", clinic: "병원", park: "산책" };

const halfOf = (m) => (m ?? 0) < AM_END_MINUTES ? "am" : "pm";

const startOf = (t) => t.depart_min ?? t.arrive_min ?? 0;
const awayStartOf = (a) => a.start_min ?? a.end_min ?? 0;

export function sceneEvidence({ run, agentKey, day, minute, now }) {
  if (!now || now.free || !now.state) return [];
  if (now.state === "trip") {
    const trip = findTrip(run, agentKey, now.tripId, day, minute);
    if (!trip) return [];
    if (trip.purpose === "commute") return commuteLines(run, agentKey, trip, startOf(trip));
    if (ERRAND_WORD[trip.purpose]) return errandLines(run, agentKey, trip);
    return [];
  }
  if (now.state === "ride") {
    const away = findRide(run, agentKey, day, minute);
    if (!away) return [];
    return commuteLines(run, agentKey, away, awayStartOf(away));
  }
  return [];
}

function findTrip(run, agentKey, tripId, day, minute) {
  const trips = (run && run.trips) || [];
  if (tripId) {
    const hit = trips.find((t) => t && t.id === tripId);
    if (hit) return hit;
  }
  const m = Math.floor(minute ?? 0);
  return trips.find((t) => t && t.agent === agentKey && t.day === day
    && Number.isFinite(t.depart_min) && Number.isFinite(t.arrive_min)
    && m >= t.depart_min && m < t.arrive_min) || null;
}

function findRide(run, agentKey, day, minute) {
  const m = Math.floor(minute ?? 0);
  return ((run && run.aways) || []).find((a) => a && a.agent === agentKey
    && a.day === day && a.kind === "ride"
    && Number.isFinite(a.start_min) && Number.isFinite(a.end_min)
    && m >= a.start_min && m < a.end_min) || null;
}

// Ride legs + transfer minutes behind one ride away, in the engine's own
// split (legs carry the train time, transfers carry walk/wait). Without
// leg detail the away window itself is the ride time.
function rideParts(away) {
  // 36d: whether this away's ride minutes come from the schedule
  // (timetable / interstation derived) rather than an assumption.
  // 36e: derived_estimate (노선 거리 × 평균 속도) stays an assumption —
  // only "derived" reads 측정, so the subway part of a derived_estimate
  // ride is 가정값.
  const out = { ride: 0, wait: 0, assumed: [], assumedLines: [], measured: [],
    schedule: false };
  const d = (away && away.detail) || {};
  out.schedule = d.ride_minutes_source === "derived";
  const details = [];
  if (d.ride && typeof d.ride === "object") details.push(d.ride);
  else if (d.rides && typeof d.rides === "object") {
    if (d.rides.out) details.push(d.rides.out);
    if (d.rides.back) details.push(d.rides.back);
  }
  if (details.length === 0) {
    if (Number.isFinite(away.end_min) && Number.isFinite(away.start_min)) {
      out.ride = Math.max(0, away.end_min - away.start_min);
    } else if (Number.isFinite(d.ride_minutes)) {
      out.ride = d.ride_minutes;
    }
    return out;
  }
  for (const r of details) {
    for (const leg of r.legs || []) {
      if (Number.isFinite(leg.minutes)) out.ride += leg.minutes;
      const c = leg.congestion;
      if (c && Number.isFinite(c.valuePct)) {
        const lineName = String(c.line || leg.line || leg.lineName || leg.name || "");
        if (c.hasData === true) {
          out.measured.push({ lineName, pct: c.valuePct, source: c.source || "" });
        } else if (c.source === ASSUMED_SOURCE || c.hasData === false) {
          out.assumed.push(c.valuePct);
          if (lineName) out.assumedLines.push(lineName);
        }
      }
    }
    let w = 0;
    let anyTransfer = false;
    for (const t of r.transfers || []) {
      if (Number.isFinite(t.minutes)) {
        w += t.minutes;
        anyTransfer = true;
      }
    }
    if (!anyTransfer && Number.isFinite(r.transferMinutes)) w = r.transferMinutes;
    out.wait += w;
  }
  return out;
}

// One direction's door-to-door commute for this agent, day and am|pm
// half: the walk trips plus the ride away(s). The total is defined as
// the sum of the rounded parts, so the parts always add up.
// 36d: per-part English labels (the transfer/wait part reads
// "transfer & wait", matching the Korean 환승·기다림).
const EN_PART_LABEL = { "걷기": "walking", "자전거": "biking",
  "지하철": "subway", "환승·기다림": "transfer & wait" };
// 36h3: English line names built in code (the page translator splits
// on ·, so 수인·분당선 must never reach it in halves).
const EN_LINE_NAME = { "1호선": "Line 1", "2호선": "Line 2",
  "3호선": "Line 3", "4호선": "Line 4", "5호선": "Line 5",
  "6호선": "Line 6", "7호선": "Line 7", "8호선": "Line 8",
  "9호선": "Line 9", "신분당선": "Shinbundang Line",
  "수인·분당선": "Suin-Bundang Line", "경강선": "Gyeonggang Line" };
function enLineName(n) {
  return EN_LINE_NAME[String(n)] || String(n);
}
function enPartText(label, minutes) {
  return `${minutes} min ${EN_PART_LABEL[label] || label}`;
}
// 26i: a 26d bike trip reads 자전거 and the line is 가정값 (assumed
// 15 km/h, C-bike-speed) — trips without a mode key stay 걷기/측정.
export function commuteLines(run, agentKey, current, currentStart, lang = currentLang()) {
  const day = current.day;
  const half = halfOf(currentStart);
  const trips = ((run && run.trips) || []).filter((t) => t && t.agent === agentKey
    && t.day === day && t.purpose === "commute" && halfOf(startOf(t)) === half);
  const rides = ((run && run.aways) || []).filter((a) => a && a.agent === agentKey
    && a.day === day && a.kind === "ride" && halfOf(awayStartOf(a)) === half);
  const sumMin = (list) => Math.round(list.reduce((n, t) =>
    n + (Number.isFinite(t.minutes) ? t.minutes : 0), 0));
  const bikeTrips = trips.filter((t) => t && t.mode === "bike");
  const walk = sumMin(trips.filter((t) => !t || t.mode !== "bike"));
  const bike = sumMin(bikeTrips);
  let ride = 0;
  let wait = 0;
  const assumed = [];
  const assumedLines = [];
  const measured = [];
  // 36d: one tag per part. Walk is graph-measured; bike and
  // transfer/wait are assumed; the subway is measured only when every
  // ride's minutes come from the schedule (ride_minutes_source derived).
  // The one-line text keeps its wording for one-line screens; parts
  // carry the per-part tag (and the 환승·기다림 name) for the panel.
  let allSchedule = rides.length > 0;
  for (const a of rides) {
    const p = rideParts(a);
    ride += p.ride;
    wait += p.wait;
    assumed.push(...p.assumed);
    assumedLines.push(...(p.assumedLines || []));
    measured.push(...(p.measured || []));
    if (!p.schedule) allSchedule = false;
  }
  ride = Math.round(ride);
  wait = Math.round(wait);
  const total = walk + bike + ride + wait;
  const dir = half === "am" ? "출근" : "퇴근";
  const subwayMeasured = ride > 0 && allSchedule;
  // 36f: only real parts — zero minutes or an empty label renders
  // no part and no tag, so a part never carries two tags.
  const rawParts = [
    { label: "걷기", minutes: walk, tag: "측정" },
    ...(bikeTrips.length > 0 ? [{ label: "자전거", minutes: bike, tag: "가정값" }] : []),
    { label: "지하철", minutes: ride, tag: subwayMeasured ? "측정" : "가정값" },
    { label: "환승·기다림", minutes: wait, tag: "가정값" },
  ];
  const baseParts = rawParts.filter((p) => p.label && p.minutes > 0);
  const withText = (rows) => rows.map((p) => ({ ...p, text: `${p.label} ${p.minutes}분` }));
  const partRows = withText(baseParts);
  const parts = [
    ...(walk > 0 ? [`걷기 ${walk}분`] : []),
    ...(bikeTrips.length > 0 && bike > 0 ? [`자전거 ${bike}분`] : []),
    ...(ride > 0 ? [`지하철 ${ride}분`] : []),
    ...(wait > 0 ? [`기다림 ${wait}분`] : []),
  ];
  const tag = partRows.every((p) => p.tag === "측정") ? "측정" : "가정값";
  // 29L2: English built in code (Today's commute home: …), never glossaried.
  if (lang === "en") {
    const enParts = partRows.map((p) => ({ ...p,
      label: EN_PART_LABEL[p.label] || p.label,
      text: enPartText(p.label, p.minutes) }));
    const lines = [{ text: commuteBreakdownEn({ dir: half === "am" ? "work" : "home",
      total, walk, bike, subway: ride, wait }), tag, parts: enParts }];
    const avg = commuteOneWayMinutes(run, agentKey);
    if (Number.isFinite(avg)) {
      const days = (run && run.meta && run.meta.days) || 30;
      const runBike = ((run && run.trips) || []).some((t) => t && t.agent === agentKey
        && t.purpose === "commute" && t.mode === "bike");
      lines.push({ text: `One day of ${days} days averaging ${Math.round(avg)} min one-way`, tag: runBike ? "가정값" : "측정" });
    }
    if (assumed.length > 0) {
      const pct = Math.round(Math.max(...assumed));
      const names = [...new Set(assumedLines.filter(Boolean))];
      lines.push(names.length > 0
        ? { text: `Crowding ${pct}% on ${names.map(enLineName).join(", ")} is assumed (not measured)`, tag: "가정값", noI18n: true }
        : { text: `Crowding ${pct}% is assumed (not measured)`, tag: "가정값" });
    }
    if (measured.length > 0) {
      const top = measured.reduce((a, b) => (b.pct > a.pct ? b : a));
      const pct = Math.round(top.pct);
      const src = /서울교통공사|Seoul Metro/.test(top.source) ? "Seoul Metro" : (top.source || "Seoul Metro");
      lines.push(top.lineName
        ? { text: `Crowding ${pct}% on ${enLineName(top.lineName)} is measured (${src})`, tag: "측정", noI18n: true }
        : { text: `Crowding ${pct}% is measured (${src})`, tag: "측정" });
    }
    return lines;
  }
  const lines = [{ text: `오늘 ${dir} ${total}분 = ${parts.join(" + ")}`, tag, parts: partRows }];
  const avg = commuteOneWayMinutes(run, agentKey);
  if (Number.isFinite(avg)) {
    const days = (run && run.meta && run.meta.days) || 30;
    // A bike leg is an assumed speed (26d), so an average counting a
    // bike trip is 가정값 — same any-bike rule as the line above.
    const runBike = ((run && run.trips) || []).some((t) => t && t.agent === agentKey
      && t.purpose === "commute" && t.mode === "bike");
    lines.push({ text: `${days}일 출퇴근 편도 평균 ${Math.round(avg)}분 중 하루예요`, tag: runBike ? "가정값" : "측정" });
  }
  if (assumed.length > 0) {
    const pct = Math.round(Math.max(...assumed));
    const names = [...new Set(assumedLines.filter(Boolean))];
    lines.push(names.length > 0
      ? { text: `${names.join("·")} 혼잡 ${pct}%는 가정값이에요 (실측 없음)`, tag: "가정값" }
      : { text: `혼잡 ${pct}%는 가정값이에요 (실측 없음)`, tag: "가정값" });
  }
  if (measured.length > 0) {
    const top = measured.reduce((a, b) => (b.pct > a.pct ? b : a));
    const pct = Math.round(top.pct);
    const src = top.source || "서울교통공사";
    lines.push(top.lineName
      ? { text: `${top.lineName} 혼잡 ${pct}%는 ${src} 실측이에요`, tag: "측정" }
      : { text: `혼잡 ${pct}%는 ${src} 실측이에요`, tag: "측정" });
  }
  return lines;
}

function errandLines(run, agentKey, trip) {
  const word = ERRAND_WORD[trip.purpose];
  const mine = ((run && run.trips) || [])
    .filter((t) => t && t.agent === agentKey && t.purpose === trip.purpose)
    .sort((a, b) => (a.day - b.day) || (startOf(a) - startOf(b)));
  const idx = mine.findIndex((t) => t.id === trip.id);
  if (idx < 0) return [];
  const days = (run && run.meta && run.meta.days) || 30;
  const to = trip.to || {};
  const label = to.label || to.id || "알 수 없음";
  const walkMin = Math.round(Number.isFinite(trip.minutes) ? trip.minutes : 0);
  const bike = trip && trip.mode === "bike";
  return [
    { text: `${days}일 중 ${idx + 1}번째 ${word} · 이 집에서 모두 ${mine.length}번`, tag: "측정" },
    { text: `목적지 ${label} · ${bike ? "자전거로" : "걸어서"} ${walkMin}분`, tag: bike ? "가정값" : "측정" },
  ];
}

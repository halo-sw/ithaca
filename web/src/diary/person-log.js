// 42c: per-person 30-day log, built in code from the run's own
// records (aways + trips) — no Muse needed, so it exists even when
// the diary could not be written. Numbers come only from the record:
// clocks are record minutes, durations are record end-start, ride and
// walk minutes are record fields. No record → no entry, never invented.
//
// Aways kinds (engine/routines.js): "work"/"school" (the stay),
// "ride" (one direction each, folded into the commute entries),
// "errand" (label "… 장보기"), "park" (label "… 산책"), "wait"
// (folded into the commute), plus "clinic" and other stays.
import { activityEn } from "../i18n/en-activity.js";

export const LATE_HOME_MIN = 22 * 60; // 22:00 — arrivals at/after read 늦은 귀가

export function fmtClock(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Entry kinds are the 3D legend keys (timeline.js ACTIVITIES):
// home(집) walk(걷기) subway(지하철) work(직장) errand(장보기)
// park(공원) other(기타). school/clinic fall under other there.
function mapKind(raw) {
  const k = String(raw || "");
  if (/장보|errand|shop|mart|grocer/i.test(k)) return "errand";
  if (/산책|park|공원/i.test(k)) return "park";
  if (/직장|회사|출근|출퇴근|work|school|등교|학교/i.test(k)) return "work";
  if (/지하철|subway|ride|열차|train|caltrain/i.test(k)) return "subway";
  if (/걷|walk/i.test(k)) return "walk";
  if (/집|귀가|home/i.test(k)) return "home";
  return "other";
}

function isSchool(away) {
  return /school|등교|학교/.test(`${away.kind || ""} ${away.label || ""}`);
}

// Subway minutes for the commute out: the out ride away's own span,
// else the work stay's ride detail (new form rides / old form
// rides.out / ride_minutes / fallback). Standing minutes ride along
// when the record carries them (ride.crowdedMin).
function rideMinutes(rideAway, workAway) {
  if (rideAway && num(rideAway.end_min) != null && num(rideAway.start_min) != null) {
    return Math.round(rideAway.end_min - rideAway.start_min);
  }
  const d = workAway?.detail || {};
  const ro = d.rides?.out || d.ride || null;
  for (const v of [ro?.minutesTotal, d.ride_minutes, d.ride_fallback?.ride_minutes]) {
    if (num(v) != null) return Math.round(v);
  }
  return null;
}

function standMinutes(rideAway, workAway) {
  const ds = [rideAway?.detail?.ride, workAway?.detail?.rides?.out, workAway?.detail?.ride];
  for (const r of ds) {
    if (r && num(r.crowdedMin) != null) return Math.round(r.crowdedMin);
  }
  return null;
}

function commuteTrips(dayTrips) {
  return dayTrips
    .filter((t) => t && /^(commute|school)$/.test(String(t.purpose || "")))
    .sort((a, b) => a.depart_min - b.depart_min);
}

function outText(depart, arrive, rideMin, standMin, school, lang) {
  const en = lang === "en";
  let tail = "";
  if (rideMin != null && rideMin > 0) {
    tail = en ? ` (subway ${rideMin} min` : ` (지하철 ${rideMin}분`;
    if (standMin != null && standMin > 0) tail += en ? `, standing ${standMin} min` : `, 서서 ${standMin}분`;
    tail += ")";
  }
  if (en) return `${fmtClock(depart)} left home → ${fmtClock(arrive)} arrived at ${school ? "school" : "work"}${tail}`;
  return `${fmtClock(depart)} 집에서 출발 → ${fmtClock(arrive)} ${school ? "학교 도착" : "회사 도착"}${tail}`;
}

function backText(depart, arrive, school, lang) {
  if (lang === "en") return `${fmtClock(depart)} left ${school ? "school" : "work"} → ${fmtClock(arrive)} arrived home`;
  return `${fmtClock(depart)} ${school ? "학교에서 나옴" : "회사에서 나옴"} → ${fmtClock(arrive)} 집 도착`;
}

function buildDayEntries(dayAways, dayTrips, lang) {
  const en = lang === "en";
  const entries = [];
  const aways = [...dayAways].sort((a, b) => (a.start_min ?? 0) - (b.start_min ?? 0));
  const workAway = aways.find((w) => w.kind === "work" || w.kind === "school") || null;
  const school = workAway ? isSchool(workAway) : false;
  const rides = aways.filter((w) => w.kind === "ride");
  const rideOut = rides.find((w) => (w.detail?.direction || "out") === "out") || rides[0] || null;
  const rideBack = [...rides].reverse().find((w) => (w.detail?.direction || "out") === "back")
    || (rides.length > 1 ? rides[rides.length - 1] : null);
  const cTrips = workAway ? commuteTrips(dayTrips) : [];

  if (workAway) {
    const morning = cTrips.filter((t) => num(t.depart_min) != null && t.depart_min < workAway.start_min);
    const rideMin = rideMinutes(rideOut, workAway);
    const standMin = standMinutes(rideOut, workAway);
    let depart = morning.length > 0 ? Math.min(...morning.map((t) => t.depart_min)) : null;
    if (depart == null && rideOut) depart = rideOut.start_min;
    if (depart == null && rideMin != null && rideMin > 0) depart = workAway.start_min - rideMin;
    const walkMin = morning.length > 0
      ? Math.round(morning.reduce((a, t) => a + (num(t.minutes) ?? 0), 0)) : 0;
    const commuteShort = walkMin > 0 ? (en ? `commute ${walkMin} min` : `출근 ${walkMin}분`) : (en ? "commute" : "출근");
    if (depart != null && depart < workAway.start_min) {
      entries.push({
        minute: depart, end_minute: workAway.start_min,
        kind: rideMin != null && rideMin > 0 ? "subway" : "walk",
        text: outText(depart, workAway.start_min, rideMin, standMin, school, lang),
        short: commuteShort,
      });
    } else {
      entries.push({
        minute: workAway.start_min, end_minute: workAway.start_min,
        kind: "work",
        text: en ? `${fmtClock(workAway.start_min)} commute` : `${fmtClock(workAway.start_min)} 출근`,
        short: commuteShort,
      });
    }
    const evening = cTrips.filter((t) => num(t.depart_min) != null && t.depart_min >= workAway.end_min);
    let arrive = evening.length > 0 ? Math.max(...evening.map((t) => t.arrive_min ?? t.depart_min)) : null;
    if (arrive == null && rideBack) arrive = rideBack.end_min;
    if (arrive == null) arrive = workAway.end_min;
    if (arrive >= LATE_HOME_MIN) {
      entries.push({
        minute: arrive, end_minute: null, kind: "home",
        text: en ? `${fmtClock(arrive)} late return` : `${fmtClock(arrive)} 늦은 귀가`,
        short: en ? "late return" : "늦은 귀가",
      });
    } else if (arrive > workAway.end_min) {
      const backRide = rideBack && num(rideBack.end_min) != null && num(rideBack.start_min) != null
        ? Math.round(rideBack.end_min - rideBack.start_min) : null;
      entries.push({
        minute: workAway.end_min, end_minute: arrive,
        kind: backRide != null && backRide > 0 ? "subway" : "walk",
        text: backText(workAway.end_min, arrive, school, lang),
        short: en ? `${fmtClock(arrive)} home` : `${fmtClock(arrive)} 귀가`,
      });
    }
  }

  for (const w of aways) {
    if (w.kind === "work" || w.kind === "school" || w.kind === "ride" || w.kind === "wait") continue;
    const dwell = num(w.end_min) != null ? Math.round(w.end_min - w.start_min) : null;
    const dBit = dwell != null ? (en ? ` ${dwell} min` : ` ${dwell}분`) : "";
    if (w.kind === "errand") {
      const legs = dayTrips
        .filter((t) => t && String(t.purpose || "") === "errand" && (t.arrive_min ?? -1) <= w.start_min)
        .sort((a, b) => a.depart_min - b.depart_min);
      const walk = legs.length > 0 ? Math.round(legs[legs.length - 1].minutes ?? 0) : null;
      const tail = walk != null && walk > 0
        ? (en ? ` (walk ${walk} min to store)` : ` (마트까지 걸어서 ${walk}분)`) : "";
      const word = en ? activityEn("장보기") : "장보기";
      entries.push({ minute: w.start_min, end_minute: w.end_min, kind: "errand",
        text: `${fmtClock(w.start_min)} ${word}${dBit}${tail}`, short: word });
    } else if (w.kind === "park") {
      const word = en ? activityEn("공원") : "공원";
      entries.push({ minute: w.start_min, end_minute: w.end_min, kind: "park",
        text: `${word}${dBit}`, short: word });
    } else {
      const label = String(w.label || w.kind || "");
      const word = en ? activityEn(label) : label;
      entries.push({ minute: w.start_min, end_minute: w.end_min ?? null, kind: mapKind(w.kind || label),
        text: `${fmtClock(w.start_min)} ${word}${dBit}`, short: word });
    }
  }

  entries.sort((a, b) => a.minute - b.minute);
  return entries;
}

function strip(entry) {
  const { minute, end_minute, kind, text } = entry;
  return { minute, end_minute, kind, text };
}

export function personMonthLog(run, { lang = "ko" } = {}) {
  const L = lang === "en" ? "en" : "ko";
  const agents = Array.isArray(run?.agents) ? run.agents : [];
  const people = agents
    .filter((a) => a && a.household && !a.background)
    .map((a) => ({ key: a.key, label: a.label, role: a.role }));
  const aways = Array.isArray(run?.aways) ? run.aways : [];
  const trips = Array.isArray(run?.trips) ? run.trips : [];
  const days = [];
  for (let day = 1; day <= 30; day += 1) {
    const entries = {};
    const summary = {};
    for (const p of people) {
      const full = buildDayEntries(
        aways.filter((w) => w && w.agent === p.key && Number(w.day) === day),
        trips.filter((t) => t && t.agent === p.key && Number(t.day) === day),
        L);
      entries[p.key] = full.map(strip);
      summary[p.key] = full.map((e) => e.short).join(" · ");
    }
    days.push({ day, entries, summary });
  }
  return { people, days };
}

// The done-run payload keeps one compact log per home ({ A, B, … }):
// text strings + minutes only, never detail objects.
export function homePersonLogs(runs, labels, { lang = "ko" } = {}) {
  const out = {};
  for (const l of labels || []) {
    if (runs && runs[l]) out[l] = personMonthLog(runs[l], { lang });
  }
  return out;
}

export function getDayPersonEntries(personLog, day, personKey) {
  const d = personLog?.days?.find((x) => x.day === day);
  return d?.entries?.[personKey] || [];
}

// Index of the entry containing the minute (for the sim clock
// highlight); falls back to the last started entry, -1 when none.
export function currentEntryIndex(entries, minute) {
  let idx = -1;
  entries.forEach((e, i) => {
    if (e.minute <= minute && (e.end_minute == null || minute < e.end_minute)) idx = i;
  });
  if (idx === -1) {
    entries.forEach((e, i) => { if (e.minute <= minute) idx = i; });
  }
  return idx;
}

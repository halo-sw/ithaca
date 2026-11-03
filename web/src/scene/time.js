// Regional daylight: render-clock time zone for the loaded scene (45b).
//
// Pure, no DOM, no three.js. The UI clock shows local household time, so
// (dateISO, dayIndex, minuteOfDay) must become the absolute Date the
// sky/solar math (lighting.js, render/sky.js) needs *in the scene's own
// zone*: Asia/Seoul for Korean/default areas, America/Los_Angeles for the
// Bay Area scenes (California / Meta HQ scope, not the whole USA).
//
// Area classification mirrors aerial/drape.js isUsArea (country === "US"
// or bbox centre inside basemap.js US_BBOX); the supported Bay Area scene
// ids are places-us.js US_REGION_IDS. A valid explicit IANA zone carried
// by the area object wins over the classification.
//
// This stays separate from simulation accounting: trips, schedules, saved
// timestamps, replay seeds and sim.js simInstant are untouched — main.js
// calls sceneInstant only where it builds Dates for the sky rig.
//
// DST edge behaviour (documented, deterministic, not a scheduling engine):
// an ambiguous fall-back wall time resolves to the first occurrence
// (daylight side); a nonexistent spring-forward wall time shifts forward
// by the gap via the fixed-point iteration below.

const US_BBOX = [-125, 24, -66, 50]; // same box as basemap.js US_BBOX

export const KOREA_TZ = "Asia/Seoul";
// Only supported US scenes are the Bay Area ones — no USA-wide zone.
export const BAY_TZ = "America/Los_Angeles";
const BAY_IDS = new Set([
  "us-menlo",
  "us-st-san-francisco",
  "us-st-belmont",
  "us-st-san-carlos",
  "us-st-redwood-city",
  "us-st-palo-alto",
  "us-st-mountain-view",
  "us-st-sunnyvale",
]);

function validZone(name) {
  if (typeof name !== "string" || !name) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name }).format(new Date(0));
    return name;
  } catch {
    return null;
  }
}

// sceneTimeZone(area): area object ({id|area, country, bbox, timeZone?}),
// area id string, or zone string. Unknown/missing input is Seoul.
export function sceneTimeZone(area) {
  if (typeof area === "string") {
    return validZone(area) ?? (BAY_IDS.has(area) ? BAY_TZ : KOREA_TZ);
  }
  if (area && typeof area === "object") {
    const explicit = validZone(area.timeZone ?? area.timezone ?? area.tz);
    if (explicit) return explicit;
    const id = area.id ?? area.area;
    if (typeof id === "string" && BAY_IDS.has(id)) return BAY_TZ;
    if (area.country === "US") return BAY_TZ;
    const bb = area.bbox;
    if (Array.isArray(bb) && bb.length >= 4) {
      const lon = (Number(bb[0]) + Number(bb[2])) / 2;
      const lat = (Number(bb[1]) + Number(bb[3])) / 2;
      if (Number.isFinite(lon) && Number.isFinite(lat)
        && lon >= US_BBOX[0] && lon <= US_BBOX[2]
        && lat >= US_BBOX[1] && lat <= US_BBOX[3]) return BAY_TZ;
    }
  }
  return KOREA_TZ;
}

// Zone offset in ms behind UTC for an absolute instant (wall-UTC minus
// instant), via Intl date/time zone offsets. Respects DST.
// 45c3: cache one Intl.DateTimeFormat per zone instead of rebuilding per call.
const _dtfByZone = new Map();
function dtfFor(zone) {
  let f = _dtfByZone.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    _dtfByZone.set(zone, f);
  }
  return f;
}
function zoneOffsetMs(zone, utcMs) {
  const dtf = dtfFor(zone);
  const parts = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1,
    Number(parts.day), Number(parts.hour), Number(parts.minute),
    Number(parts.second));
  return asUtc - utcMs;
}

// sceneInstant(dateISO, day, minute, area): local wall clock on the civil
// date dateISO+day at minute (0–1439) in the scene zone -> absolute Date.
// Throws RangeError on invalid inputs — never NaN into the render loop.
export function sceneInstant(dateISO, day, minute, area) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO ?? ""));
  if (!m) throw new RangeError(`sceneInstant: bad dateISO ${JSON.stringify(dateISO)}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // 45c3: calendar round-trip — rejects nonexistent dates like 2026-02-31.
  const roundTrip = new Date(Date.UTC(y, mo - 1, d));
  if (mo < 1 || mo > 12 || d < 1 || d > 31
    || roundTrip.getUTCFullYear() !== y
    || roundTrip.getUTCMonth() !== mo - 1
    || roundTrip.getUTCDate() !== d) {
    throw new RangeError(`sceneInstant: bad dateISO ${JSON.stringify(dateISO)}`);
  }
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(`sceneInstant: bad day ${JSON.stringify(day)}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 1439) {
    throw new RangeError(`sceneInstant: bad minute ${JSON.stringify(minute)}`);
  }
  const base = new Date(Date.UTC(y, mo - 1, d) + day * 86400000);
  const wallAsUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(),
    base.getUTCDate(), Math.floor(minute / 60), minute % 60, 0);
  const zone = sceneTimeZone(area);
  // Fixed-point utc = wall - offset(utc): exact for normal times,
  // first-occurrence for ambiguous ones, gap-shifted for nonexistent ones.
  let utc = wallAsUtc - zoneOffsetMs(zone, wallAsUtc);
  utc = wallAsUtc - zoneOffsetMs(zone, utc);
  utc = wallAsUtc - zoneOffsetMs(zone, utc);
  return new Date(utc);
}

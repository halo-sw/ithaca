// Stage 38c: pure 2D walk helpers (no DOM, no network).
// dayTimeline builds time-ordered segments for one day; positionAt
// interpolates; activityLine formats the status line.
import { romanizeName } from "./i18n/romanize.js";

function fmtTime(min) {
  const m = Math.max(0, Math.round(min));
  const h = String(Math.floor(m / 60) % 24).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function isBackgroundAgent(id) {
  return typeof id === "string" && /^b\d/i.test(id);
}

function coordDist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

// Minimal Korean → English names for the fixtures/labels we format.
// Falls back to a Hangul-free placeholder so English never has Hangul.
const EN_NAMES = {
  "미금역": "Migeum Stn",
  "미금": "Migeum Stn",
  "판교역": "Pangyo Stn",
  "판교": "Pangyo Stn",
  "신분당선": "Shinbundang Line",
  "판교 직장": "Pangyo Office",
  "미금역까지": "Migeum Stn",
};

function toEnglish(label) {
  if (label == null) return "";
  const s = String(label);
  if (EN_NAMES[s] != null) return EN_NAMES[s];
  // "X역까지" → "X Stn"
  const m = s.match(/^(.+)역까지$/);
  if (m && EN_NAMES[`${m[1]}역`]) return EN_NAMES[`${m[1]}역`];
  if (/[가-힣]/.test(s)) {
    try {
      const r = romanizeName(s.replace(/까지$/g, ""));
      if (r && !/[가-힣]/.test(r)) return r;
    } catch {
      // fall through to the ASCII fallback
    }
    const base = s.replace(/까지$/g, "").replace(/역$/g, " Stn");
    const ascii = base.replace(/[가-힣]/g, "").trim();
    if (ascii && !/[가-힣]/.test(ascii)) return ascii;
    return "Place";
  }
  return s;
}

// Walk purpose fallback (used only when the trip has no `to.label`).
// Keys must never reach the screen as-is.
const PURPOSE_KO = {
  commute: "출근길",
  errand: "장보기",
  park: "산책",
  clinic: "병원",
  cafe: "카페",
  vet: "동물병원",
  school: "등굣길",
};
const PURPOSE_EN = {
  commute: "commute",
  errand: "errand",
  park: "walk",
  clinic: "clinic",
  cafe: "café",
  vet: "vet",
  school: "school",
};

export function dayTimeline(run, opts = {}) {
  const { day, agents, nodeCoordsFor, stationCoord, network } = opts;
  const trips = (run && run.trips) || [];
  const aways = (run && run.aways) || [];

  // Household = non-background agents. `agents` narrows when given.
  const seen = [];
  const collect = (a) => {
    if (a == null) return;
    const id = String(a);
    if (isBackgroundAgent(id)) return;
    if (!seen.includes(id)) seen.push(id);
  };
  trips.forEach((t) => collect(t.agent));
  aways.forEach((a) => collect(a.agent));
  let members = seen;
  if (Array.isArray(agents) && agents.length) {
    const want = agents.map(String).filter((a) => !isBackgroundAgent(a));
    members = want.length ? want.filter((a) => seen.includes(a) || true) : [];
    // keep requested order even if unseen in run
    if (!members.length) members = want;
  }
  members = members.filter((a) => !isBackgroundAgent(a));
  if (!members.length) return { segments: [], others: [] };
  const primary = members[0];

  function buildFor(agent) {
    const segs = [];
    const dayTrips = trips
      .filter((t) => t.agent === agent && (day == null || t.day === day))
      .slice()
      .sort((a, b) => (a.depart_min || 0) - (b.depart_min || 0));
    for (const t of dayTrips) {
      const pts = [];
      for (const nid of t.path || []) {
        let c = null;
        try {
          c = nodeCoordsFor ? nodeCoordsFor(String(nid), t) : null;
        } catch {
          c = null;
        }
        if (c) pts.push(c);
      }
      if (!pts.length) continue; // missing area skips walk shapes
      // `to` is an object { kind, id, label }; the purpose key is only
      // a fallback and must never reach the screen as-is.
      const toRaw = t.to && typeof t.to === "object" ? t.to.label : t.to;
      const toStr = toRaw == null ? "" : String(toRaw);
      let walkLabel = toStr;
      const purpose = t.purpose == null ? "" : String(t.purpose);
      if (!walkLabel && purpose) walkLabel = PURPOSE_KO[purpose] || purpose;
      segs.push({
        t0: t.depart_min,
        t1: t.arrive_min,
        kind: "walk",
        pts,
        label: walkLabel,
        purpose,
        fromPurpose: !toStr,
      });
    }
    const dayAways = aways
      .filter((a) => a.agent === agent && (day == null || a.day === day))
      .slice()
      .sort((a, b) => (a.start_min || 0) - (b.start_min || 0));
    for (const a of dayAways) {
      const kindRaw = String(a.kind || "");
      if (kindRaw === "ride") {
        // The engine's ride detail is an object ({ ride: { legs }}).
        // Each leg becomes one segment, splitting the away's time in
        // proportion to leg distanceKm.
        const detail = (a && a.detail && typeof a.detail === "object") ? a.detail : null;
        const legs = detail && detail.ride && Array.isArray(detail.ride.legs)
          ? detail.ride.legs : [];
        const coordOf = (name) => {
          if (!stationCoord) return null;
          try {
            return stationCoord(name);
          } catch {
            return null;
          }
        };
        const drawn = legs.map((leg) => {
          const stops = leg && Array.isArray(leg.stops)
            ? leg.stops.map((s) => String(s)) : [];
          return { leg, stops, pts: stops.map(coordOf).filter(Boolean) };
        }).filter((d) => d.pts.length >= 2);
        if (drawn.length) {
          const dists = drawn.map((d) => Number(d.leg.distanceKm));
          const total = dists.reduce(
            (s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0);
          const span = (a.end_min || 0) - (a.start_min || 0);
          let cum = 0;
          drawn.forEach((d, i) => {
            const share = total > 0 && Number.isFinite(dists[i]) && dists[i] > 0
              ? dists[i] / total : 1 / drawn.length;
            const t0 = (a.start_min || 0) + Math.round(cum * span);
            cum += share;
            const t1 = i === drawn.length - 1
              ? (a.end_min || 0) : (a.start_min || 0) + Math.round(cum * span);
            const lineName = d.leg.lineName || d.leg.line || "";
            const ends = `${d.stops[0]}→${d.stops[d.stops.length - 1]}`;
            segs.push({
              t0,
              t1,
              kind: "ride",
              pts: d.pts,
              label: lineName ? `${lineName} ${ends}` : ends,
              line: d.leg.line || null,
              lineName: d.leg.lineName || null,
              station: d.stops[0],
              stations: [...d.stops],
            });
          });
        } else {
          // No drawn legs: a straight fallback segment, else skip.
          const fb = detail && detail.ride_fallback;
          const fFrom = fb ? fb.from : null;
          const fTo = fb ? fb.to : null;
          const p0 = fFrom != null ? coordOf(fFrom) : null;
          const p1 = fTo != null ? coordOf(fTo) : null;
          if (!p0 || !p1) continue;
          const flabel = a.label || `${String(fFrom)}→${String(fTo)}`;
          segs.push({
            t0: a.start_min,
            t1: a.end_min,
            kind: "ride",
            pts: [p0, p1],
            label: String(flabel),
            line: null,
            lineName: null,
            station: String(fFrom),
            stations: [String(fFrom), String(fTo)],
          });
        }
      } else {
        // Stay: one point at the end of the previous segment.
        const prev = segs.length ? segs[segs.length - 1] : null;
        const at = prev && prev.pts.length ? prev.pts[prev.pts.length - 1] : null;
        if (!at) continue;
        segs.push({ t0: a.start_min, t1: a.end_min, kind: "stay", pts: [at], label: a.label || "", awayKind: kindRaw });
      }
    }
    segs.sort((a, b) => (a.t0 || 0) - (b.t0 || 0));
    // A walk into a station reads "<first station>역까지".
    for (let i = 0; i + 1 < segs.length; i += 1) {
      const cur = segs[i];
      const next = segs[i + 1];
      if (cur && cur.kind === "walk" && next && next.kind === "ride" && next.station) {
        cur.label = String(next.station);
        cur.toRide = true;
      }
    }
    return segs;
  }

  const segments = buildFor(primary);
  const others = members.slice(1).map((agent) => ({ agent, segments: buildFor(agent) }));
  return { segments, others };
}

export function positionAt(segments, minute) {
  const segs = Array.isArray(segments) ? segments : [];
  if (!segs.length) return null;
  const m = Number(minute);
  let seg = segs[0];
  for (const s of segs) {
    if (m >= s.t0 && (m < s.t1 || s === segs[segs.length - 1])) {
      seg = s;
      break;
    }
    if (m >= s.t1) seg = s;
    if (m < s.t0) {
      seg = s;
      break;
    }
  }
  const pts = seg.pts || [];
  if (!pts.length) return null;
  if (pts.length === 1 || seg.t1 <= seg.t0) {
    return { lon: pts[pts.length - 1][0], lat: pts[pts.length - 1][1], seg };
  }
  const frac = Math.min(1, Math.max(0, (m - seg.t0) / (seg.t1 - seg.t0)));
  const dists = [0];
  for (let i = 1; i < pts.length; i++) dists.push(dists[i - 1] + coordDist(pts[i - 1], pts[i]));
  const total = dists[dists.length - 1];
  if (!(total > 0)) {
    return { lon: pts[0][0], lat: pts[0][1], seg };
  }
  const target = frac * total;
  for (let i = 1; i < pts.length; i++) {
    if (target <= dists[i]) {
      const span = dists[i] - dists[i - 1] || 1;
      const f = (target - dists[i - 1]) / span;
      return {
        lon: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
        lat: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
        seg,
      };
    }
  }
  return { lon: pts[pts.length - 1][0], lat: pts[pts.length - 1][1], seg };
}

export function activityLine(seg, minute, lang) {
  if (!seg) return "";
  const t = fmtTime(minute);
  const en = lang === "en";
  if (seg.kind === "walk") {
    const label = String(seg.label || "");
    if (en) {
      const key = seg.fromPurpose && seg.purpose ? PURPOSE_EN[seg.purpose] : null;
      return `${t} · Walking · to ${key || toEnglish(label)}`;
    }
    let dest = label;
    if (label && !/까지$/.test(label)) {
      dest = (seg.toRide && !/역$/.test(label)) ? `${label}역까지` : `${label}까지`;
    }
    return `${t} · 걷는 중 · ${dest}`;
  }
  if (seg.kind === "ride") {
    if (en) return `${t} · ${toEnglish(seg.lineName || seg.label || "")}`;
    return `${t} · ${String(seg.label || "")}`;
  }
  const label = String(seg.label || "");
  return `${t} · ${en ? toEnglish(label) : label}`;
}

// Same `t` grammar as parseTParam in sim.js (?t=HH:MM, else bare minutes).
export function parseMapWalkMinute(t) {
  if (t == null) return null;
  const s = String(t).trim();
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh > 23 || mm > 59) return null;
    return hh * 60 + mm;
  }
  if (/^\d{1,4}$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0 && n < 1440) return n;
  }
  return null;
}

// 38c4: station pills for the map walk — the first and last station
// of every ride leg, shared transfer stations once, in travel order.
// English uses the same romanized names as the activity lines.
function endsFallback(seg) {
  const out = [];
  if (seg.station != null) out.push(String(seg.station));
  const tail = String(seg.label || "").split(" ").pop().split("→");
  if (tail.length > 1) out.push(tail[tail.length - 1]);
  return out;
}

export function stationLabelsFor(segments, lang = "ko") {
  const names = [];
  for (const s of segments || []) {
    if (!s || s.kind !== "ride") continue;
    const stops = Array.isArray(s.stations) && s.stations.length
      ? s.stations.map((n) => String(n))
      : endsFallback(s);
    for (const n of [stops[0], stops[stops.length - 1]]) {
      if (n && !names.includes(n)) names.push(n);
    }
  }
  if (lang === "en") return names.map((n) => romanizeName(n));
  return names;
}

// 38c5: pill layout — try above (6 px gap), below, then right;
// skip when all three hit a placed pill or an obstacle rect.
// `measure(text)` returns { w, h } in SVG units; `obstacles` is a
// list of already-placed rects { x, y, w, h } (pins, dot).
export function placeLabels(items, measure, obstacles = []) {
  const blocks = Array.isArray(obstacles) ? obstacles : [];
  const hits = (rect, list) => list.some((p) =>
    rect.x < p.x + p.w && p.x < rect.x + rect.w
    && rect.y < p.y + p.h && p.y < rect.y + rect.h);
  const placed = [];
  for (const it of items || []) {
    const size = measure ? measure(it.text) : null;
    const w = size && Number.isFinite(size.w) ? size.w : 0;
    const h = size && Number.isFinite(size.h) ? size.h : 0;
    const cands = [
      { x: it.x - w / 2, y: it.y - h - 6, w, h },
      { x: it.x - w / 2, y: it.y + 6, w, h },
      { x: it.x + 10, y: it.y - h / 2, w, h },
    ];
    let picked = null;
    for (const rect of cands) {
      if (!hits(rect, placed) && !hits(rect, blocks)) { picked = rect; break; }
    }
    if (!picked) continue;
    placed.push({ ...it, ...picked });
  }
  return placed;
}

// Pure URL helper: the scene URL carries a 1-based `day`; runs use a
// 0-based day. `startMinute` is null when ?t= is absent or invalid.
export function mapWalkParams(url) {
  try {
    const q = String(url || "").split("?")[1] || "";
    const p = new URLSearchParams(q);
    const day1 = Number.parseInt(p.get("day") || "1", 10) || 1;
    return {
      custom: p.get("custom"),
      home: p.get("home") || "A",
      dayIndex: Math.max(0, day1 - 1),
      startMinute: parseMapWalkMinute(p.get("t")),
    };
  } catch {
    return { custom: null, home: "A", dayIndex: 0, startMinute: null };
  }
}

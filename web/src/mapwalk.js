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

function splitStations(detail) {
  if (!detail) return [];
  return String(detail)
    .split(/[→⇒>~\-–—|/\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function lineForStations(network, from, to) {
  try {
    const lines = (network && network.lines) || [];
    for (const ln of lines) {
      const names = (ln.stops || []).map((s) => (typeof s === "string" ? s : s.name));
      if (names.includes(from) && names.includes(to)) return ln;
    }
    for (const ln of lines) {
      const names = (ln.stops || []).map((s) => (typeof s === "string" ? s : s.name));
      if (names.includes(from) || names.includes(to)) return ln;
    }
  } catch {
    // ignore
  }
  return null;
}

function lineLabel(ln, from, to) {
  if (ln) return ln.name || ln.id || `${from}–${to}`;
  return `${from}–${to}`;
}

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
      segs.push({
        t0: t.depart_min,
        t1: t.arrive_min,
        kind: "walk",
        pts,
        label: t.purpose || t.to || "",
      });
    }
    const dayAways = aways
      .filter((a) => a.agent === agent && (day == null || a.day === day))
      .slice()
      .sort((a, b) => (a.start_min || 0) - (b.start_min || 0));
    for (const a of dayAways) {
      const kindRaw = String(a.kind || "");
      if (kindRaw === "ride") {
        const names = splitStations(a.detail);
        const from = names[0];
        const to = names[names.length - 1];
        let pts = [];
        if (from && to && stationCoord) {
          // Expand through intermediate stations when the network has them.
          let chain = [from, to];
          try {
            const ln = network ? lineForStations(network, from, to) : null;
            if (ln && Array.isArray(ln.stops)) {
              const namesAll = ln.stops.map((s) => (typeof s === "string" ? s : s.name));
              const i0 = namesAll.indexOf(from);
              const i1 = namesAll.indexOf(to);
              if (i0 >= 0 && i1 >= 0) {
                chain = i0 <= i1 ? namesAll.slice(i0, i1 + 1) : namesAll.slice(i1, i0 + 1).reverse();
              }
            }
          } catch {
            // fall back to endpoints
          }
          pts = chain.map((n) => {
            try {
              return stationCoord(n);
            } catch {
              return null;
            }
          }).filter(Boolean);
        }
        if (!pts.length) continue;
        let label = a.label || "";
        try {
          if (network && from && to) {
            const ln = lineForStations(network, from, to);
            if (ln) label = lineLabel(ln, from, to);
          }
        } catch {
          // keep away label
        }
        segs.push({ t0: a.start_min, t1: a.end_min, kind: "ride", pts, label });
      } else {
        // Stay: one point at the end of the previous segment.
        const prev = segs.length ? segs[segs.length - 1] : null;
        const at = prev && prev.pts.length ? prev.pts[prev.pts.length - 1] : null;
        if (!at) continue;
        segs.push({ t0: a.start_min, t1: a.end_min, kind: "stay", pts: [at], label: a.label || "" });
      }
    }
    segs.sort((a, b) => (a.t0 || 0) - (b.t0 || 0));
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
    if (en) return `${t} · Walking · to ${toEnglish(label)}`;
    const dest = /까지$/.test(label) || !label ? label : `${label}까지`;
    return `${t} · 걷는 중 · ${dest}`;
  }
  if (seg.kind === "ride") {
    const label = String(seg.label || "");
    return `${t} · ${en ? toEnglish(label) : label}`;
  }
  const label = String(seg.label || "");
  return `${t} · ${en ? toEnglish(label) : label}`;
}

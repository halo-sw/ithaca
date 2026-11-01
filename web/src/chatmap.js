// Chat stage map data + geometry (18, part 4 — pure, no DOM).
//
// Replaces the drifting slab board with a painted map answering "where
// are my candidates, and how far from work": beige ground, open water
// and parks where the data has them, region coverage boxes as thin
// lines with quiet labels, subway lines from the network doc each in
// its line colour with station dots, a workplace pin, numbered
// candidate pins matching the card order with price tags, and commute
// lines along the subway for picked homes.

import { findPath, normalizeStation } from "./engine/journey.js";
import { romanizeName } from "./i18n/romanize.js";
import { usStationDisplay } from "./region-names.js";
import { usAreaLabel } from "./region-names.js";
import { fmtMoney, fmtWonEn } from "./money/currency.js";

export const MAP_COLORS = {
  ground: "#f3f1ec",
  water: "#c9dcea",
  park: "#dfe9d3",
  boundary: "#8f897f",
  regionLine: "#a89e8c",
  stationDot: "#ffffff",
  workPin: "#1d1b18",
  pinFill: "#ffffff",
  pinText: "#1d1b18",
  pinPicked: "#2f6fed",
  // 31f: A/B pick colours — these mirror the --ds-home-a /
  // --ds-home-b tokens (the SVG cannot read CSS vars reliably in
  // tests). A picked pill is filled with its letter's colour.
  pinA: "#b3541e",
  pinB: "#2f6fed",
  // 31f: hover/highlight is no longer blue — it is a 2 px ink
  // outline plus the lift, so it never reads as "picked B".
  pinHi: "#1d1b18",
  // 31f: default-pill border (mirrors --ds-line) and the unpicked
  // ground dot (mirrors --ds-ink-2, so it differs from the black
  // work marker).
  pinLine: "#ddd6c8",
  pinDot: "#5c564c",
  // 31g: the commute line on a home tag (mirrors --ds-accent) and
  // the count-circle fill (a soft translucent tint of it).
  commute: "#2f6fed",
  cluster: "rgba(47,111,237,0.18)",
  pickedRing: "#2f9e44",
  road: "#ffffff",
  roadCasing: "#e2ddd3",
  regionLabel: "#a39d92",
  // 29L3: station-label backplate — the map ground colour, so our
  // full name (with 역) covers the basemap's own label underneath.
  stationPlate: "#f3f1ec",
  stationRing: "#55514a",
  muted: "#8f897f",
};

// 26o: the raster basemap (VWorld / USGS) is muted through an SVG
// filter so our own layers read on top. Slope lightens toward
// white; saturate near zero drops the tile colours.
export const BASEMAP_MUTE = { saturate: 0.12, slope: 0.72 };

// Official Seoul metropolitan subway colours, by network line id. The
// map reads line.color from the network doc first — this table only
// fills lines that carry none.
export const LINE_COLORS = {
  line1: "#0052A4",
  line2: "#00A84D",
  line3: "#EF7C1C",
  line4: "#00A5DE",
  line5: "#996CAC",
  line6: "#CD7C2F",
  line7: "#747F00",
  line8: "#E6186C",
  line9: "#BDB092",
  bundang: "#F5A200",
  sinbundang: "#D4003B",
  gyeonggang: "#003DA5",
  gyeongui: "#77C4A3",
  arex: "#0090D2",
  uisinseol: "#B0CE18",
  sillim: "#6789CA",
  caltrain: "#E31837",
};
export const LINE_FALLBACK_COLOR = "#6b7280";

export function lineColorFor(line) {
  if (!line) return LINE_FALLBACK_COLOR;
  if (line.color) return line.color;
  return LINE_COLORS[line.id] || LINE_FALLBACK_COLOR;
}

const normName = (s) => String(s || "").replace(/\s+/g, "");

export function findStop(network, name) {
  const want = normalizeStation(name);
  if (!want) return null;
  for (const line of (network && network.lines) || []) {
    for (const s of line.stops || []) {
      if (!Number.isFinite(s.lon) || !Number.isFinite(s.lat)) continue;
      if (normalizeStation(s.name) === want || normName(s.name) === normName(name)) {
        return { line: line.id, name: s.name, lon: s.lon, lat: s.lat };
      }
    }
  }
  return null;
}

// Flattened degrees: x compensates longitude by latitude so the fit is
// honest away from the equator.
export function flatXY(lon, lat, lat0) {
  const k = Math.cos((lat0 * Math.PI) / 180) || 1;
  return [(lon || 0) * k, lat || 0];
}

export function haversineKm(aLon, aLat, bLon, bLat) {
  const r = (d) => (d * Math.PI) / 180;
  const s = Math.sin(r(bLat - aLat) / 2) ** 2
    + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

// Split long hops so no drawn segment exceeds maxKm (linear in
// lon/lat — the drawn line stays on the same track segment, only
// with intermediate vertices). Returns a new array.
export function densifyPts(pts, maxKm = 2.5) {
  const list = (pts || []).filter((p) => Array.isArray(p)
    && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (list.length < 2) return list.map((p) => [p[0], p[1]]);
  const out = [[list[0][0], list[0][1]]];
  for (let i = 1; i < list.length; i++) {
    const [ax, ay] = list[i - 1];
    const [bx, by] = list[i];
    const n = Math.max(1, Math.ceil(haversineKm(ax, ay, bx, by) / maxKm));
    for (let k = 1; k <= n; k++) {
      out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
  }
  return out;
}

// Fit lon/lat points into a W×H stage with at least `margin` (fraction)
// of each side clear. Returns {view:[x,y,w,h], toXY} where toXY maps
// lon/lat to stage px. Single points and empty input fall back to a
// default span around the centre so the panel still fills. The optional
// `inset` ({top,right,bottom,left} px) fits the data into the inner
// rectangle so pills and trays never clip; empty inset keeps 1:1.
export const MAP_FIT_MARGIN = 0.08;
// 31n: the smallest free band the measured fit leaves (stage px).
export const MAP_FIT_MIN_FREE = 120;

// 31n: fit inset from measured chrome (all stage px in, stage px
// out). top is the top-left stack bottom (filter row / title /
// legend), bottom the tray cover over the stage (or the credit
// height when the tray is off the map), right the control-column
// width, tagH the tallest tag height. The top reserves one tag
// above the topmost pin (+ 8); the other sides add 16 px; left is
// always 16. When the chrome would leave less than 120 px free,
// the vertical (or horizontal) insets shrink proportionally so the
// pins still show.
export function fitInsetFromChrome({ W, H, top, bottom, right, tagH }) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  let t = Math.max(0, Number(top) || 0) + Math.max(0, Number(tagH) || 0) + 8;
  let b = Math.max(0, Number(bottom) || 0) + 16;
  let r = Math.max(0, Number(right) || 0) + 16;
  let l = 16;
  if (t + b > h - MAP_FIT_MIN_FREE) {
    const free = Math.max(0, h - MAP_FIT_MIN_FREE);
    const sum = t + b;
    if (sum > 0) { t = (t / sum) * free; b = (b / sum) * free; }
    else { t = 0; b = 0; }
  }
  if (l + r > w - MAP_FIT_MIN_FREE) {
    const free = Math.max(0, w - MAP_FIT_MIN_FREE);
    const sum = l + r;
    if (sum > 0) { l = (l / sum) * free; r = (r / sum) * free; }
    else { l = 0; r = 0; }
  }
  return { top: t, right: r, bottom: b, left: l };
}
// Closest the map ever zooms: a ~1.2 km wide view keeps a few
// streets and stations visible around tight candidate clusters.
export const MAP_MIN_VIEW_KM = 1.2;
const KM_PER_DEG = 111.32;

export function fitMapView(points, W, H, margin = MAP_FIT_MARGIN, inset = null) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const m = Math.min(0.4, Math.max(0, Number(margin) || 0));
  const pad = inset || {};
  const padL = Math.max(0, Number(pad.left) || 0);
  const padR = Math.max(0, Number(pad.right) || 0);
  const padT = Math.max(0, Number(pad.top) || 0);
  const padB = Math.max(0, Number(pad.bottom) || 0);
  const iw = Math.max(1, w - padL - padR);
  const ih = Math.max(1, h - padT - padB);
  const list = (points || []).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  let lon0, lat0, lon1, lat1;
  if (list.length === 0) {
    lon0 = 127.0; lat0 = 37.4; lon1 = 127.16; lat1 = 37.55;
  } else {
    lon0 = Math.min(...list.map((p) => p.lon));
    lon1 = Math.max(...list.map((p) => p.lon));
    lat0 = Math.min(...list.map((p) => p.lat));
    lat1 = Math.max(...list.map((p) => p.lat));
  }
  const midLat = (lat0 + lat1) / 2;
  let [fx0] = flatXY(lon0, lat0, midLat);
  let [fx1] = flatXY(lon1, lat1, midLat);
  let fw = Math.max(fx1 - fx0, 0);
  let fh = Math.max(lat1 - lat0, 0);
  const cx = (fx0 + fx1) / 2;
  const cy = (lat0 + lat1) / 2;
  // Pad so the pins keep `margin` clear on every side (the padded
  // span is span/(1-2m), so edge pins sit exactly at m), then widen
  // the narrower axis to the stage aspect so the panel fills edge to
  // edge.
  fw /= Math.max(1 - 2 * m, 0.2);
  fh /= Math.max(1 - 2 * m, 0.2);
  const want = iw / ih;
  if (!(fw > 0) && !(fh > 0)) {
    fw = MAP_MIN_VIEW_KM / KM_PER_DEG;
    fh = fw / want;
  } else {
    if (fw / fh < want) fw = fh * want;
    else fh = fw / want;
  }
  // Close clusters zoom until the bbox fills the view, but never
  // closer than ~1.2 km wide; wider bboxes keep the exact fit above.
  const minW = MAP_MIN_VIEW_KM / KM_PER_DEG;
  if (fw < minW) {
    fh *= minW / fw;
    fw = minW;
  }
  const view = [cx - fw / 2, cy - fh / 2, fw, fh];
  const toXY = (lon, lat) => {
    const [fx] = flatXY(lon, lat, midLat);
    return [padL + (((fx - view[0]) / view[2]) * iw),
      padT + (((view[1] + view[3] - lat) / view[3]) * ih)];
  };
  // 25a: the exact inverse of toXY (for the raster basemap), plus
  // the base metres-per-pixel: the flat-degree span back to real
  // metres over the inner width.
  const k = Math.cos((midLat * Math.PI) / 180) || 1;
  const toLonLat = (x, y) => [
    (view[0] + (((x - padL) / iw) * view[2])) / k,
    view[1] + view[3] - (((y - padT) / ih) * view[3]),
  ];
  const metersPerPx = (view[2] * 111320) / iw;
  return { view, toXY, toLonLat, midLat, metersPerPx };
}

// Simplify + round one lon/lat ring (~18 m spacing, ~1 m precision).
const RING_STEP = 0.0002;
const r5 = (v) => Math.round(v * 1e5) / 1e5;

function simplifyRing(ring) {
  const out = [];
  let last = null;
  for (const pt of ring || []) {
    if (!Array.isArray(pt) || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
    if (last && Math.abs(pt[0] - last[0]) < RING_STEP
      && Math.abs(pt[1] - last[1]) < RING_STEP) continue;
    out.push([r5(pt[0]), r5(pt[1])]);
    last = pt;
  }
  return out;
}

function ringsOf(geometry) {
  const coords = geometry && geometry.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const polys = Array.isArray(coords[0][0][0]) ? coords.flat() : coords;
  return polys.filter(Array.isArray);
}

const WATER_KINDS = new Set(["natural:water", "waterway:riverbank", "waterway:dock"]);
const PARK_KINDS = new Set(["leisure:park", "leisure:garden"]);

// Water + park rings out of one box area.json landuse list.
export function extractGreenRings(landuse) {
  const water = new Map();
  const parks = new Map();
  for (const item of landuse || []) {
    const target = WATER_KINDS.has(item && item.kind) ? water
      : PARK_KINDS.has(item && item.kind) ? parks : null;
    if (!target) continue;
    for (const ring of ringsOf(item.geometry)) {
      const simple = simplifyRing(ring);
      if (simple.length < 4) continue;
      target.set(JSON.stringify(simple), simple);
    }
  }
  return { water: [...water.values()], parks: [...parks.values()] };
}

// Door-to-work minutes: the fastest mode (29N2b best) for US homes,
// else the labelled Caltrain total, else (commute.work) when known,
// else the walk + ride sum.
export function commuteMinutesOf(candidate) {
  if (candidate && Number.isFinite(candidate.best_min)) return candidate.best_min;
  if (candidate && Number.isFinite(candidate.corridor_min)) return candidate.corridor_min;
  const c = (candidate && candidate.commute) || {};
  const workMin = c.work && c.work.minutes;
  if (Number.isFinite(workMin)) return Math.round(workMin * 10) / 10;
  const walk = (c.walk && c.walk.known ? c.walk.minutes : 0) || 0;
  const ride = (c.ride && c.ride.known ? c.ride.minutes : 0) || 0;
  const total = Math.round((walk + ride) * 10) / 10;
  return total > 0 ? total : null;
}

// The subway path a picked home rides to work, through the same router
// the engine prices. Legs carry their line colour; null when either end
// is unknown or unroutable (never invented).
export function commutePathFor(network, boardStation, workStation) {
  if (!network || !boardStation || !workStation) return null;
  let path;
  try {
    path = findPath(network, boardStation, workStation, 2.0);
  } catch {
    return null;
  }
  if (!path || !Array.isArray(path.legs) || path.legs.length === 0) return null;
  const coords = new Map();
  for (const line of network.lines || []) {
    for (const s of line.stops || []) coords.set(s.id, [s.lon, s.lat]);
  }
  const legs = [];
  for (const leg of path.legs) {
    const pts = (leg.stopIds || []).map((id) => coords.get(id)).filter(Boolean);
    if (pts.length < 2) continue;
    const line = (network.lines || []).find((l) => l.id === leg.line) || { id: leg.line };
    legs.push({ line: leg.line, color: lineColorFor(line), pts });
  }
  if (legs.length === 0) return null;
  return { legs, transfers: path.transfers || [] };
}

export function buildChatMap({ regions, network, tiles, green, candidates, picks, workplaceStation, workPlace, tenure }) {
  const regionList = (regions && regions.regions) || regions || [];
  const regionBoxes = (Array.isArray(regionList) ? regionList : []).map((r) => ({
    id: r.id, label: r.label || r.id, bbox: r.bbox || null,
  })).filter((r) => Array.isArray(r.bbox));
  const stopCoords = new Map();
  for (const l of (network && network.lines) || []) {
    for (const s of l.stops || []) {
      if (Number.isFinite(s.lon) && Number.isFinite(s.lat)) stopCoords.set(s.id, s);
    }
  }
  const patternPts = (l, p) => {
    if (Array.isArray(p.geometry) && p.geometry.length > 1) {
      return densifyPts(p.geometry.filter((g) => Array.isArray(g)
        && Number.isFinite(g[0]) && Number.isFinite(g[1])));
    }
    const pstops = Array.isArray(p.stops) ? p.stops : [];
    const pts = [];
    for (const s of pstops) {
      if (Array.isArray(s)) {
        if (Number.isFinite(s[0]) && Number.isFinite(s[1])) pts.push(s);
        continue;
      }
      if (s && Number.isFinite(s.lon) && Number.isFinite(s.lat)) { pts.push([s.lon, s.lat]); continue; }
      const id = (s && s.id) || s;
      const c = stopCoords.get(id);
      if (c) pts.push([c.lon, c.lat]);
    }
    return densifyPts(pts);
  };
  const lines = [];
  for (const l of (network && network.lines) || []) {
    const patterns = Array.isArray(l.patterns) ? l.patterns : [];
    if (patterns.length > 0) {
      const seen = new Set();
      for (const p of patterns) {
        const dir = p.direction || "";
        if (seen.has(dir)) continue;
        seen.add(dir);
        const pts = patternPts(l, p);
        if (pts.length < 2) continue;
        lines.push({ id: l.id, name: l.name, color: lineColorFor(l), direction: dir, pts });
      }
      continue;
    }
    lines.push({
      id: l.id, name: l.name, color: lineColorFor(l),
      pts: (l.stops || []).filter((s) => Number.isFinite(s.lon) && Number.isFinite(s.lat))
        .map((s) => [s.lon, s.lat, s.name]),
    });
  }
  const stations = [];
  for (const l of (network && network.lines) || []) {
    for (const s of l.stops || []) {
      if (!Number.isFinite(s.lon) || !Number.isFinite(s.lat)) continue;
      stations.push({ line: l.id, name: s.name, lon: s.lon, lat: s.lat });
    }
  }
  const list = candidates || [];
  const picked = new Set(picks || []);
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letterOf = new Map((picks || []).map((id, i) => [id, LETTERS[i] || String(i + 1)]));
  // 29N2f: the layout identity is id + region + candidate index —
  // old US data repeats ids across areas (us-home-0021 in every
  // file), and a repeated id must never merge two homes into one pin.
  const pins = list.map((c, i) => ({
    n: i + 1,
    id: c.id,
    key: `${c.id}::${c.region || ""}::${i}`,
    lon: c.lon,
    lat: c.lat,
    picked: picked.has(c.id),
    letter: letterOf.get(c.id) || null,
    commuteMin: commuteMinutesOf(c),
    candidate: c,
  })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const workStop = findStop(network, workplaceStation);
  // 26c: an explicit place pin (Meta HQ lon/lat) wins over the
  // stop-based pin; the 회사 pill labels it as is.
  const workPin = workPlace && Number.isFinite(workPlace.lon) && Number.isFinite(workPlace.lat)
    ? { name: workPlace.name, lon: workPlace.lon, lat: workPlace.lat }
    : workStop ? { ...workStop } : null;
  const commutes = [];
  for (const p of pins) {
    if (!p.picked) continue;
    const board = p.candidate && p.candidate.commute && p.candidate.commute.walk
      && p.candidate.commute.walk.known ? p.candidate.commute.walk.station : null;
    const path = commutePathFor(network, board, workplaceStation);
    if (!path) continue;
    // 29N2f: React keys below read pinId — the pin key, so two
    // picked homes sharing an id still key uniquely.
    commutes.push({ label: `후보 ${p.n}`, pinId: p.key, minutes: p.commuteMin, ...path });
  }
  const tileWater = [];
  const tileBounds = [];
  const roads = [];
  for (const t of tiles || []) {
    for (const b of t.boundaries || []) {
      if (Array.isArray(b.pts) && b.pts.length > 1) {
        tileBounds.push({ name: b.name || "", pts: b.pts });
      }
    }
    for (const wseg of t.water || []) {
      if (Array.isArray(wseg.pts) && wseg.pts.length > 1) {
        tileWater.push({ closed: !!wseg.closed, name: wseg.name || "", pts: wseg.pts });
      }
    }
    for (const r of t.roads || []) {
      if (Array.isArray(r.pts) && r.pts.length > 1) {
        roads.push({ cls: r.class, pts: r.pts });
      }
    }
  }
  return {
    regions: regionBoxes,
    lines,
    stations,
    pins,
    workPin,
    commutes,
    tileBounds,
    tileWater,
    roads,
    green: { water: (green && green.water) || [], parks: (green && green.parks) || [] },
    tenure: tenure || null,
  };
}

// Short pill price (19b — pure). 전세 shows the deposit only
// ("1억 7,700"); 월세 shows monthly over deposit ("월 60 / 1,000",
// both in 만원).
export function shortPinPrice(candidate, tenure) {
  const c = candidate || {};
  const t = (c.tenures || []).find((x) => x.tenure === tenure)
    || (c.tenures || [])[0] || null;
  if (!t || t.median_won === null || t.median_won === undefined) return "가격 미정";
  // 26c: a USD row pins its dollar rent.
  if ((c.currency || t.currency) === "USD") {
    const v = Number(t.median_won);
    if (!Number.isFinite(v)) return "가격 미정";
    return fmtMoney(v, "USD");
  }
  if (t.tenure === "wolse") {
    const dep = Number(t.deposit_median_won);
    const mon = Number(t.median_won);
    if (!Number.isFinite(dep) || !Number.isFinite(mon)) return "가격 미정";
    return `월 ${Math.round(mon / 10000).toLocaleString("ko-KR")} / ${Math.round(dep / 10000).toLocaleString("ko-KR")}`;
  }
  const v = Number(t.median_won);
  if (!Number.isFinite(v)) return "가격 미정";
  if (v >= 100000000) {
    const eok = Math.floor(v / 100000000);
    const man = Math.floor((v % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}` : `${eok}억`;
  }
  if (v >= 10000) return `${Math.floor(v / 10000).toLocaleString("ko-KR")}만`;
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}

// Pill width in stage px for a short price: side pads + the 16 px
// number circle + a gap + ~7 px per ASCII char, ~12 px per CJK char.
export function pinPillWidthPx(short) {
  let tw = 0;
  for (const ch of String(short || "")) tw += ch.codePointAt(0) > 0xff ? 12 : 7;
  return 8 + 16 + 6 + tw + 8;
}

// 31g: the two-part home tag. Header text is `{n} · {area}㎡` (the
// picked letter instead of n for A/B); the area mirrors what the
// candidate card shows for 면적 (sizeLabel, else the tenure bucket
// centre, else area_m2).
// 31j: the same lines in English, built here (never by the DOM
// translator) and measured in the rendering language, so the tag
// fits its text. Phone tags (stage width ≤ 480 px) use the compact
// type sizes below.
export const TAG_HEADER_H = 18;

export function tagLineWidthPx(text, px) {
  let tw = 0;
  for (const ch of String(text || "")) tw += ch.codePointAt(0) > 0xff ? px : Math.round(px * 0.58);
  return tw;
}

// 31j: tag type sizes — header / price / commute px, total side
// padding, and the minimum tag width. Phone tags are compact.
export function tagFontPx(opts) {
  const c = !!(opts && opts.compact);
  return c
    ? { header: 10, price: 13, commute: 11, pad: 12, minW: 56, padX: 6 }
    : { header: 11, price: 14, commute: 12, pad: 16, minW: 64, padX: 8 };
}

export function tagAreaM2(candidate) {
  const c = candidate || {};
  if (Number.isFinite(Number(c.area_m2)) && Number(c.area_m2) > 0) return Number(c.area_m2);
  const first = (c.tenures || [])[0] || null;
  if (first && Number.isFinite(Number(first.bucket_center_m2))) return Number(first.bucket_center_m2);
  const m = String(c.sizeLabel || "").match(/[\d.]+/);
  if (m && Number.isFinite(Number(m[0]))) return Number(m[0]);
  return null;
}

// 31j: a missing or 0 area reads as just the number/letter —
// never `3 · 0m²`. English headers use `30 m²`.
export function tagHeaderFor(pin, lang) {
  const p = pin || {};
  const glyph = (p.picked && p.letter) ? p.letter : String(p.n ?? "");
  const area = tagAreaM2(p.candidate);
  if (!Number.isFinite(Number(area)) || Number(area) <= 0) return glyph;
  const a = Number(area);
  return lang === "en" ? `${glyph} · ${a} m²` : `${glyph} · ${a}㎡`;
}

const TENURE_FIRST = { jeonse: "전", wolse: "월", monthly: "월", sale: "매", maemae: "매" };

// 31j: English tenure initials over the card's short money style
// (`J ₩260M`, `M ₩600K / ₩10M`, `S ₩300M`). USD stays `$4,261`.
// 34a: built from the tenure numbers (never by the DOM translator),
// Korean output byte-identical.
const TENURE_FIRST_EN = { jeonse: "J", wolse: "M", monthly: "M", sale: "S", maemae: "S" };

export function tagPriceLine(candidate, tenure, lang, opts) {
  const short = shortPinPrice(candidate, tenure);
  if (!short || short === "가격 미정" || short.startsWith("$")) return short;
  if (lang === "en") {
    const list = (candidate && candidate.tenures) || [];
    const entry = list.find((t) => t.tenure === tenure) || list[0] || null;
    const initial = TENURE_FIRST_EN[tenure || (entry && entry.tenure)];
    // 29M2: one shared tenure needs no letter in English (the legend
    // names it); mixed tenures keep the 34a letters. An explicit
    // mixedTenure wins; otherwise a multi-tenure candidate reads as
    // mixed.
    const mixed = opts && opts.mixedTenure !== undefined
      ? !!opts.mixedTenure : list.length > 1;
    const withInitial = (line) => (mixed && initial ? `${initial} ${line}` : line);
    if (entry && entry.tenure === "wolse") {
      const dep = Number(entry.deposit_median_won);
      const mon = Number(entry.median_won);
      if (Number.isFinite(dep) && Number.isFinite(mon)) {
        const line = `${fmtWonEn(mon)} / ${fmtWonEn(dep)}`;
        return withInitial(line);
      }
    } else if (entry && Number.isFinite(Number(entry.median_won))) {
      const line = fmtWonEn(entry.median_won);
      return withInitial(line);
    }
    return short;
  }
  if (/^[전월매]/.test(short)) return short;
  const list = (candidate && candidate.tenures) || [];
  const entry = list.find((t) => t.tenure === tenure) || list[0] || null;
  const first = TENURE_FIRST[tenure || (entry && entry.tenure)];
  return first ? `${first} ${short}` : short;
}

export function tagCommuteLine(pin, lang) {
  const m = pin && pin.commuteMin;
  if (m === null || m === undefined || !Number.isFinite(Number(m))) return null;
  return lang === "en" ? `${Math.round(m)} min` : `출근 ${Math.round(m)}분`;
}

// 31j: one place for a tag's three lines in the rendering
// language — the tag measures and paints exactly these strings.
export function tagLines(pin, opts) {
  const o = opts || {};
  const commute = tagCommuteLine(pin, o.lang);
  if (o.sharedRent && commute) {
    // 29k2: every home shares one ZIP rent, so the bold line leads
    // with the commute (English: `N min to work`); the money line
    // is said once above the list instead.
    const m = pin && pin.commuteMin;
    const price = (o.lang === "en" && Number.isFinite(Number(m)))
      ? `${Math.round(m)} min to work`
      : commute;
    return {
      header: tagHeaderFor(pin, o.lang),
      price,
      commute: null,
    };
  }
  return {
    header: tagHeaderFor(pin, o.lang),
    price: tagPriceLine(pin && pin.candidate, o.tenure, o.lang,
      { mixedTenure: o.mixedTenure }),
    commute,
  };
}

// 31g: measured tag size — the widest of the header / price /
// commute lines + padding (minimum 64 px, 56 px compact). The
// body shrinks away when there is no commute line. 31j: the width
// is measured on the rendering-language lines.
export function tagSizePx(pin, tenure, lang, opts) {
  const t = tagFontPx(opts);
  const lines = tagLines(pin, { tenure, lang,
    sharedRent: opts && opts.sharedRent,
    mixedTenure: opts && opts.mixedTenure });
  // 31m: { short: true } measures the compact form — header +
  // price, no commute line — for crowded stages.
  const commute = (opts && opts.short) ? null : lines.commute;
  const w = Math.max(t.minW, Math.ceil(Math.max(
    tagLineWidthPx(lines.header, t.header),
    tagLineWidthPx(lines.price, t.price),
    commute ? tagLineWidthPx(commute, t.commute) : 0,
  )) + t.pad);
  return { w, h: TAG_HEADER_H + (commute ? 46 : 26) };
}

// 31g: count-circle diameter — 36 px, 44 px when the count ≥ 100.
export function clusterSizePx(count) {
  return Number(count) >= 100 ? 44 : 36;
}

// Price-tag layout (18f — pure, stage px in, boxes out). Pins closer
// than PIN_FAN_PX fan out around their true point (thin leader back
// to it); each tag tries right, left, above, below, and otherwise
// offsets diagonally with a short leader line to its pin.
export const PIN_FAN_PX = 18;
export const TAG_H_PX = 15;
const TAG_GAP = 12;
const TAG_PAD = 2;

export function tagWidthPx(tag) {
  return String(tag || "").length * 7 + 14;
}

const boxHit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
  && a.y < b.y + b.h && b.y < a.y + a.h;

const clampBox = (box, W, H) => ({
  ...box,
  x: Math.min(Math.max(box.x, TAG_PAD), Math.max(TAG_PAD, W - box.w - TAG_PAD)),
  y: Math.min(Math.max(box.y, TAG_PAD), Math.max(TAG_PAD, H - box.h - TAG_PAD)),
});

// Nearest point on a box to (x, y) — the leader-line landing.
function nearestOnBox(box, x, y) {
  return [
    Math.min(Math.max(x, box.x), box.x + box.w),
    Math.min(Math.max(y, box.y), box.y + box.h),
  ];
}

// points: [{ id, x, y, tag }]. Returns [{ id, x, y, box, tx, ty,
// pinLeader ([trueX, trueY] when fanned) , tagLeader ([lx, ly] when
// the tag sits off its pin) }] in input order.
export function layoutPinLabels(points, W, H) {
  const list = (points || []).map((p) => ({ ...p }));
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  // Fan-out: connected components under PIN_FAN_PX spread on a
  // circle around their centroid, each keeping a leader to truth.
  const comp = list.map((_, i) => i);
  const find = (i) => (comp[i] === i ? i : (comp[i] = find(comp[i])));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const dx = list[i].x - list[j].x;
      const dy = list[i].y - list[j].y;
      if (Math.hypot(dx, dy) < PIN_FAN_PX) {
        const a = find(i);
        const b = find(j);
        if (a !== b) comp[b] = a;
      }
    }
  }
  const groups = new Map();
  list.forEach((p, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  const dots = list.map((p) => ({ x: p.x, y: p.y, pinLeader: null }));
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const cx = idxs.reduce((s, i) => s + list[i].x, 0) / idxs.length;
    const cy = idxs.reduce((s, i) => s + list[i].y, 0) / idxs.length;
    const R = Math.max(12, (12 * idxs.length) / Math.PI);
    idxs.forEach((pi, k) => {
      const ang = (-Math.PI / 2) + (k * 2 * Math.PI) / idxs.length;
      dots[pi] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang),
        pinLeader: [list[pi].x, list[pi].y] };
    });
  }
  // Tag boxes, first-fit over centred-above / right / left /
  // below. The first placement is centred above the anchor (the pill
  // tail bridges `p.tail` px down to the anchor point); only colliding
  // boxes move to the later slots.
  const placed = [];
  return list.map((p, i) => {
    const d = dots[i];
    const tw = Number(p.w) > 0 ? p.w : tagWidthPx(p.tag);
    const th = Number(p.h) > 0 ? p.h : TAG_H_PX;
    const tail = Number(p.tail) > 0 ? p.tail : 0;
    const cands = [
      { x: d.x - tw / 2, y: d.y - tail - th, w: tw, h: th },
      { x: d.x + TAG_GAP, y: d.y - th / 2, w: tw, h: th },
      { x: d.x - TAG_GAP - tw, y: d.y - th / 2, w: tw, h: th },
      { x: d.x - tw / 2, y: d.y + TAG_GAP, w: tw, h: th },
    ].map((b) => clampBox(b, w, h));
    const distOf = (b) => Math.hypot(b.x + b.w / 2 - d.x, b.y + b.h / 2 - d.y);
    // 29N2b: a tag never strands far from its dot — a first-fit box
    // more than 120 px away is rejected (the spiral below stays
    // within 120), and one moved more than 24 px keeps a leader.
    let box = cands.find((b) => distOf(b) <= 120
      && !placed.some((q) => boxHit(b, q))) || null;
    let tagLeader = box && distOf(box) > 24 ? nearestOnBox(box, d.x, d.y) : null;
    if (!box) {
      // Spiral staircase away from the pin until a free box lands.
      const angs = [Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4,
        (-3 * Math.PI) / 4, 0, Math.PI / 2, -Math.PI / 2, Math.PI];
      outer: for (let r = 26; r <= 120; r += 14) {
        for (const a of angs) {
          const b = clampBox({ x: d.x + r * Math.cos(a) - tw / 2,
            y: d.y + r * Math.sin(a) - th / 2, w: tw, h: th }, w, h);
          if (!placed.some((q) => boxHit(b, q))) { box = b; break outer; }
        }
      }
      if (!box) {
        const bottom = placed.reduce((m, q) => Math.max(m, q.y + q.h), d.y + TAG_GAP);
        box = { x: d.x - tw / 2, y: bottom + 4, w: tw, h: th };
        // The last resort still stays within 120 px of the dot
        // (pulled back along its direction), never dropped silently.
        const dd = distOf(box);
        if (dd > 120 && dd > 0) {
          const k = 120 / dd;
          box = clampBox({ x: d.x + (box.x + box.w / 2 - d.x) * k - box.w / 2,
            y: d.y + (box.y + box.h / 2 - d.y) * k - box.h / 2,
            w: box.w, h: box.h }, w, h);
        }
      }
      tagLeader = nearestOnBox(box, d.x, d.y);
    }
    placed.push(box);
    return { id: p.id, x: d.x, y: d.y, box,
      tx: box.x + box.w / 2, ty: box.y + 11.5,
      pinLeader: d.pinLeader, tagLeader };
  });
}

// --- 21b: map pills with priority + clustering --------------------------------------
//
// Greedy like placeLabels in labels3d.js, but for price pills. Items:
// [{ id, kind, x, y, w, h, rank }] — rank 0 is the 회사 pill, rank 1 is
// a picked (A/B/C) pill, rank 2 is the rest. Rank order wins: a pill
// that would overlap takes the next free slot with a short leader line
// back to its anchor; a rank-2 pill with no free slot folds into a
// "+N" cluster pill. Rank 0/1 pills are always placed.
//
// Returns [{ id, kind, x, y, w, h, box, leader, count, members }] in
// placement order — members lists the folded pill ids of a cluster
// (kind "cluster"), leader is the box landing point ([lx, ly]) when the
// pill sits off its anchor, else null. 31n: obstacles are stage-px
// boxes treated as already occupied (overlay chrome: the top
// stack, the control column, the tray, the open pin card) —
// every pill including rank 0 avoids them.
// 31m: each tag tries the full tag, then the compact form (the
// item's alt size — header + price, no commute line), then folds;
// a compact placement reports short: true. Rank 1 still forces
// its home slot when neither fits; rank 0 is unchanged.
const PILL_GAP = 12;
const PILL_PAD = 2;

const clampPill = (box, W, H, free) => {
  const lx = free ? free.x : PILL_PAD;
  const ty = free ? free.y : PILL_PAD;
  const rx = free ? free.x + free.w - box.w : W - box.w - PILL_PAD;
  const by = free ? free.y + free.h - box.h : H - box.h - PILL_PAD;
  return {
    ...box,
    x: Math.min(Math.max(box.x, lx), Math.max(lx, rx)),
    y: Math.min(Math.max(box.y, ty), Math.max(ty, by)),
  };
};

function pillSlots(x, y, w, h) {
  return [
    { x: x - w / 2, y: y - 6 - h, w, h },
    { x: x + PILL_GAP, y: y - h / 2, w, h },
    { x: x - PILL_GAP - w, y: y - h / 2, w, h },
    { x: x - w / 2, y: y + PILL_GAP, w, h },
  ];
}

function spiralPill(x, y, w, h, taken, W, H) {
  const angs = [Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4,
    (-3 * Math.PI) / 4, 0, Math.PI / 2, -Math.PI / 2, Math.PI];
  // 29N2b: a tag moves at most 120 px from its dot — past that the
  // compact form, then a group card, takes it (never a far tag).
  for (let r = 26; r <= 120; r += 16) {
    for (const a of angs) {
      const b = clampPill({ x: x + r * Math.cos(a) - w / 2,
        y: y + r * Math.sin(a) - h / 2, w, h }, W, H);
      if (!taken.some((q) => boxHit(b, q))) return b;
    }
  }
  return null;
}

export function clusterPillWidthPx(count) {
  return pinPillWidthPx(`+${count}`);
}

export function layoutMapPills(items, W, H, obstacles) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const list = (items || []).map((p, i) => ({ ...p, _i: i }));
  list.sort((a, b) => ((a.rank ?? 2) - (b.rank ?? 2)) || (a._i - b._i));
  const taken = [];
  const out = [];
  const spill = [];
  const tryBox = (x, y, tw, th) => pillSlots(x, y, tw, th)
    .map((b) => clampPill(b, w, h))
    .find((b) => !taken.some((q) => boxHit(b, q)))
    || spiralPill(x, y, tw, th, taken, w, h);
  const finish = (p, tw, th, box, short) => {
    taken.push(box);
    // The default slot sits centred above the anchor with its tail
    // bridging the gap, so it needs no leader — only a pill moved by
    // collision avoidance (a later slot or the spiral fallback) does.
    const home = clampPill({ ...pillSlots(p.x, p.y, tw, th)[0] }, w, h);
    const moved = Math.hypot((box.x + box.w / 2) - (home.x + home.w / 2),
      (box.y + box.h / 2) - (home.y + home.h / 2)) > 24;
    const laid = { id: p.id, kind: p.kind || "pill", x: p.x, y: p.y,
      w: tw, h: th, box, leader: moved ? nearestOnBox(box, p.x, p.y) : null,
      count: 0, members: null };
    // 31m: the compact form reports short so the tag paints
    // without its commute line.
    if (short) laid.short = true;
    return laid;
  };
  const forcedHome = (p, tw, th) => finish(p, tw, th,
    clampPill({ ...pillSlots(p.x, p.y, tw, th)[0] }, w, h), false);
  // 31m: the compact fallback size (header + price, no commute
  // line) when the item carries one that differs from the full.
  const altOf = (p) => {
    const a = p.alt;
    if (!a || !(a.w > 0) || !(a.h > 0)) return null;
    if (a.w === p.w && a.h === p.h) return null;
    return { w: a.w, h: a.h };
  };
  const placeOne = (p) => {
    const tw = p.w;
    const th = p.h;
    let box = tryBox(p.x, p.y, tw, th);
    if (box) return finish(p, tw, th, box, false);
    // 31m: no room for the full tag — try the compact form in
    // the same slots, then the spiral, before folding.
    const alt = altOf(p);
    if (alt) {
      const ab = tryBox(p.x, p.y, alt.w, alt.h);
      if (ab) return finish(p, alt.w, alt.h, ab, true);
    }
    // Rank 0/1 always win: keep the default slot above the anchor.
    if ((p.rank ?? 2) <= 1) return forcedHome(p, tw, th);
    return null;
  };
  // 31n: the measured chrome (the top-left filter/title/legend
  // stack, the right control column, the tray, the open pin card)
  // is already occupied before rank 0 places, so the work marker
  // takes the first free slot or spiral position with its leader
  // line when its home slot is covered — and every tag after it
  // moves with a leader line instead of covering chrome. Invalid
  // obstacles are ignored.
  for (const o of obstacles || []) {
    if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)
      || !(o.w > 0) || !(o.h > 0)) continue;
    taken.push({ x: o.x, y: o.y, w: o.w, h: o.h });
  }
  for (const p of list) {
    if ((p.rank ?? 2) !== 0) continue;
    const laid = placeOne(p);
    if (laid) out.push(laid);
    else spill.push(p);
  }
  for (const p of list) {
    if ((p.rank ?? 2) === 0) continue;
    const laid = placeOne(p);
    if (laid) out.push(laid);
    else spill.push(p);
  }
  // Fold the spill into "+N" clusters by proximity (48 px components).
  // 29N2b: clusters never mix towns either — spill items join only
  // within their own area (area-less items keep the old path).
  if (spill.length > 0) {
    const comp = spill.map((_, i) => i);
    const find = (i) => (comp[i] === i ? i : (comp[i] = find(comp[i])));
    for (let i = 0; i < spill.length; i++) {
      for (let j = i + 1; j < spill.length; j++) {
        if (groupAreaKey(spill[i]) !== groupAreaKey(spill[j])) continue;
        if (Math.hypot(spill[i].x - spill[j].x, spill[i].y - spill[j].y) < 48) {
          const a = find(i);
          const b = find(j);
          if (a !== b) comp[b] = a;
        }
      }
    }
    const groups = new Map();
    spill.forEach((p, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(p);
    });
    let k = 0;
    for (const members of groups.values()) {
      k += 1;
      const cx = members.reduce((s, p) => s + p.x, 0) / members.length;
      const cy = members.reduce((s, p) => s + p.y, 0) / members.length;
      // 31g: clusters are count circles, not pills.
      const cw = clusterSizePx(members.length);
      const ch = cw;
      const cluster = { id: `cluster:${k}`, kind: "cluster",
        x: cx, y: cy, w: cw, h: ch, rank: 2 };
      // 29N2e: the raw clamped home is the last resort only — the
      // spiral first takes any free slot (and joins taken, like
      // finish), so two clusters never share one clamped spot
      // while one is free. Same >24 px leader rule as finish.
      let laid = placeOne(cluster);
      if (!laid) {
        const spiral = spiralPill(cx, cy, cw, ch, taken, w, h);
        if (spiral) {
          taken.push(spiral);
          const home = clampPill({ x: cx - cw / 2, y: cy - 6 - ch, w: cw, h: ch }, w, h);
          const moved = Math.hypot((spiral.x + spiral.w / 2) - (home.x + home.w / 2),
            (spiral.y + spiral.h / 2) - (home.y + home.h / 2)) > 24;
          laid = { id: cluster.id, kind: "cluster",
            x: cx, y: cy, w: cw, h: ch, box: spiral,
            leader: moved ? nearestOnBox(spiral, cx, cy) : null,
            count: 0, members: null };
        }
      }
      if (!laid) {
        laid = { id: cluster.id, kind: "cluster",
          x: cx, y: cy, w: cw, h: ch,
          box: clampPill({ x: cx - cw / 2, y: cy - 6 - ch, w: cw, h: ch }, w, h),
          leader: null, count: 0, members: null };
      }
      laid.count = members.length;
      laid.members = members.map((p) => ({ id: p.id, x: p.x, y: p.y }));
      out.push(laid);
    }
  }
  return out;
}

// 21b: station-name placement — names only for stations inside the
// stage bbox, 11 px grey, the same greedy rule: the first free slot
// wins, otherwise the name is skipped (the dot stays). stations carry
// stage px ({ name, x, y }); boxes are already-placed pill boxes.
export function stationNameWidthPx(name) {
  let tw = 0;
  for (const ch of String(name || "")) tw += ch.codePointAt(0) > 0xff ? 11 : 6.5;
  return tw;
}

export function layoutStationLabels(stations, W, H, boxes = []) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const taken = (boxes || []).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  const out = [];
  for (const s of stations || []) {
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;
    if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
    const tw = stationNameWidthPx(s.name);
    const th = 13;
    const spots = [
      { x: s.x + 7, y: s.y - 4, w: tw, h: th },
      { x: s.x + 7, y: s.y - th - 6, w: tw, h: th },
      { x: s.x - 7 - tw, y: s.y - 4, w: tw, h: th },
      { x: s.x - 7 - tw, y: s.y - th - 6, w: tw, h: th },
      { x: s.x + 7, y: s.y + 8, w: tw, h: th },
    ].map((b) => clampPill(b, w, h));
    const box = spots.find((b) => !taken.some((q) => boxHit(b, q))) || null;
    if (!box) continue;
    taken.push(box);
    out.push({ name: s.name, x: box.x, y: box.y + 10 });
  }
  return out;
}

// 29L3: station labels print the full name — with 역 in Korean,
// romanized with Stn in English — so our label sits exactly on the
// basemap's own label instead of doubling it. Names that already
// carry the suffix are left alone.
export function stationLabelName(name, lang) {
  // 29N3j: raw US station names read like the Caltrain station everywhere.
  const raw = usStationDisplay(String(name ?? "").trim(), lang === "en" ? "en" : "ko");
  const ko = raw.endsWith("역") ? raw : `${raw}역`;
  if (lang === "en") return romanizeName(ko);
  // 29N3i: US stations print their Korean name on the Korean screen.
  return ko;
}

// 29L3: the 회사 pill picks a side like the price tags — avoiding
// the given obstacle boxes (station dots and label boxes, chrome).
// 29N2g: above, below, left, right, then the four diagonals, at
// increasing leader length (up to 120 px); every tag box and
// candidate anchor dot counts with an 8 px gap, positions whose
// leader crosses a tag lose to clear ones, and with no free spot
// the least-overlap one wins with the short label. Returns
// { box, leader, side, short? }.
const WORK_PILL_GAP = 8;
const grownBox = (b, g) => ({ x: b.x - g, y: b.y - g,
  w: b.w + g * 2, h: b.h + g * 2 });

// True when the segment (x1,y1)-(x2,y2) touches box b.
function segHitsBox(x1, y1, x2, y2, b) {
  const inside = (x, y) => x >= b.x && x <= b.x + b.w
    && y >= b.y && y <= b.y + b.h;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const xseg = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d1 = cross(cx, cy, dx, dy, ax, ay);
    const d2 = cross(cx, cy, dx, dy, bx, by);
    const d3 = cross(ax, ay, bx, by, cx, cy);
    const d4 = cross(ax, ay, bx, by, dx, dy);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
      && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const ex = b.x + b.w;
  const ey = b.y + b.h;
  return xseg(x1, y1, x2, y2, b.x, b.y, ex, b.y)
    || xseg(x1, y1, x2, y2, ex, b.y, ex, ey)
    || xseg(x1, y1, x2, y2, ex, ey, b.x, ey)
    || xseg(x1, y1, x2, y2, b.x, ey, b.x, b.y);
}

// 29N2g: the fallback workplace label when no clear spot fits the
// full pill — the parenthetical address is dropped ("Work · Meta HQ
// (1 Hacker Way)" → "Work · Meta HQ"). Names without one (Seoul
// "Work · Gangnam") keep as is.
export function shortWorkplaceLabel(label) {
  const s = String(label || "");
  const i = s.indexOf(" (");
  return i > 0 ? s.slice(0, i) : s;
}
const clampPill8 = (box, W, H) => ({
  ...box,
  x: Math.min(Math.max(box.x, 8), Math.max(8, W - box.w - 8)),
  y: Math.min(Math.max(box.y, 8), Math.max(8, H - box.h - 8)),
});

export function placeWorkplacePill(x, y, w, h, W, H, obstacles = [], freeArea = null, altW = null) {
  const ww = Math.max(1, Number(W) || 1);
  const hh = Math.max(1, Number(H) || 1);
  const list = (obstacles || []).filter((q) => q && Number.isFinite(q.x)
    && Number.isFinite(q.y) && q.w > 0 && q.h > 0);
  // 29N2g: every tag box and candidate anchor dot is an obstacle
  // with an 8 px gap.
  const grown = list.map((q) => grownBox(q, WORK_PILL_GAP));
  // 29M2c: like every tag, the pill keeps inside the free area — the
  // 29M2b edge rule alone leaves it above the free top. Without a
  // free area the result is exactly the old side pick.
  const inset = freeArea ? { x: freeArea.x + 4, y: freeArea.y + 4,
    w: Math.max(1, freeArea.w - 8), h: Math.max(1, freeArea.h - 8) } : null;
  const clampTo = (box) => {
    // 29M2: the workplace pill keeps ≥ 8 px from every stage edge.
    const c8 = clampPill8(box, ww, hh);
    return inset ? clampPill(c8, ww, hh, inset) : c8;
  };
  const hits = (b) => grown.some((q) => boxHit(b, q));
  const overlap = (b) => {
    let t = 0;
    for (const q of grown) {
      const ox = Math.min(b.x + b.w, q.x + q.w) - Math.max(b.x, q.x);
      const oy = Math.min(b.y + b.h, q.y + q.h) - Math.max(b.y, q.y);
      if (ox > 0 && oy > 0) t += ox * oy;
    }
    return t;
  };
  // 29N2g: the would-be leader must not cross a tag box where an
  // alternative exists — unexpanded boxes (brushing within the gap
  // is fine).
  const leaderClear = (box) => {
    const [lx, ly] = nearestOnBox(box, x, y);
    return !list.some((q) => segHitsBox(lx, ly, x, y, q));
  };
  // 29N2g: above, below, left, right, then the four diagonals, at
  // increasing leader length (up to 120 px) — the first ring is the
  // legacy side slots, so a free above slot keeps today's position.
  const spots = (pw) => {
    const raw = [
      { side: "above", home: true, box: { x: x - pw / 2, y: y - 6 - h, w: pw, h } },
      { side: "below", home: true, box: { x: x - pw / 2, y: y + PILL_GAP, w: pw, h } },
      { side: "left", home: true, box: { x: x - PILL_GAP - pw, y: y - h / 2, w: pw, h } },
      { side: "right", home: true, box: { x: x + PILL_GAP, y: y - h / 2, w: pw, h } },
    ];
    const dirs = [
      { side: "above", dx: 0, dy: -1 },
      { side: "below", dx: 0, dy: 1 },
      { side: "left", dx: -1, dy: 0 },
      { side: "right", dx: 1, dy: 0 },
      { side: "above-left", dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 },
      { side: "above-right", dx: Math.SQRT1_2, dy: -Math.SQRT1_2 },
      { side: "below-left", dx: -Math.SQRT1_2, dy: Math.SQRT1_2 },
      { side: "below-right", dx: Math.SQRT1_2, dy: Math.SQRT1_2 },
    ];
    for (let r = 26; r <= 120; r += 16) {
      for (const d of dirs) {
        raw.push({ side: d.side, home: false,
          box: { x: x + d.dx * r - pw / 2, y: y + d.dy * r - h / 2, w: pw, h } });
      }
    }
    return raw.map((c) => ({ side: c.side, home: c.home, raw: c.box, box: clampTo(c.box) }));
  };
  const finish = (c, short) => {
    // Legacy slots draw no leader unless the free-area clamp moved
    // them; far slots always carry one back to HQ.
    const moved = Math.hypot((c.box.x + c.box.w / 2) - (c.raw.x + c.raw.w / 2),
      (c.box.y + c.box.h / 2) - (c.raw.y + c.raw.h / 2)) > 24;
    const out = { box: c.box, side: c.side,
      leader: (!c.home || moved) ? nearestOnBox(c.box, x, y) : null };
    if (short) out.short = true;
    return out;
  };
  const place = (pw, short) => {
    const cands = spots(pw);
    const free = cands.filter((c) => !hits(c.box));
    if (free.length === 0) return null;
    return finish(free.find((c) => leaderClear(c.box)) || free[0], short);
  };
  const least = (pw, short) => {
    // 29N2g: no clear spot — the least-overlap one, with the short label.
    let best = null;
    let bestOver = Infinity;
    for (const c of spots(pw)) {
      const o = overlap(c.box);
      // Float dust makes "equal" overlaps differ in the last bit —
      // only a clearly smaller overlap wins, so ties keep the
      // trial order (above first).
      if (o < bestOver - 1e-6) { best = c; bestOver = o; }
    }
    const out = { box: best.box, side: best.side, leader: nearestOnBox(best.box, x, y) };
    if (short) out.short = true;
    return out;
  };
  const got = place(w, false);
  if (got) return got;
  const sw = (Number.isFinite(altW) && altW > 0 && altW < w) ? altW : null;
  if (sw) {
    const shortGot = place(sw, true);
    if (shortGot) return shortGot;
    return least(sw, true);
  }
  return least(w, false);
}

// --- 29M2: the map frames what is drawn ------------------------------------------

// True when the map's pins span more than one tenure — only then do
// English price lines keep their tenure letter.
export function mapTenuresMixed(pins) {
  const kinds = new Set();
  for (const p of pins || []) {
    const list = (p && p.candidate && p.candidate.tenures) || [];
    for (const t of list) if (t && t.tenure) kinds.add(t.tenure);
  }
  return kinds.size > 1;
}

// The town an anchor belongs to: the candidate's area id
// (us-menlo, us-st-palo-alto …; Korean homes: their region), or null
// when the item carries none. Group cards never mix towns.
export function groupAreaKey(item) {
  if (!item) return null;
  if (typeof item.area === "string" && item.area !== "") return item.area;
  const c = item.pin && item.pin.candidate;
  if (c && typeof c.region === "string" && c.region !== "") return c.region;
  if (typeof item.region === "string" && item.region !== "") return item.region;
  return null;
}

// Tight groups: connected components of pill anchors under the card
// radius (29M2b: 72 px at the fitted zoom — one neighbourhood reads
// as one card), split by town first so Belle Haven and Palo Alto
// never share a card. Groups of 3+ pins draw as one list card (the
// stage pipeline caps at 8; larger groups keep the +N cluster path),
// so only the length filter happens here. Pairs keep their fanned
// tags, even same-town ones.
export const GROUP_CARD_PX = 72;
export function groupTightAnchors(items, radiusPx = GROUP_CARD_PX) {
  const list = items || [];
  const r = Math.max(0, Number(radiusPx) || 0);
  const comp = list.map((_, i) => i);
  const find = (i) => (comp[i] === i ? i : (comp[i] = find(comp[i])));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (groupAreaKey(list[i]) !== groupAreaKey(list[j])) continue;
      if (Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y) < r) {
        const a = find(i);
        const b = find(j);
        if (a !== b) comp[b] = a;
      }
    }
  }
  const groups = new Map();
  list.forEach((p, i) => {
    const k = find(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  });
  return [...groups.values()].filter((g) => g.length >= 3);
}

// One list card for a tight group: header `6 homes` / `집 6곳`, or
// with the town — `Belle Haven · 2 homes` / `벨헤이븐 · 2곳` — then
// one row per home in list order — the tag's own lines (the price
// line only when the group's prices differ, then the commute line).
export function groupCardHeader(count, lang, areaLabel) {
  if (areaLabel) {
    return lang === "en" ? `${areaLabel} · ${count} homes` : `${areaLabel} · ${count}곳`;
  }
  return lang === "en" ? `${count} homes` : `집 ${count}곳`;
}

// The town name for a group's header in the rendering language: the
// result's own area label when the search carried one, else the US
// area table for corridor regions. Korean groups keep the plain
// count header.
export function groupAreaLabel(members, lang) {
  const en = lang === "en";
  for (const m of members || []) {
    const c = m && m.pin && m.pin.candidate;
    if (!c) continue;
    if (en && c.area_label) return c.area_label;
    if (!en && c.area_label_ko) return c.area_label_ko;
  }
  for (const m of members || []) {
    const c = m && m.pin && m.pin.candidate;
    const r = c && c.region;
    if (typeof r === "string" && r.startsWith("us-")) {
      const lbl = usAreaLabel(r, en ? "en" : "ko");
      if (lbl) return lbl;
    }
  }
  return null;
}

export function groupCardRows(infos) {
  const prices = new Set((infos || []).map((r) => String(r.price ?? "")));
  const differ = prices.size > 1;
  return (infos || []).map((r) => {
    const parts = [String(r.n ?? "")];
    if (differ) {
      if (r.price) parts.push(String(r.price));
    } else if (!r.commute && r.price) {
      parts.push(String(r.price));
    }
    if (r.commute) parts.push(String(r.commute));
    return parts.join(" · ");
  });
}

// Measured card size; rowH/headerH ride along so the painter uses the
// same row geometry the measurer did.
export function groupCardSizePx(header, rows, opts) {
  const t = tagFontPx(opts);
  const rowH = 20;
  const w = Math.max(t.minW, Math.ceil(Math.max(
    tagLineWidthPx(header, t.header),
    ...rows.map((r) => tagLineWidthPx(r, t.commute)),
  )) + t.pad);
  return { w, h: TAG_HEADER_H + rows.length * rowH + 8, rowH, headerH: TAG_HEADER_H };
}

// The free area: the stage minus the chrome insets.
export function freeAreaOf(W, H, pad) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const p = pad || {};
  const l = Math.max(0, Number(p.left) || 0);
  const r = Math.max(0, Number(p.right) || 0);
  const t = Math.max(0, Number(p.top) || 0);
  const b = Math.max(0, Number(p.bottom) || 0);
  return { x: l, y: t, w: Math.max(1, w - l - r), h: Math.max(1, h - t - b) };
}

export function boxesLeaveFreeArea(boxes, free, margin = 4) {
  const m = Math.max(0, Number(margin) || 0);
  for (const b of boxes || []) {
    if (!b || !(b.w > 0) || !(b.h > 0)) continue;
    if (b.x < free.x + m || b.y < free.y + m
      || b.x + b.w > free.x + free.w - m
      || b.y + b.h > free.y + free.h - m) return true;
  }
  return false;
}

// Zoom out to the union of the laid-out boxes (corners back in
// lon/lat through the current projection, plus the anchors) with the
// usual margin. Returns a fresh fitMapView-style fit.
// 29M2b: boxes may extend the union, but the centre follows pins +
// workplace — the exact-fit span shifts so the anchor centroid lands
// on the free-area centre, growing symmetrically only for corners
// the shift pushes out. The zoom stays as close as before, so wide
// tags can no longer drag the union off-centre without merging
// distant pins into one card.
export function refitViewForBoxes(fit, boxes, anchors, W, H, pad, margin = MAP_FIT_MARGIN) {
  const pts = [];
  const push = (lon, lat) => {
    if (Number.isFinite(lon) && Number.isFinite(lat)) pts.push({ lon, lat });
  };
  for (const b of boxes || []) {
    if (!b || !(b.w > 0) || !(b.h > 0)) continue;
    const [a0, a1] = fit.toLonLat(b.x, b.y);
    const [c0, c1] = fit.toLonLat(b.x + b.w, b.y + b.h);
    push(a0, a1); push(c0, a1); push(a0, c1); push(c0, c1);
  }
  for (const a of anchors || []) push(a.lon, a.lat);
  if (pts.length === 0) return fit;
  const list = (anchors || []).filter((a) => Number.isFinite(a.lon) && Number.isFinite(a.lat));
  if (list.length === 0) return fitMapView(pts, W, H, margin, pad);
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const p = pad || {};
  const padL = Math.max(0, Number(p.left) || 0);
  const padR = Math.max(0, Number(p.right) || 0);
  const padT = Math.max(0, Number(p.top) || 0);
  const padB = Math.max(0, Number(p.bottom) || 0);
  const iw = Math.max(1, w - padL - padR);
  const ih = Math.max(1, h - padT - padB);
  const base = fitMapView(pts, w, h, margin, pad);
  const cx = list.reduce((s, a) => s + a.lon, 0) / list.length;
  const cy = list.reduce((s, a) => s + a.lat, 0) / list.length;
  const k = Math.cos((base.midLat * Math.PI) / 180) || 1;
  const cfx = cx * k;
  // Shift the exact-fit span so the anchor centroid hits the
  // free-area centre (px shift back through the base scale).
  const [ax, ay] = base.toXY(cx, cy);
  const dx = (padL + iw / 2) - ax;
  const dy = (padT + ih / 2) - ay;
  let fw = base.view[2];
  let fh = base.view[3];
  const shifted = [base.view[0] - (dx * fw) / iw, base.view[1] + (dy * fh) / ih, fw, fh];
  const at = (v, lon, lat) => {
    const fx = (lon || 0) * k;
    return [padL + (((fx - v[0]) / v[2]) * iw),
      padT + (((v[1] + v[3] - lat) / v[3]) * ih)];
  };
  let needW = fw / 2;
  let needH = fh / 2;
  for (const q of pts) {
    const [px, py] = at(shifted, q.lon, q.lat);
    needW = Math.max(needW, Math.abs(px - (padL + iw / 2)) * (fw / iw));
    needH = Math.max(needH, Math.abs(py - (padT + ih / 2)) * (fh / ih));
  }
  // No corner left the shifted span: keep the exact-fit zoom as is
  // (re-running the aspect / min-zoom rules here would only shrink
  // it). Otherwise grow symmetrically about the anchor centroid.
  let view;
  if (needW <= fw / 2 && needH <= fh / 2) {
    view = shifted;
  } else {
    fw = needW * 2;
    fh = needH * 2;
    const want = iw / ih;
    if (fw / fh < want) fw = fh * want;
    else fh = fw / want;
    const minW = MAP_MIN_VIEW_KM / KM_PER_DEG;
    if (fw < minW) {
      fh *= minW / fw;
      fw = minW;
    }
    view = [cfx - fw / 2, cy - fh / 2, fw, fh];
  }
  const toXY = (lon, lat) => {
    const fx = (lon || 0) * k;
    return [padL + (((fx - view[0]) / view[2]) * iw),
      padT + (((view[1] + view[3] - lat) / view[3]) * ih)];
  };
  const toLonLat = (x, y) => [
    (view[0] + (((x - padL) / iw) * view[2])) / k,
    view[1] + view[3] - (((y - padT) / ih) * view[3]),
  ];
  const metersPerPx = (view[2] * 111320) / iw;
  return { view, toXY, toLonLat, midLat: base.midLat, metersPerPx };
}

// One stage pipeline for the chat map and its tests: fit the focus,
// lay out the tags (tight groups of 3–8 as one list card), and — while
// a laid-out box leaves the free area — refit on the union of the
// drawn boxes and lay out again (at most two refits, three passes).
// Every refit keeps the pins + workplace centroid centred.
//
// specs: [{ id, kind ("work"|"pill"), lon, lat, w, h, alt, rank, pin }]
// (pin carries n/picked/letter/candidate/commuteMin for card rows).
// Returns { fit, laid, cards } — cards maps a group id to
// { header, rows: [{ id, text, picked }], members, rowH, headerH }.
export function layoutChatStage({ focus, specs, W, H, pad, obstacles,
  tenure, lang, compact, sharedRent, mixedTenure, allowRefit = true }) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const free = freeAreaOf(w, h, pad);
  const anchorHomes = (f) => (specs || [])
    .filter((s) => s.kind !== "work")
    .map((s) => {
      const [x, y] = f.toXY(s.lon, s.lat);
      return { ...s, x, y };
    });
  // 29M2c: neighbourhoods freeze at the pin-fit zoom — refit passes
  // only pull constant-size boxes back inside, never regroup (a
  // zoomed-out refit would otherwise merge far pins into the card).
  const fixedGroups = groupTightAnchors(anchorHomes(fitMapView(focus, w, h, MAP_FIT_MARGIN, pad)),
    GROUP_CARD_PX).filter((g) => g.length <= 8)
    .map((g) => new Set(g.map((m) => m.id)));
  const pass = (fit) => {
    const cards = new Map();
    const homes = anchorHomes(fit);
    const groups = fixedGroups.map((ids) => homes.filter((m) => ids.has(m.id)))
      .filter((g) => g.length >= 3);
    const inGroup = new Set();
    for (const g of groups) for (const m of g) inGroup.add(m);
    const items = [];
    for (const s of specs || []) {
      if (s.kind === "work") {
        const [x, y] = fit.toXY(s.lon, s.lat);
        items.push({ ...s, x, y });
      }
    }
    const orderOf = (s) => {
      const p = s.pin || {};
      return [(p.n ?? 0), String(s.id)];
    };
    for (const g of groups) {
      const ordered = [...g].sort((a, b) =>
        (orderOf(a)[0] - orderOf(b)[0]) || (orderOf(a)[1] < orderOf(b)[1] ? -1 : 1));
      const cx = g.reduce((t, m) => t + m.x, 0) / g.length;
      const cy = g.reduce((t, m) => t + m.y, 0) / g.length;
      const infos = ordered.map((m) => {
        const p = m.pin || {};
        const lines = tagLines(p, { tenure, lang, sharedRent, mixedTenure });
        const glyph = (p.picked && p.letter) ? p.letter : String(p.n ?? "");
        return { n: glyph, price: lines.price, commute: lines.commute };
      });
      // 29N2b: the card header names the town — `Belle Haven ·
      // 2 homes` / `벨헤이븐 · 2곳` — so towns never share a card.
      const header = groupCardHeader(g.length, lang, groupAreaLabel(ordered, lang));
      const texts = groupCardRows(infos);
      const size = groupCardSizePx(header, texts, { compact });
      const id = `group:${ordered.map((m) => m.id).join("-")}`;
      const rows = ordered.map((m, i) => ({ id: m.id,
        text: texts[i], picked: !!(m.pin && m.pin.picked) }));
      cards.set(id, { header, rows,
        members: ordered.map((m) => ({ id: m.id, x: m.x, y: m.y })),
        rowH: size.rowH, headerH: size.headerH,
        cx, cy });
      items.push({ id, kind: "group", x: cx, y: cy,
        w: size.w, h: size.h, area: groupAreaKey(ordered[0]),
        rank: ordered.some((m) => m.pin && m.pin.picked) ? 1 : 2 });
    }
    for (const m of homes) {
      if (inGroup.has(m)) continue;
      const { pin, ...rest } = m;
      items.push(rest);
    }
    // 29M2b: every tag/card/workplace pill keeps ≥ 8 px from each
    // stage edge (the pill clamp alone only keeps 2 px).
    // 29N2c: the clamp used to run after collision checks, so it could
    // move a tag onto a taken spot (two boxes sharing one spot, a
    // leader pointing at the pre-clamp box). Every clamped box below
    // is re-checked: a tag that still collides takes the next free
    // spot within 120 px, else its compact form, else a same-town
    // overflow card — never two boxes overlapping, never a leader to
    // an empty spot. The inset is the free-area margin the refit
    // check uses.
    const freeBox = { x: free.x + 4, y: free.y + 4,
      w: Math.max(1, free.w - 8), h: Math.max(1, free.h - 8) };
    const specById = new Map((specs || []).map((s) => [s.id, s]));
    const wantBox = (b) => clampPill(clampPill8(b, w, h), w, h, freeBox);
    const settled = [];
    for (const o of obstacles || []) {
      if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)
        || !(o.w > 0) || !(o.h > 0)) continue;
      settled.push({ x: o.x, y: o.y, w: o.w, h: o.h });
    }
    const freeSpotNear = (x, y, tw, th) => {
      const angs = [Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4,
        (-3 * Math.PI) / 4, 0, Math.PI / 2, -Math.PI / 2, Math.PI];
      for (let r = 26; r <= 120; r += 16) {
        for (const a of angs) {
          const b = wantBox({ x: x + r * Math.cos(a) - tw / 2,
            y: y + r * Math.sin(a) - th / 2, w: tw, h: th });
          if (!settled.some((q) => boxHit(b, q))) return b;
        }
      }
      return null;
    };
    const gridSpot = (tw, th) => {
      for (let gy = freeBox.y;
        gy + th <= freeBox.y + freeBox.h + 1; gy += 24) {
        for (let gx = freeBox.x;
          gx + tw <= freeBox.x + freeBox.w + 1; gx += 24) {
          const b = { x: gx, y: gy, w: tw, h: th };
          if (!settled.some((q) => boxHit(b, q))) return b;
        }
      }
      return null;
    };
    // 29N2e: the fine sweep before the cascade — same free-area
    // scan on an 8 px grid, still every cell checked.
    const fineSpot = (tw, th) => {
      for (let gy = freeBox.y;
        gy + th <= freeBox.y + freeBox.h + 1; gy += 8) {
        for (let gx = freeBox.x;
          gx + tw <= freeBox.x + freeBox.w + 1; gx += 8) {
          const b = { x: gx, y: gy, w: tw, h: th };
          if (!settled.some((q) => boxHit(b, q))) return b;
        }
      }
      return null;
    };
    // A tag re-clamped into the free area without colliding is still
    // on its natural spot: no leader. Only a collision relocation past
    // 24 px (or a pill that already carried a leader) draws one.
    const withLeader = (l, box, relocated) => {
      if (box.x === l.box.x && box.y === l.box.y
        && box.w === l.box.w && box.h === l.box.h) return { ...l, box };
      const shifted = Math.hypot((box.x + box.w / 2) - (l.box.x + l.box.w / 2),
        (box.y + box.h / 2) - (l.box.y + l.box.h / 2)) > 24;
      const leader = (l.leader || (relocated && shifted))
        ? nearestOnBox(box, l.x, l.y) : null;
      return { ...l, w: box.w, h: box.h, box, leader };
    };
    const laid = [];
    const spill = [];
    for (const l of layoutMapPills(items, w, h, obstacles)) {
      if (!l.box) { spill.push(l); continue; }
      let box = wantBox(l.box);
      let short = !!l.short;
      let relocated = false;
      if (settled.some((q) => boxHit(box, q))) {
        relocated = true;
        box = freeSpotNear(l.x, l.y, l.w, l.h);
        if (!box) {
          const alt = specById.get(l.id) && specById.get(l.id).alt;
          if (!short && alt && alt.w > 0 && alt.h > 0
            && (alt.w !== l.w || alt.h !== l.h)) {
            box = freeSpotNear(l.x, l.y, alt.w, alt.h);
            if (box) short = true;
          }
        }
      }
      if (!box) { spill.push(l); continue; }
      const done = withLeader(l, box, relocated);
      if (short) done.short = true;
      settled.push(done.box);
      laid.push(done);
    }
    if (spill.length > 0) {
      const pool = [];
      for (const l of spill) {
        if (l.kind === "group" && l.members) {
          for (const mb of l.members) {
            if (specById.get(mb.id)) {
              pool.push({ id: mb.id, x: mb.x, y: mb.y,
                spec: specById.get(mb.id) });
            }
          }
        } else if (specById.get(l.id)) {
          pool.push({ id: l.id, x: l.x, y: l.y,
            spec: specById.get(l.id) });
        }
      }
      const towns = new Map();
      for (const p of pool) {
        const c = p.spec && (p.spec.pin ? p.spec.pin.candidate
          : p.spec.candidate);
        const key = (c && c.region) || groupAreaKey(p.spec) || "";
        if (!towns.has(key)) towns.set(key, []);
        towns.get(key).push(p);
      }
      const moreHeader = lang === "en" ? "More here" : "여기 더 보기";
      for (const members of towns.values()) {
        const ordered = [...members].sort((a, b) => {
          const pa = (a.spec && a.spec.pin) || {};
          const pb = (b.spec && b.spec.pin) || {};
          return ((pa.n ?? 0) - (pb.n ?? 0))
            || (String(a.id) < String(b.id) ? -1 : 1);
        });
        const infos = ordered.map((m) => {
          const pin = (m.spec && m.spec.pin) || {};
          const lines = tagLines(pin,
            { tenure, lang, sharedRent, mixedTenure });
          const glyph = (pin.picked && pin.letter)
            ? pin.letter : String(pin.n ?? "");
          return { n: glyph, price: lines.price, commute: lines.commute };
        });
        const texts = groupCardRows(infos);
        const size = groupCardSizePx(moreHeader, texts, { compact });
        const cx = members.reduce((t, m) => t + m.x, 0) / members.length;
        const cy = members.reduce((t, m) => t + m.y, 0) / members.length;
        const home = wantBox({ x: cx - size.w / 2, y: cy - 6 - size.h,
          w: size.w, h: size.h });
        let box = settled.some((q) => boxHit(home, q))
          ? freeSpotNear(cx, cy, size.w, size.h) : home;
        if (!box) box = gridSpot(size.w, size.h);
        // 29N2e: the stage is full — never clamp two cards onto the
        // same free-area corner. Sweep the free area on a fine grid,
        // then cascade down-right, every candidate checked against
        // all settled boxes, so each home stays visible as a row
        // with zero overlaps. Only a stage with literally no free
        // pixel keeps the clamped home box.
        if (!box) box = fineSpot(size.w, size.h);
        if (!box) {
          for (let k = 1; k <= 24 && !box; k++) {
            const c = wantBox({ x: home.x + k * 10, y: home.y + k * 10,
              w: size.w, h: size.h });
            if (!settled.some((q) => boxHit(c, q))) box = c;
          }
        }
        // The stage truly holds no free pixel: keep every home
        // visible as a card row.
        if (!box) box = home;
        const id = `more:${ordered.map((m) => m.id).join("-")}`;
        const rows = ordered.map((m, i) => ({ id: m.id,
          text: texts[i],
          picked: !!((m.spec && m.spec.pin && m.spec.pin.picked)) }));
        const card = { header: moreHeader, rows,
          members: ordered.map((m) => ({ id: m.id, x: m.x, y: m.y })),
          rowH: size.rowH, headerH: size.headerH, cx, cy };
        cards.set(id, card);
        const moved = Math.hypot((box.x + box.w / 2) - (home.x + home.w / 2),
          (box.y + box.h / 2) - (home.y + home.h / 2)) > 24;
        laid.push({ id, kind: "group", x: cx, y: cy,
          w: size.w, h: size.h, box,
          leader: moved ? nearestOnBox(box, cx, cy) : null,
          count: 0, members: card.members, rows: card.rows,
          header: card.header, rowH: card.rowH, headerH: card.headerH });
        settled.push(box);
      }
    }
    for (const l of laid) {
      const c = cards.get(l.id);
      if (c && l.kind === "group") {
        l.members = c.members;
        l.rows = c.rows;
        l.header = c.header;
        l.rowH = c.rowH;
        l.headerH = c.headerH;
      }
    }
    return { laid, cards };
  };
  let fit = fitMapView(focus, w, h, MAP_FIT_MARGIN, pad);
  let out = pass(fit);
  // 29M2b: refit while a laid-out box leaves the free area (at most
  // two refits — three passes). Every refit keeps the anchor
  // centroid at the free-area centre; re-laying out after each zoom
  // pulls constant-size tags back inside.
  for (let n = 0; n < 2; n++) {
    if (!allowRefit) break;
    if (!boxesLeaveFreeArea(
      out.laid.map((l) => l.box).filter(Boolean), free)) break;
    fit = refitViewForBoxes(fit,
      out.laid.map((l) => l.box).filter(Boolean), focus, w, h, pad);
    out = pass(fit);
  }
  return { fit, laid: out.laid, cards: out.cards };
}

// 21b: at most 4 neighbourhood names for the candidates' 동 — one
// centroid per dong, first-seen order. pins carry { lon, lat, dong }.
export function pickDongLabels(pins) {
  const seen = new Map();
  for (const p of pins || []) {
    const dong = (p && p.dong !== undefined && p.dong !== null
      ? String(p.dong) : "").trim();
    if (!dong) continue;
    if (!seen.has(dong)) seen.set(dong, []);
    seen.get(dong).push(p);
  }
  return [...seen.entries()].slice(0, 4).map(([text, pts]) => ({
    text,
    lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
  }));
}

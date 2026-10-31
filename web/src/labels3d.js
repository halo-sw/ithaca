// Stage 20b: building / complex / place labels for the 3D view (pure, no DOM).
//
// labelItemsFor(area, opts) builds the label items for one frame from the
// already-loaded `area` doc (complexes, buildings, pois). placeLabels picks
// the screen-space winners with a greedy priority pass. buildingCard builds
// the hover-card data for one building. main.js projects anchors with the
// same helper the station labels use and renders into the #tags layer.

import { displayNameFor } from "./homes.js";
import { haversineM } from "./frame.js";
import { placeNameEn } from "./ui/scene-chrome.js";

export const OVERVIEW_MIN_M = 400;
export const DONG_MAX_M = 250;
export const MAX_LABELS = 40;

// 29L2: label budget by stage width — a 390 px phone stage fits a
// handful of labels, a desktop stage keeps the full budget. Home and
// destination (level "always") still rank first in placeLabels.
export function labelCapForWidth(viewW) {
  if (viewW <= 480) return 6;
  if (viewW <= 900) return 12;
  return MAX_LABELS;
}

// 29L2: frame chrome — labels are clamped inside the stage with this
// margin, and a non-always label whose clamp shifts it further than
// this from its anchor is dropped (it would point at the wrong place).
export const STAGE_PAD = 4;
export const MAX_SHIFT_PX = 48;

const RANK = { always: 0, complex: 1, poi: 2, dong: 3 };

// Daily-life POI groups shown in the close view. Restaurants / bars / pubs
// are only added when fewer than 8 daily-life labels show.
const DAILY_GROUPS = new Set([
  "convenience",
  "mart",
  "pharmacy",
  "medical",
  "school",
  "park",
  "cafe",
  "bank",
]);

const FILLER_GROUPS = new Set(["restaurant", "bar", "pub"]);

export function poiGroupFor(category) {
  const c = String(category || "").toLowerCase();
  if (c.includes("convenience")) return "convenience";
  if (c.includes("supermarket") || c.includes("super") || c.includes("mart") || c.includes("grocery")) return "mart";
  if (c.includes("pharmacy") || c.includes("drug")) return "pharmacy";
  if (c.includes("hospital") || c.includes("clinic") || c.includes("dentist") || c.includes("doctor")) return "medical";
  if (c.includes("school") || c.includes("kindergarten") || c.includes("university") || c.includes("college")) return "school";
  if (c.includes("park") || c.includes("playground") || c.includes("garden")) return "park";
  if (c.includes("cafe") || c.includes("coffee")) return "cafe";
  if (c.includes("bank") || c.includes("atm")) return "bank";
  if (c.includes("restaurant")) return "restaurant";
  if (c.includes("bar") && !c.includes("barber")) return "bar";
  if (c.includes("pub")) return "pub";
  return "";
}

export function poiGlyphFor(category) {
  const g = poiGroupFor(category);
  if (g === "convenience") return "편";
  if (g === "mart") return "마";
  if (g === "pharmacy") return "약";
  if (g === "medical") return "병";
  if (g === "school") return "학";
  if (g === "park") return "공";
  if (g === "cafe") return "카";
  if (g === "bank") return "은";
  if (g === "restaurant") return "식";
  if (g === "bar" || g === "pub") return "주";
  return "•";
}

const KIND_KO = {
  apartments: "공동주택",
  apartment: "공동주택",
  residential: "주거용 건물",
  house: "주택",
  detached: "단독주택",
  school: "학교",
  commercial: "상업용 건물",
  retail: "상업용 건물",
  office: "업무용 건물",
  hospital: "병원",
  civic: "공공 건물",
};

export function kindKoFor(building) {
  if (!building) return "건물";
  const raw = building.kind || building.building || building.use || "";
  const key = String(raw).toLowerCase();
  if (KIND_KO[key]) return KIND_KO[key];
  if (raw && /[\u3131-\u318e\uac00-\ud7a3]/.test(String(raw))) return String(raw);
  return "건물";
}

function ringCentroid(ring) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const p of ring || []) {
    if (!Array.isArray(p) || p.length < 2) continue;
    x += p[0];
    y += p[1];
    n++;
  }
  return n > 0 ? [x / n, y / n] : null;
}

function geometryCentroid(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.slice(0, 2);
  }
  const polys =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  for (const poly of polys) {
    const c = ringCentroid(poly && poly[0]);
    if (c) return c;
  }
  return null;
}

export function anchorOf(entry) {
  if (!entry) return null;
  if (Array.isArray(entry.centroid) && entry.centroid.length >= 2) {
    return [entry.centroid[0], entry.centroid[1]];
  }
  if (Array.isArray(entry.lonlat) && entry.lonlat.length >= 2) {
    return [entry.lonlat[0], entry.lonlat[1]];
  }
  if (Number.isFinite(entry.lon) && Number.isFinite(entry.lat)) {
    return [entry.lon, entry.lat];
  }
  return geometryCentroid(entry.geometry);
}

function complexOfBuilding(area, buildingId) {
  for (const c of area?.complexes || []) {
    if ((c.building_ids || []).includes(buildingId)) return c;
  }
  return null;
}

function buildingNameOf(building, complex) {
  const reg = building?.register;
  if (reg && reg.name) {
    return reg.sub_name ? `${reg.name} ${reg.sub_name}` : String(reg.name);
  }
  if (building?.name) return String(building.name);
  if (complex?.name) return String(complex.name);
  return "";
}

function clean(parts) {
  return parts.filter((p) => p !== undefined && p !== null && String(p).trim() !== "");
}

// 26i: US complexes can carry an OSM id as their name (e.g.
// "w112348084"). Then the pill shows the run's home name instead
// ("10 Coleman Place"); Korean names are never replaced.
// 30g: when the label's raw name is a candidate's bare lot number,
// the candidate's readable name (동 / station 근처 + kind) shows
// instead — via the optional candidate (displayNameFor passes real
// names through, so they never change).
const OSM_ID_RE = /^[wnr]\d+$/;

export function homeDisplayName(name, runHomeName, candidate = null) {
  const n = name === undefined || name === null ? "" : String(name);
  if (runHomeName && OSM_ID_RE.test(n.trim())) return String(runHomeName);
  if (candidate && candidate.name !== undefined
    && String(candidate.name).trim() === n.trim()) {
    return displayNameFor(candidate);
  }
  return n;
}

// 36c2: a source name lost one glyph ('더?스타리버' next to
// '더샵스타리버' at the same spot). With a same-length peer within 30 m
// matching the name with '?' as one wildcard character, the peer name
// wins; otherwise the '?' is dropped and the note explains the broken
// source glyph. Pure — mirrors pipeline.homes.repair_broken_names.
export const BROKEN_NAME_NOTE = "원본 이름의 글자 하나가 깨져 있어요";

export function repairComplexName(name, lon, lat, peers = []) {
  const s = String(name == null ? "" : name);
  if (!s.includes("?")) return { name: s, note: null };
  const matches = (peer) => {
    if (typeof peer !== "string") return false;
    if (peer.length !== s.length || peer.includes("?")) return false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== "?" && s[i] !== peer[i]) return false;
    }
    return true;
  };
  let donor = null;
  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    for (const p of peers || []) {
      if (!p || typeof p.name !== "string" || !matches(p.name)) continue;
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
      if (haversineM(lon, lat, p.lon, p.lat) > 30) continue;
      if (donor === null || String(p.name) < donor) donor = String(p.name);
    }
  }
  if (donor !== null) return { name: donor, note: null };
  return { name: s.replaceAll("?", ""), note: BROKEN_NAME_NOTE };
}

// Items: { id, level, title, sub, glyph, accent, lon, lat }.
// Order: home pill first, then destination, then complexes / POIs / dongs.
export function labelItemsFor(area, opts = {}) {
  const { homeBuildingId = null, destination = null, destinationSuffix = "",
    cameraDistM = 600, homeName = null, homeCandidate = null } = opts;
  const items = [];
  const buildings = area?.buildings || [];
  const byId = new Map(buildings.map((b) => [b.id, b]));

  if (homeBuildingId !== null && homeBuildingId !== undefined) {
    const b = byId.get(homeBuildingId);
    const complex = complexOfBuilding(area, homeBuildingId);
    const raw = (b && buildingNameOf(b, complex)) || String(homeBuildingId);
    const name = homeDisplayName(raw, homeName, homeCandidate) || raw;
    const anchor = (b && anchorOf(b)) || (complex && anchorOf(complex)) || null;
    items.push({
      id: `home:${String(homeBuildingId)}`,
      level: "always",
      title: `우리 집 · ${name}`,
      sub: "",
      accent: true,
      lon: anchor ? anchor[0] : null,
      lat: anchor ? anchor[1] : null,
    });
  }

  const destLabel =
    typeof destination === "string"
      ? destination
      : destination?.label || destination?.to?.label || "";
  const destLonLat =
    (destination && (anchorOf(destination) || anchorOf(destination?.to))) || null;
  if (destLabel) {
    items.push({
      id: `dest:${destLabel}`,
      level: "always",
      title: destinationSuffix ? `${destLabel} · ${destinationSuffix}` : `${destLabel} · 가는 곳`,
      sub: "",
      glyph: "",
      lon: destLonLat ? destLonLat[0] : null,
      lat: destLonLat ? destLonLat[1] : null,
    });
  }

  if (cameraDistM > OVERVIEW_MIN_M) {
    const complexes = area?.complexes || [];
    const peers = complexes.map((p) => {
      const a = anchorOf(p);
      return { name: p.name, lon: a ? a[0] : NaN, lat: a ? a[1] : NaN };
    });
    for (const c of complexes) {
      if (!c.name) continue;
      const anchor = anchorOf(c);
      if (!anchor) continue;
      const sub = clean([
        c.households ? `${c.households}세대` : "",
        c.max_floors ? `최고 ${c.max_floors}층` : "",
      ]).join(" · ");
      const repaired = String(c.name).includes("?")
        ? repairComplexName(c.name, anchor[0], anchor[1], peers).name
        : String(c.name);
      items.push({
        id: `complex:${c.id || c.name}`,
        level: "complex",
        title: repaired,
        sub,
        lon: anchor[0],
        lat: anchor[1],
      });
    }
    return items;
  }

  // Close view: daily-life POIs, plus restaurants/bars/pubs only to fill up.
  const daily = [];
  const filler = [];
  for (const p of area?.pois || []) {
    const group = poiGroupFor(p.category);
    if (!group || !p.name) continue;
    const anchor = anchorOf(p);
    if (!anchor) continue;
    const item = {
      id: `poi:${p.id || `${p.category}:${p.name}`}`,
      level: "poi",
      title: String(p.name),
      sub: "",
      glyph: poiGlyphFor(p.category),
      lon: anchor[0],
      lat: anchor[1],
    };
    if (DAILY_GROUPS.has(group)) daily.push(item);
    else if (FILLER_GROUPS.has(group)) filler.push(item);
  }
  const pois = daily.length >= 8 ? daily : [...daily, ...filler];
  items.push(...pois);

  if (cameraDistM <= DONG_MAX_M) {
    for (const b of buildings) {
      const subName = b?.register?.sub_name || b?.sub_name || "";
      if (!subName) continue;
      const anchor = anchorOf(b);
      if (!anchor) continue;
      items.push({
        id: `dong:${b.id}`,
        level: "dong",
        title: String(subName),
        sub: "",
        lon: anchor[0],
        lat: anchor[1],
      });
    }
  }
  return items;
}

// Greedy screen-space collision: priority always > complex > poi > dong,
// skip boxes intersecting an already placed one, at most 40 per frame.
// Items carry screen px boxes { x, y, w, h }; items without a box get a
// text-length estimate so labelItemsFor output can flow straight through.
export function placeLabels(items, viewW, viewH, reserved = [], opts = {}) {
  const cap = Number.isFinite(opts.cap) ? opts.cap : labelCapForWidth(viewW);
  const zones = (reserved || []).map((r) => ({
    left: r.left ?? r.x ?? 0,
    top: r.top ?? r.y ?? 0,
    right: r.right ?? (r.left ?? r.x ?? 0) + (r.width ?? r.w ?? 0),
    bottom: r.bottom ?? (r.top ?? r.y ?? 0) + (r.height ?? r.h ?? 0),
  }));
  const hitsZone = (box) => zones.some((z) =>
    box.left < z.right && box.right > z.left
    && box.top < z.bottom && box.bottom > z.top);
  const ranked = (items || [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const r = (RANK[a.item.level] ?? 99) - (RANK[b.item.level] ?? 99);
      return r !== 0 ? r : a.index - b.index;
    });
  const placed = [];
  const boxes = [];
  for (const { item } of ranked) {
    if (placed.length >= cap) break;
    const w = item.w ?? estimateW(item);
    const h = item.h ?? (item.sub ? 30 : 22);
    const ax = item.x ?? 0;
    const ay = item.y ?? 0;
    if (ax + w < 0 || ay + h < 0 || ax > viewW || ay > viewH) continue;
    const always = item.level === "always";
    // 29L2: a box wider/taller than the stage can never sit inside it.
    if (w > viewW - STAGE_PAD * 2 || h > viewH - STAGE_PAD * 2) continue;
    // 29L2: clamp inside the frame; a non-always label pushed further
    // than MAX_SHIFT_PX from its anchor is dropped. Always-items keep
    // the clamped spot (home / destination must stay visible).
    let x = Math.min(Math.max(ax, STAGE_PAD), viewW - w - STAGE_PAD);
    let y = Math.min(Math.max(ay, STAGE_PAD), viewH - h - STAGE_PAD);
    if (!always && Math.max(Math.abs(x - ax), Math.abs(y - ay)) > MAX_SHIFT_PX) continue;
    let box = { left: x, top: y, right: x + w, bottom: y + h };
    if (hitsZone(box)) {
      if (!always) continue;
      const zone = zones.find((z) =>
        box.left < z.right && box.right > z.left
        && box.top < z.bottom && box.bottom > z.top);
      const below = zone.bottom + 4;
      const above = zone.top - h - 4;
      if (below + h <= viewH) {
        y = below;
      } else if (above >= 0) {
        y = above;
      } else {
        continue;
      }
      // 29L2: the nudge must also stay inside the frame.
      y = Math.min(Math.max(y, STAGE_PAD), viewH - h - STAGE_PAD);
      box = { left: x, top: y, right: x + w, bottom: y + h };
      if (hitsZone(box)) continue;
    }
    let hit = false;
    for (const other of boxes) {
      if (
        box.left < other.right &&
        box.right > other.left &&
        box.top < other.bottom &&
        box.bottom > other.top
      ) {
        hit = true;
        break;
      }
    }
    if (hit) continue;
    // 29L2: report the clamped spot so the caller paints the box that
    // was actually reserved (never outside the stage).
    placed.push((box.left !== (item.x ?? 0) || box.top !== (item.y ?? 0))
      ? { ...item, x: box.left, y: box.top } : item);
    boxes.push(box);
  }
  return placed;
}

// 29L2c: the placed box IS the painted box. left/top land on the
// placed (x, y) plus the stage→wrap offset, with no translate — the
// old translate(-50%,-100%) painted the anchor box, which is not the
// box placeLabels clamped.
export function labelPaintStyle(item, wrapOffset = {}) {
  const o = wrapOffset || {};
  const ox = Number(o.x ?? o.left ?? 0) || 0;
  const oy = Number(o.y ?? o.top ?? 0) || 0;
  return { left: ox + (item.x ?? 0), top: oy + (item.y ?? 0), transform: "none" };
}

function estimateW(item) {
  const title = String(item.title || "");
  const glyph = item.glyph ? 20 : 0;
  return [...title].length * 13 + 24 + glyph;
}

const HANGUL_CH = /[가-힣]/;

// 29L6: label box width from the string actually painted. On English
// the title goes through placeNameEn (the same English the label
// element shows), so the clamped box matches the painted box.
// Hangul chars cost 13 px, other chars 7.5 px, plus 24 px chrome
// (+ glyph); the sub line counts when it is wider. Rounded up.
export function labelBoxW(title, lang = "ko", opts = {}) {
  const shown = lang === "en" ? placeNameEn(title) : String(title ?? "");
  const glyph = opts && opts.glyph ? 20 : 0;
  const wOf = (s) => [...String(s ?? "")].reduce(
    (a, ch) => a + (HANGUL_CH.test(ch) ? 13 : 7.5), 0) + 24 + glyph;
  let w = wOf(shown);
  if (opts && opts.sub) {
    const sub = lang === "en" ? placeNameEn(opts.sub) : String(opts.sub);
    const sw = wOf(sub);
    if (sw > w) w = sw;
  }
  return Math.ceil(w);
}

// Hover card for one building. Never emits "undefined" / "null": missing
// fields are left out, and buildings without a register fall back to the
// OSM kind line.
export function buildingCard(building) {
  const b = building || {};
  const reg = b.register;
  if (reg && (reg.name || reg.sub_name || reg.use)) {
    const title = clean(
      reg.name && reg.sub_name
        ? [`${reg.name} ${reg.sub_name}`]
        : [reg.name || reg.sub_name],
    ).join("");
    let year = "";
    const m = String(reg.approval_date || "").match(/^(\d{4})/);
    if (m) year = m[1];
    const meta = clean([
      reg.use || "",
      Number.isFinite(reg.floors_above) ? `${reg.floors_above}층` : "",
      year ? `${year}년 사용승인` : "",
    ]).join(" · ");
    return {
      title: title || b.name || kindKoFor(b),
      meta,
      source: "건축물대장 (국토교통부)",
    };
  }
  const kindKo = kindKoFor(b);
  const title = b.name ? String(b.name) : kindKo;
  return {
    title,
    meta: `${kindKo} · 층수 미확인 · 출처 OpenStreetMap`,
    source: "OpenStreetMap",
  };
}

// Stage 20f: destination pill wording (pure, no DOM).
//
// The walk leg of a commute ends at the station ("잠실", not "잠실역"),
// so the pill is decided by the trip — not by the name: a commute walk
// followed by a ride reads "{label}역 · 지하철 타는 곳". The 역 is never
// doubled ("강남역" stays "강남역").
const TRIP_VERB_20F = { commute: "출근", school: "등교",
  errand: "장보기", clinic: "병원", park: "산책" };

export function stationNameFor(base) {
  const b = String(base || "");
  return /역$/.test(b) ? b : `${b}역`;
}

function tripToOf(trip) {
  return (trip && trip.to) || {};
}

// A commute walk is station-bound when the trip's destination is a
// station node, when the destination name already ends in 역, or when a
// ride away for the same agent and day starts within 30 min of arrival.
// aways is the run's away list (filtered inside by agent and day).
export function isStationBoundCommute(trip, aways) {
  if (!trip || trip.purpose !== "commute") return false;
  const to = tripToOf(trip);
  const toLabel = to.label || to.id || "";
  if (/역$/.test(toLabel)) return true;
  if (to.kind === "station") return true;
  if (/station|railway/i.test(String(to.category || ""))) return true;
  if (Number.isFinite(trip.arrive_min) && Array.isArray(aways)) {
    for (const a of aways) {
      if (!a || a.agent !== trip.agent || a.day !== trip.day) continue;
      if (!Number.isFinite(a.start_min)) continue;
      const dt = a.start_min - trip.arrive_min;
      if (dt >= 0 && dt <= 30) return true;
    }
  }
  return false;
}

// "{to} · {출근|장보기|병원|산책} 가는 곳" — the station-bound commute
// walk reads "지하철 타는 곳" instead.
export function destPillText(destLabel, trip, aways) {
  const base = destLabel || "";
  if (!base) return "";
  if (isStationBoundCommute(trip, aways)) {
    return `${stationNameFor(base)} · 지하철 타는 곳`;
  }
  const verb = trip ? TRIP_VERB_20F[trip.purpose] : "";
  return verb ? `${base} · ${verb} 가는 곳` : `${base} · 가는 곳`;
}

export function destSuffixFor(trip, aways) {
  if (!trip) return "";
  if (isStationBoundCommute(trip, aways)) return "지하철 타는 곳";
  if (trip.purpose === "commute") return "출근 가는 곳";
  const verb = TRIP_VERB_20F[trip.purpose];
  return verb ? `${verb} 가는 곳` : "";
}

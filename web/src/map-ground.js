// 50c: real neighbourhood geometry beneath the candidate map imagery.
//
// The corridor tiles only cover a thin Gangnam slice, so the candidate
// map also loads the deployed per-area geography (`/data/<areaId>/area.json`)
// for the workplace + candidate areas: OSM roads, OSM water/parks landuse
// and building footprints (national register + OSM). Only the roads,
// buildings and landuse sections load — never graph, trees or POIs.
// Geometries are WGS84 lon/lat. Failed areas/sections degrade to the
// areas/sections that did load; nothing is invented.
import { assetUrl } from "./paths.js";

// At most 8 areas per search (workplace, then picks, then the rest).
export const MAP_GROUND_MAX_AREAS = 8;
// At most 3 concurrent fetches while loading ground.
export const MAP_GROUND_CONCURRENCY = 3;
// At most 12 resolved areas stay cached; failures are never cached.
export const MAP_GROUND_CACHE_LIMIT = 12;
// Building footprints render only at neighbourhood scale (effective
// meters per px at or below this), never as thousands of DOM nodes.
export const MAP_GROUND_BUILDING_MPP = 8;

export const MAP_GROUND_AREA_URL = (areaId) => assetUrl(`/data/${areaId}/area.json`);

const AREA_ID_RE = /^(st|hm|us)-[A-Za-z0-9가-힣_.-]+$/;

// An area id is a plain box id only — never a path, traversal or URL.
export function isMapGroundAreaId(id) {
  if (typeof id !== "string" || id.length === 0 || id.length > 80) return false;
  if (id.includes("..") || id.includes("/") || id.includes("\\")
    || id.includes("?") || id.includes("#") || id.includes(":")) return false;
  return AREA_ID_RE.test(id);
}

// Area ids for the ground layer: the workplace area first, then picked
// candidates' areas, then the remaining candidates' areas. Unique, capped.
export function selectMapGroundAreaIds({ workplaces, candidates, picks, max = MAP_GROUND_MAX_AREAS } = {}) {
  const out = [];
  const seen = new Set();
  const push = (id) => {
    if (!isMapGroundAreaId(id) || seen.has(id)) return;
    seen.add(id);
    if (out.length < max) out.push(id);
  };
  for (const w of workplaces || []) {
    const r = w && w.resolved;
    if (!r) continue;
    if (typeof r.station === "string" && r.station) push(`st-${r.station}`);
    else if (typeof r.region === "string" && r.region) push(r.region);
  }
  const cands = Array.isArray(candidates) ? candidates : [];
  const byId = new Map();
  for (const c of cands) {
    if (c && c.id !== undefined && !byId.has(c.id)) byId.set(c.id, c);
  }
  for (const id of Array.isArray(picks) ? picks : []) {
    const c = byId.get(id);
    if (c) push(c.scene);
  }
  for (const c of cands) push(c && c.scene);
  return out;
}

// A section reference is a bare file name only — never a path or URL.
export function isMapGroundSectionRef(ref) {
  return typeof ref === "string" && /^[A-Za-z0-9._-]+\.json$/.test(ref);
}

function isLonLat(p) {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
    && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
}

function ringClean(ring) {
  if (!Array.isArray(ring)) return null;
  const pts = ring.filter(isLonLat).map((p) => [p[0], p[1]]);
  return pts.length >= 3 ? pts : null;
}

function lineClean(line) {
  if (!Array.isArray(line)) return null;
  const pts = line.filter(isLonLat).map((p) => [p[0], p[1]]);
  return pts.length >= 2 ? pts : null;
}

function bboxOfPts(pts) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [lon, lat] of pts) {
    if (lon < x0) x0 = lon;
    if (lat < y0) y0 = lat;
    if (lon > x1) x1 = lon;
    if (lat > y1) y1 = lat;
  }
  return [x0, y0, x1, y1];
}

function bboxUnion(a, b) {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]),
    Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function signedRingArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function orientCopy(ring, wantPositive) {
  const area = signedRingArea(ring);
  if (!Number.isFinite(area) || area === 0) return ring;
  const isPositive = area > 0;
  if (isPositive !== wantPositive) return [...ring].reverse();
  return ring;
}

function polygonRings(geom) {
  // Returns { rings, bbox } with hole identity preserved via winding:
  // outer rings share one direction, holes run opposite, so combined
  // per-layer paths fill correctly with nonzero. Never mutates source.
  if (!geom || typeof geom.type !== "string") return null;
  const polys = geom.type === "Polygon" ? [geom.coordinates]
    : geom.type === "MultiPolygon" ? geom.coordinates : null;
  if (!Array.isArray(polys)) return null;
  const rings = [];
  let bbox = null;
  for (const poly of polys) {
    if (!Array.isArray(poly)) continue;
    for (let i = 0; i < poly.length; i++) {
      const clean = ringClean(poly[i]);
      if (!clean) continue;
      const oriented = orientCopy(clean, i === 0);
      rings.push(oriented);
      bbox = bboxUnion(bbox, bboxOfPts(oriented));
    }
  }
  return rings.length > 0 ? { rings, bbox } : null;
}

const MAJOR_HIGHWAYS = new Set(["motorway", "trunk", "primary", "secondary", "tertiary"]);

export function roadClassFor(highway) {
  const base = String(highway || "").toLowerCase().replace(/_link$/, "");
  return MAJOR_HIGHWAYS.has(base) ? "major" : "minor";
}

export function isWaterKind(kind) {
  return kind === "natural:water"
    || (typeof kind === "string" && kind.startsWith("waterway:"));
}

const PARK_KINDS = new Set(["leisure:park", "leisure:garden", "landuse:grass",
  "landuse:forest", "landuse:meadow", "natural:wood", "natural:grassland"]);

export function isParkKind(kind) {
  return typeof kind === "string" && PARK_KINDS.has(kind);
}

function dedupKey(layer, f) {
  const id = f && f.id;
  if (id === undefined || id === null || id === "") {
    try {
      return `${layer}:geom:${JSON.stringify(f && f.geometry)}`;
    } catch {
      return null;
    }
  }
  return `${layer}:${(f && f.origin) || ""}:${String(id)}`;
}

// Resolve one area.json section: an inline array, or a single
// {$ref:'file.json'} loaded from the same area directory. Anything else
// (missing, graph, trees, POIs) resolves to no rows.
async function resolveSection(fetchJson, areaId, raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)
    && typeof raw.$ref === "string") {
    if (!isMapGroundSectionRef(raw.$ref)) return [];
    const doc = await fetchJson(assetUrl(`/data/${areaId}/${raw.$ref}`));
    return Array.isArray(doc) ? doc : [];
  }
  return [];
}

function ingestRoads(rows, seen, roads) {
  for (const f of Array.isArray(rows) ? rows : []) {
    if (!f || typeof f !== "object") continue;
    const pts = lineClean(f.geometry && f.geometry.coordinates);
    if (!pts) continue;
    const key = dedupKey("road", f);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    roads.push({ highway: typeof f.highway === "string" ? f.highway : "",
      cls: roadClassFor(f.highway), pts, bbox: bboxOfPts(pts) });
  }
}

function ingestPolygons(rows, seen, layer, out, isRegister) {
  for (const f of Array.isArray(rows) ? rows : []) {
    if (!f || typeof f !== "object") continue;
    const poly = polygonRings(f.geometry);
    if (!poly) continue;
    const key = dedupKey(layer, f);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push({ rings: poly.rings, bbox: poly.bbox,
      register: isRegister ? (f.origin === "register") : false });
  }
}

function ingestLanduse(rows, seen, water, parks) {
  for (const f of Array.isArray(rows) ? rows : []) {
    if (!f || typeof f !== "object") continue;
    const kind = typeof f.kind === "string" ? f.kind : "";
    const layer = isWaterKind(kind) ? "water" : isParkKind(kind) ? "park" : null;
    // Commercial, residential and other kinds never become parks.
    if (!layer) continue;
    const poly = polygonRings(f.geometry);
    if (!poly) continue;
    const key = dedupKey(layer, f);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    (layer === "water" ? water : parks).push({ rings: poly.rings, bbox: poly.bbox });
  }
}

// Bounded promise cache: resolved areas stay cached (LRU, capped);
// failed loads are dropped so a retry fetches again.
const groundCache = new Map();
export function clearMapGroundCache() {
  groundCache.clear();
}
export function mapGroundCacheSize() {
  return groundCache.size;
}

function cacheSet(id, value) {
  groundCache.delete(id);
  groundCache.set(id, value);
  while (groundCache.size > MAP_GROUND_CACHE_LIMIT) {
    groundCache.delete(groundCache.keys().next().value);
  }
}

function isMissingSection(ref) {
  return ref == null || (typeof ref !== "object" && !Array.isArray(ref));
}

async function loadOneArea(fetchJson, areaId) {
  if (groundCache.has(areaId)) return groundCache.get(areaId);
  let incomplete = false;
  async function oneSection(ref) {
    if (isMissingSection(ref)) return [];
    if (Array.isArray(ref)) return ref;
    try {
      return await resolveSection(fetchJson, areaId, ref);
    } catch {
      incomplete = true;
      return [];
    }
  }
  const pending = (async () => {
    const doc = await fetchJson(MAP_GROUND_AREA_URL(areaId));
    // Each section resolves independently, so roads survive a
    // failed building file (and vice versa).
    const [roads, buildings, landuse] = await Promise.all([
      oneSection(doc && doc.roads),
      oneSection(doc && doc.buildings),
      oneSection(doc && doc.landuse),
    ]);
    const area = { id: areaId, roads, buildings, landuse };
    if (incomplete) area.incomplete = true;
    return area;
  })();
  groundCache.set(areaId, pending);
  try {
    const area = await pending;
    if (area && area.incomplete) {
      // Preserve loaded sections for this render but evict so the
      // next load retries the failed section.
      if (groundCache.get(areaId) === pending) groundCache.delete(areaId);
      const { incomplete: _drop, ...rest } = area;
      return rest;
    }
    cacheSet(areaId, Promise.resolve(area));
    return area;
  } catch {
    // Never cached: a later search retries the fetch.
    if (groundCache.get(areaId) === pending) groundCache.delete(areaId);
    return null;
  }
}

async function poolEach(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length)))
    .fill(null).map(async () => {
      while (next < items.length) {
        const i = next;
        next += 1;
        out[i] = await fn(items[i], i);
      }
    });
  await Promise.all(workers);
  return out;
}

// Load ground for the selected areas. Resolves to merged, deduplicated
// features plus the loaded area ids and source flags; never throws.
export async function loadMapGround(fetchJson, ids,
  { concurrency = MAP_GROUND_CONCURRENCY } = {}) {
  const valid = [...new Set((ids || []).filter(isMapGroundAreaId))]
    .slice(0, MAP_GROUND_MAX_AREAS);
  const roads = [];
  const buildings = [];
  const water = [];
  const parks = [];
  const seen = new Set();
  let hasRegister = false;
  const loaded = [];
  const docs = await poolEach(valid, concurrency,
    (id) => loadOneArea(fetchJson, id).catch(() => null));
  for (const doc of docs) {
    if (!doc) continue;
    loaded.push(doc.id);
    ingestRoads(doc.roads, seen, roads);
    const before = buildings.length;
    ingestPolygons(doc.buildings, seen, "building", buildings, true);
    for (let i = before; i < buildings.length; i++) {
      if (buildings[i].register) { hasRegister = true; break; }
    }
    ingestLanduse(doc.landuse, seen, water, parks);
  }
  return { ids: loaded, roads, buildings, water, parks, hasRegister };
}

function intersects(b, v) {
  return !v || (b[0] <= v[2] && b[2] >= v[0] && b[1] <= v[3] && b[3] >= v[1]);
}

function pathOfRings(rings, toXY) {
  const parts = [];
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => toXY(lon, lat));
    if (pts.length < 3) continue;
    parts.push(`M${pts.map(([x, y]) =>
      `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join("L")}Z`);
  }
  return parts.join("");
}

function pathOfLines(lines, toXY) {
  const parts = [];
  for (const pts of lines) {
    if (pts.length < 2) continue;
    parts.push(`M${pts.map(([lon, lat]) => {
      const [x, y] = toXY(lon, lat);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    }).join("L")}`);
  }
  return parts.join("");
}

// Project ground into one combined SVG path string per layer, clipped to
// the lon/lat viewport bbox. Buildings are omitted at wide scale.
export function projectMapGround(ground, toXY, bbox, metersPerPx) {
  const empty = { water: "", parks: "", buildings: "", major: "", minor: "" };
  if (!ground || typeof toXY !== "function") return empty;
  const showBuildings = !(Number(metersPerPx) > MAP_GROUND_BUILDING_MPP);
  const waterRings = [];
  const parkRings = [];
  const buildingRings = [];
  const major = [];
  const minor = [];
  for (const f of ground.water || []) {
    if (f && f.bbox && intersects(f.bbox, bbox)) waterRings.push(...f.rings);
  }
  for (const f of ground.parks || []) {
    if (f && f.bbox && intersects(f.bbox, bbox)) parkRings.push(...f.rings);
  }
  if (showBuildings) {
    for (const f of ground.buildings || []) {
      if (f && f.bbox && intersects(f.bbox, bbox)) buildingRings.push(...f.rings);
    }
  }
  for (const r of ground.roads || []) {
    if (!r || !r.bbox || !intersects(r.bbox, bbox)) continue;
    (r.cls === "major" ? major : minor).push(r.pts);
  }
  return {
    water: pathOfRings(waterRings, toXY),
    parks: pathOfRings(parkRings, toXY),
    buildings: pathOfRings(buildingRings, toXY),
    major: pathOfLines(major, toXY),
    minor: pathOfLines(minor, toXY),
  };
}

// Attribution flags for the visible viewport: OSM whenever any ground is
// visible, and the MOLIT building register when register footprints are.
export function mapGroundAttribution(ground, bbox) {
  const out = { hasGround: false, hasRegister: false };
  if (!ground) return out;
  const any = (list) => (list || []).some((f) => f && f.bbox && intersects(f.bbox, bbox));
  out.hasGround = any(ground.water) || any(ground.parks)
    || any(ground.buildings) || any(ground.roads);
  out.hasRegister = (ground.buildings || []).some((f) =>
    f && f.register && f.bbox && intersects(f.bbox, bbox));
  return out;
}

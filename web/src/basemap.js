// Stage 25a: light raster basemap + zoom/pan maths for the candidate map.
// Pure, no DOM — except one env read in basemapApiBase. The tiles come
// from our own proxy (/api/tiles/white/…); no key, no stored geocoder.
import { tileToLonLat, tilesForBBox } from "./aerial/tiles.js";
// 33a2: only the pure out-of-area predicate — never the key-carrying
// upstream helpers. The proxy bounds stay server-side and unchanged.
import { tileInBounds } from "./aerial/proxy.js";
import { API_BASE, LIVE_API } from "./paths.js";

// Web-Mercator metres per pixel at zoom 0 on the equator.
const WEB_MERC_M_PER_PX_Z0 = 156543.03;
const MIN_Z = 7;
const MAX_Z = 19;

// Where the tile proxy lives: the relay origin (API_BASE) on the
// public site, the same origin's /api/tiles on a dev server, or null
// for a static build with no relay (no basemap). Node (tests) has no
// import.meta.env, which reads as API_BASE "" with LIVE_API true
// (same-origin, harmless without a server).
export function basemapApiBase() {
  if (!LIVE_API) return null;
  return API_BASE;
}

// 26k: contiguous-US bbox (lon/lat). Inside it the chat map uses
// USGS National Map topo tiles directly (no relay, no key); elsewhere
// VWorld.
export const US_BBOX = [-125, 24, -66, 50];

export function isUsLonLat(lon, lat) {
  const x = Number(lon);
  const y = Number(lat);
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= US_BBOX[0] && x <= US_BBOX[2] && y >= US_BBOX[1] && y <= US_BBOX[3];
}

export function basemapProvider(lon, lat) {
  return isUsLonLat(lon, lat) ? "usgs" : "vworld";
}

export function basemapTileUrl(apiBase, z, y, x, { provider = "vworld" } = {}) {
  if (provider === "usgs") {
    return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/${z}/${y}/${x}`;
  }
  return `${apiBase}/api/tiles/white/${z}/${y}/${x}.png`;
}

// The integer z whose Web-Mercator m/px is closest to metersPerPx in
// log2, clamped to 7–19.
export function pickBasemapZoom(metersPerPx, lat) {
  const mpp = Number(metersPerPx);
  if (!Number.isFinite(mpp) || mpp <= 0) return MAX_Z;
  const cos = Math.cos((Number(lat) * Math.PI) / 180) || 1e-9;
  const z = Math.round(Math.log2((WEB_MERC_M_PER_PX_Z0 * cos) / mpp));
  return Math.min(MAX_Z, Math.max(MIN_Z, z));
}

// The tiles covering the visible stage [0, 0, W, H]. toLonLat is the
// inverse of the current toXY. Steps z down while the cover would
// need more than maxTiles tiles.
// 33a2: VWorld tiles the proxy would reject (z ≥ 11 outside
// TILE_BOUNDS) are never returned, so the client never requests
// them. USGS has no bounds and is unclipped.
export function basemapTiles({ toLonLat, W, H, lat, metersPerPx, maxTiles = 80, provider = "vworld" }) {
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const corners = [toLonLat(0, 0), toLonLat(w, 0), toLonLat(0, h), toLonLat(w, h)];
  const lons = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  let z = pickBasemapZoom(metersPerPx, lat);
  let range = tilesForBBox(bbox, z);
  while ((range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) > maxTiles && z > MIN_Z) {
    z -= 1;
    range = tilesForBBox(bbox, z);
  }
  const out = [];
  for (let x = range.x0; x <= range.x1; x++) {
    for (let y = range.y0; y <= range.y1; y++) {
      if (provider !== "usgs" && !tileInBounds(z, y, x)) continue;
      out.push({
        key: `${z}/${y}/${x}`,
        z, x, y,
        nw: tileToLonLat(x, y, z),
        se: tileToLonLat(x + 1, y + 1, z),
      });
    }
  }
  return out;
}

// 33a2: the low-zoom underlay for the same visible stage [0, 0, W, H]
// at min(z, 10) — z < 11 tiles are always inside the proxy bounds, so
// out-of-area corners show the blurrier map instead of bare ground.
// Deduped, capped at maxTiles (steps down from min(z, 10) while over
// budget). VWorld only: USGS has no bounds and needs no underlay.
export function basemapUnderlayTiles({ toLonLat, W, H, z, provider = "vworld", maxTiles = 16 }) {
  if (provider === "usgs") return [];
  const w = Math.max(1, Number(W) || 1);
  const h = Math.max(1, Number(H) || 1);
  const corners = [toLonLat(0, 0), toLonLat(w, 0), toLonLat(0, h), toLonLat(w, h)];
  const lons = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  let uz = Math.min(Number(z) || MIN_Z, 10);
  if (!Number.isFinite(uz)) return [];
  uz = Math.max(MIN_Z, uz);
  let range = tilesForBBox(bbox, uz);
  while ((range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1) > maxTiles && uz > MIN_Z) {
    uz -= 1;
    range = tilesForBBox(bbox, uz);
  }
  const seen = new Set();
  const out = [];
  for (let x = range.x0; x <= range.x1; x++) {
    for (let y = range.y0; y <= range.y1; y++) {
      const key = `${uz}/${y}/${x}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key, z: uz, x, y,
        nw: tileToLonLat(x, y, uz),
        se: tileToLonLat(x + 1, y + 1, uz),
      });
    }
  }
  return out;
}

// 50a: load state for the CURRENT visible tiles, keyed by FULL
// provider URL. Pending (absent) is not success; errors from another
// view/provider never match fresh URLs, so they cannot disable them.
export const BASEMAP_TILE_TIMEOUT_MS = 12000;
export const BASEMAP_TILE_STATE_LIMIT = 240;

// Full provider URLs for a visible tile list (normal or underlay).
export function basemapTileUrlsFor(apiBase, tiles, provider) {
  return (tiles || []).map((t) =>
    basemapTileUrl(apiBase, t.z, t.y, t.x, { provider }));
}

// Aggregate load status over one render's visible URLs only.
// stateByUrl maps full URL -> "loaded" | "error"; absent means pending.
export function basemapLoadStatus(urls, stateByUrl) {
  const list = urls || [];
  const state = stateByUrl || {};
  let loaded = 0;
  let errors = 0;
  for (const u of list) {
    if (state[u] === "loaded") loaded += 1;
    else if (state[u] === "error") errors += 1;
  }
  const pending = list.length - loaded - errors;
  let status = "idle";
  if (list.length === 0) status = "idle";
  else if (loaded === list.length) status = "loaded";
  else if (errors > 0 && loaded > 0) status = "partial";
  else if (errors > 0 && pending > 0) status = "loading";
  else if (errors > 0) status = "unavailable";
  else status = "loading";
  return { total: list.length, loaded, errors, pending, status };
}

// Failed URLs among the CURRENT visible list only — what Retry
// re-requests. Successful tiles are never included.
export function basemapFailedUrls(urls, stateByUrl) {
  const state = stateByUrl || {};
  return (urls || []).filter((u) => state[u] === "error");
}

// 50b: per-URL attempt identity — an image's late onLoad/onError
// applies only when the attempt captured in its closure still matches
// the URL's current remount nonce. A sibling URL's retry changes only
// its own nonce, so this URL's still-current success stays accepted.
// A URL with no nonce entry is on its first attempt (id 0).
export function isBasemapTileAttemptCurrent(nonceByUrl, url, attempt) {
  const m = nonceByUrl || {};
  const cur = Object.prototype.hasOwnProperty.call(m, url) ? m[url] : 0;
  return attempt === cur;
}

// Idempotent event application: same value returns the same object
// reference (no setState loop). expectedGen/currentGen drop late
// events from a previous retry/view when both are provided.
export function applyBasemapTileEvent(stateByUrl, url, next, expectedGen, currentGen) {
  if (expectedGen !== undefined && currentGen !== undefined
    && expectedGen !== currentGen) return stateByUrl;
  if (next !== "loaded" && next !== "error") return stateByUrl;
  const prev = stateByUrl || {};
  if (prev[url] === next) return prev;
  return { ...prev, [url]: next };
}

// Bound retained state: keep every visible URL, then fill up to
// limit with other entries. Never grows forever during pan.
export function pruneBasemapTileState(stateByUrl, visibleUrls, limit = BASEMAP_TILE_STATE_LIMIT) {
  const prev = stateByUrl || {};
  const keys = Object.keys(prev);
  const cap = Math.max(0, Number(limit) || 0);
  if (keys.length <= cap) return prev;
  const keep = new Set(visibleUrls || []);
  const out = {};
  for (const u of keep) {
    if (Object.prototype.hasOwnProperty.call(prev, u)) out[u] = prev[u];
  }
  for (const k of keys) {
    if (Object.keys(out).length >= cap) break;
    if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = prev[k];
  }
  return out;
}

// Retry step: clear failed CURRENT-visible URLs back to pending and
// bump their remount nonce; successful tiles keep state and nonce.
// 50b: each bump is strictly increasing per URL (never 0 for a retried
// URL), so the retired image's captured attempt can never match the
// fresh one. Retained nonces are bounded exactly like tile state —
// visible entries are always kept, so a live image's id is never
// recycled while it can still fire.
export function nextBasemapRetry(stateByUrl, nonceByUrl, visibleUrls) {
  const prev = stateByUrl || {};
  const nonce = nonceByUrl || {};
  const failed = new Set(basemapFailedUrls(visibleUrls, prev));
  if (failed.size === 0) return { state: prev, nonce };
  const state = { ...prev };
  const next = { ...nonce };
  for (const u of failed) {
    delete state[u];
    next[u] = (Number(next[u]) || 0) + 1;
  }
  return { state, nonce: pruneBasemapTileState(next, visibleUrls, BASEMAP_TILE_STATE_LIMIT) };
}

// Screen-space zoom/pan around (cx, cy): apply maps stage px to
// screen px, invert maps back.
export function viewTransform({ zoom, panX, panY, cx, cy }) {
  const z = Number(zoom) || 1;
  return {
    apply: ([x, y]) => [cx + (x - cx) * z + panX, cy + (y - cy) * z + panY],
    invert: ([x, y]) => [(x - panX - cx) / z + cx, (y - panY - cy) / z + cy],
  };
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 12;

// Zoom by factor around the stage point (px, py): the point under the
// cursor stays fixed on screen. Zoom clamps to 0.6–12.
export function zoomAt(state, factor, px, py, cx, cy) {
  const z0 = Number(state && state.zoom) || 1;
  const z1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z0 * Number(factor)));
  const x0 = Number(state && state.panX) || 0;
  const y0 = Number(state && state.panY) || 0;
  return {
    zoom: z1,
    panX: x0 + (px - cx) * (z0 - z1),
    panY: y0 + (py - cy) * (z0 - z1),
  };
}

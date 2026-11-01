// Stage 39a — isomap shooting mode: pure query + tile helpers (no DOM,
// no three.js). The browser wiring lives in main.js (bootIsomap); the
// capture loop lives in web/scripts/isomap-shoot.mjs.
import { METERS_PER_DEG_LAT as _M_PER_DEG, xyToLonLat } from "./frame.js";

export const ISOMAP_DEFAULTS = { span: 240, az: 45, el: 35, px: 1024 };
export const ISOMAP_LIMITS = {
  span: [60, 1200],
  el: [15, 75],
  px: [256, 2048],
};

function clampNum(v, lo, hi, fallback) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function optNum(v, fallback) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function queryParams(search) {
  if (search instanceof URLSearchParams) return search;
  return new URLSearchParams(search || "");
}

// Parse the isomap query with defaults + clamping. span 60–1200 m,
// el 15–75°, px 256–2048. lon/lat are NaN when absent/invalid.
export function parseIsomapParams(search) {
  const q = queryParams(search);
  return {
    enabled: q.get("isomap") === "1",
    area: q.get("area") || "",
    lon: Number(q.get("lon")),
    lat: Number(q.get("lat")),
    span: clampNum(q.get("span"), ...ISOMAP_LIMITS.span, ISOMAP_DEFAULTS.span),
    az: optNum(q.get("az"), ISOMAP_DEFAULTS.az),
    el: clampNum(q.get("el"), ...ISOMAP_LIMITS.el, ISOMAP_DEFAULTS.el),
    px: Math.round(clampNum(q.get("px"), ...ISOMAP_LIMITS.px, ISOMAP_DEFAULTS.px)),
    grid: Math.min(9, Math.max(1, parseInt(q.get("grid") || "1", 10) || 1)),
    overlap: optNum(q.get("overlap"), 0.15),
  };
}

// N×N tile centres around (lon, lat), stepped by span*(1-overlap)
// metres east/north in the ground plane. Uses the repo frame helper
// (equirectangular around the request point) for metres → lon/lat.
export function isomapTileCenters({ lon, lat, span, grid = 1, overlap = 0.15 }) {
  const step = span * (1 - overlap);
  const half = (grid - 1) / 2;
  const origin = { lon, lat };
  const tiles = [];
  for (let r = 0; r < grid; r += 1) {
    for (let c = 0; c < grid; c += 1) {
      const dx = (c - half) * step;
      const dy = (half - r) * step;
      const [tlon, tlat] = xyToLonLat(dx, dy, origin);
      tiles.push({ r, c, lon: tlon, lat: tlat, dx, dy });
    }
  }
  return tiles;
}

// Camera offset for azimuth az (deg, 0 = from south, +east) and
// elevation el (deg above ground), at distance dist (m). Three.js
// mapping: east = +x, north = -z, so south is +z.
export function isomapCameraOffset(az, el, dist) {
  const azR = (Number(az) * Math.PI) / 180;
  const elR = (Number(el) * Math.PI) / 180;
  const horiz = dist * Math.cos(elR);
  return [horiz * Math.sin(azR), dist * Math.sin(elR), horiz * Math.cos(azR)];
}

// Square orthographic frustum so `span` metres of ground fit.
export function isomapOrthoFrustum(span) {
  return { left: -span / 2, right: span / 2, top: span / 2, bottom: -span / 2 };
}

// 39a2: tolerant hide for the isomap shot. crowd/street things arrive in
// whatever shape the builders return (array, object of meshes, Group,
// single mesh) — hide all of them and never throw, so one odd value
// cannot stop the shot. Each mesh hide is guarded on its own.
export function hideIsomapThing(thing) {
  try {
    if (thing == null) return;
    if (Array.isArray(thing)) {
      for (const m of thing) {
        try { if (m) m.visible = false; } catch { /* next mesh */ }
      }
      return;
    }
    if (typeof thing !== "object" && typeof thing !== "function") return;
    if (typeof thing.traverse === "function") {
      try {
        thing.traverse((o) => {
          try { if (o) o.visible = false; } catch { /* next node */ }
        });
      } catch { /* traverse itself failed; fall through to visible/values */ }
    }
    try { if ("visible" in thing) thing.visible = false; } catch { /* keep going */ }
    if (thing.isObject3D) return;
    let vals = null;
    try { vals = Object.values(thing); } catch { return; }
    if (!vals) return;
    for (const v of vals) hideIsomapThing(v);
  } catch { /* hiding must never break the shot */ }
}

// 39a2: the shot's ground bbox — a `factor` (default 1.6) × span square
// around (lon, lat), in [w, s, e, n]. The sharp drape covers this box;
// the ortho frustum (span wide) always fits inside it.
export function isomapShotBounds({ lon, lat, span, factor = 1.6 }) {
  const half = (Number(span) * Number(factor)) / 2;
  const kx = _M_PER_DEG * Math.cos((Number(lat) * Math.PI) / 180);
  return [
    Number(lon) - half / kx,
    Number(lat) - half / _M_PER_DEG,
    Number(lon) + half / kx,
    Number(lat) + half / _M_PER_DEG,
  ];
}

// 39a3: ancestor-safe chrome hide for the isomap shot. Never hides the
// canvas or any ancestor of it; hides the siblings along that ancestor
// chain instead. Works on real DOM nodes and on fake trees with only
// { parentElement, children, style }. Pins the canvas wrapper so the
// canvas is exactly px×px at the top-left.
export function hideIsomapChrome(canvas, px) {
  if (!canvas) return;
  let node = canvas;
  while (node && node.parentElement) {
    const parent = node.parentElement;
    let kids = null;
    try { kids = parent.children || []; } catch { kids = []; }
    try {
      for (const sib of kids) {
        if (sib !== node) {
          try { if (sib && sib.style) sib.style.display = "none"; } catch { /* next sibling */ }
        }
      }
    } catch { /* hiding must never break the shot */ }
    node = parent;
  }
  const wrap = (canvas && canvas.parentElement) || canvas;
  try {
    if (wrap && wrap.style) {
      wrap.style.position = "fixed";
      wrap.style.inset = "0";
      if (Number.isFinite(Number(px))) {
        wrap.style.width = `${Number(px)}px`;
        wrap.style.height = `${Number(px)}px`;
      }
    }
  } catch { /* pinning must never break the shot */ }
}

// 39a3: data-URL (image/png base64) -> Buffer, used by
// web/scripts/isomap-shoot.mjs to write the shot PNG.
export function isomapDataUrlToBuffer(dataUrl) {
  const s = String(dataUrl || "");
  const ix = s.indexOf(",");
  const b64 = ix >= 0 ? s.slice(ix + 1) : s;
  return Buffer.from(b64, "base64");
}

// 39a2: one USGS NAIP ImageServer image over the shot bbox (public
// domain, CORS *). imageSR=3857 returns Web-Mercator pixels with north
// at the top, so the bbox is the texture range directly.
export function naipExportUrl(bbox, size = 2048) {
  const s = Number(size) || 2048;
  return `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox=${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}&bboxSR=4326&imageSR=3857&size=${s},${s}&format=jpg&f=image`;
}

// Web-Mercator Y (the same formula lonLatToTile uses), so NAIP v lines
// up with the uvForLonLat tile convention: v = 0 at the north edge.
function naipMercY(lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(rad) + 1 / Math.cos(rad));
}

// 39a2: lon/lat -> [u, v] over a NAIP export bbox. u is linear in lon
// (Mercator x is linear in lon); v runs 0 at the north edge to 1 at
// the south edge from Web-Mercator y, matching uvForLonLat.
export function naipUvForLonLat(lon, lat, bbox) {
  const u = (Number(lon) - bbox[0]) / (bbox[2] - bbox[0]);
  const yn = naipMercY(bbox[3]);
  const ys = naipMercY(bbox[1]);
  const y = naipMercY(lat);
  return [u, (yn - y) / (yn - ys)];
}

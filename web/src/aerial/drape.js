// Stage 20d: drape live VWorld aerial photos over the ground and roofs.
//
// Client-side. Fetches tiles through the dev-server proxy or the relay
// (/api/aerial, which holds the key server-side) and never touches the key or the
// upstream URL — those live only in web/src/aerial/proxy.js (server-only)
// and web/vite.config.js. Tiles are drawn into one canvas, never to disk.
//
// Texture convention: the mosaic canvas has north at row 0 and the
// CanvasTexture uses flipY = false, so uvForLonLat maps directly.
import { TILE_PX, MAX_MOSAIC_PX, tilesForBBox, uvForLonLat, pickZoom } from "./tiles.js";
import { haversineM, xyToLonLat } from "../frame.js";
import { LIVE_API, apiUrl } from "../paths.js";
import { isUsLonLat } from "../basemap.js";

export const AERIAL_CREDIT = "항공사진 © 국토교통부 공간정보 오픈플랫폼(VWorld)";
export const USGS_CREDIT = "Imagery: USGS The National Map";

// 26e: USGS The National Map tiles are addressed z/y/x and are
// public domain; browsers fetch them directly, no relay, no key.
export function usgsTileUrl(z, y, x) {
  return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`;
}

// US when the area says so, else when its bbox centre is in US_BBOX.
export function isUsArea(area) {
  if (!area) return false;
  if (area.country === "US") return true;
  if (!Array.isArray(area.bbox) || area.bbox.length < 4) return false;
  return isUsLonLat((area.bbox[0] + area.bbox[2]) / 2, (area.bbox[1] + area.bbox[3]) / 2);
}

export function aerialCreditFor(area) {
  return isUsArea(area) ? USGS_CREDIT : AERIAL_CREDIT;
}

function hexCss(hex) {
  return `#${Number(hex).toString(16).padStart(6, "0")}`;
}

function loadBitmap(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// World-space vertex (east = +x, north = -z) -> mosaic uv. A mesh in
// local space (the fringe plane) reads through its matrixWorld.
function pushMosaicUVs(geo, origin, range, zoom, onlyUpward = false, mesh = null) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new Float32Array(pos.count * 2);
    geo.setAttribute("uv", { array: uv, itemSize: 2 });
  }
  const arr = uv.array || uv;
  const set = typeof uv.setXY === "function"
    ? (i, u, v) => uv.setXY(i, u, v)
    : (i, u, v) => { arr[i * 2] = u; arr[i * 2 + 1] = v; };
  updateWorld(mesh);
  for (let i = 0; i < pos.count; i++) {
    if (onlyUpward && nor && nor.getY(i) <= 0.9) continue;
    const [east, north] = worldEN(mesh, pos, i);
    const [lon, lat] = xyToLonLat(east, north, origin);
    const [u, v] = uvForLonLat(lon, lat, range, zoom);
    set(i, u, v);
  }
  uv.needsUpdate = true;
}

// 36c2: corridor roof UVs are plain mosaic UVs over the corridor range.
export function roofUv(lonlat, range, zoom) {
  return uvForLonLat(lonlat[0], lonlat[1], range, zoom);
}

// 36c2: every ground surface that shows after a successful drape. The
// complex plates / landuse / road paint live in groundMesh, so draping
// only terrainMesh left them beige wherever terrainMesh exists.
export function drapedGroundMeshes({ terrainMesh = null, groundMesh = null } = {}) {
  return [terrainMesh, groundMesh].filter(Boolean);
}

// 36c: pure bounds -> zoom -> tile-range choice (no DOM, no fetch).
// Shared by the station drape and the ride-corridor drape so every 3D
// scene uses the same zoom/step-down rule.
export function drapePlan(bounds, { usArea = false } = {}) {
  const midLat = (bounds[1] + bounds[3]) / 2;
  const widthM = haversineM(bounds[0], midLat, bounds[2], midLat);
  let zoom = pickZoom(widthM);
  if (usArea) zoom = Math.min(zoom, 18);
  let range = tilesForBBox(bounds, zoom);
  while (zoom > 6
    && ((range.x1 - range.x0 + 1) * TILE_PX > MAX_MOSAIC_PX
      || (range.y1 - range.y0 + 1) * TILE_PX > MAX_MOSAIC_PX)) {
    zoom -= 1;
    range = tilesForBBox(bounds, zoom);
  }
  return { zoom, range };
}

// A mesh whose geometry is authored in local space (the fringe plane:
// PlaneGeometry pitched -90° and offset by the mesh transform) reads
// through matrixWorld; plain scene meshes sit at identity. Fakes in
// unit tests carry no matrix and read raw.
function updateWorld(mesh) {
  try {
    if (mesh && typeof mesh.updateWorldMatrix === "function") {
      mesh.updateWorldMatrix(true, false);
    }
  } catch { /* detached meshes and fakes read raw */ }
}

function worldEN(mesh, pos, i) {
  const x = pos.getX(i);
  const y = typeof pos.getY === "function" ? pos.getY(i) : 0;
  const z = typeof pos.getZ === "function" ? pos.getZ(i) : 0;
  const el = mesh && mesh.matrixWorld && mesh.matrixWorld.elements;
  if (!el || el.length < 16) return [x, -z];
  return [el[0] * x + el[4] * y + el[8] * z + el[12],
    -(el[2] * x + el[6] * y + el[10] * z + el[14])];
}

// 36c: buffered scene extent — the union of area.bbox with the lon/lat
// bbox of every ground/terrain/roof/fringe vertex, so the photo covers
// the whole scene instead of the 1.3 km area.bbox. Never smaller than
// area.bbox. An explicit bounds argument wins outright (the corridor
// has no area).
function meshExtent(meshes, origin) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  let found = false;
  for (const m of meshes || []) {
    const pos = m && m.geometry && m.geometry.attributes
      && m.geometry.attributes.position;
    if (!pos || typeof pos.getX !== "function") continue;
    updateWorld(m);
    for (let i = 0; i < pos.count; i++) {
      const [east, north] = worldEN(m, pos, i);
      const [lon, lat] = xyToLonLat(east, north, origin);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      found = true;
      if (lon < w) w = lon;
      if (lon > e) e = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
  }
  return found ? [w, s, e, n] : null;
}

export function sceneDrapeBounds({ area, bounds, origin,
  terrainMesh = null, groundMesh = null, roofMesh = null,
  fringeMesh = null } = {}) {
  if (Array.isArray(bounds) && bounds.length >= 4) return [...bounds];
  const base = area && Array.isArray(area.bbox) ? [...area.bbox] : null;
  const ext = origin
    ? meshExtent([terrainMesh, groundMesh, roofMesh, fringeMesh], origin)
    : null;
  if (!base) return ext;
  if (!ext) return base;
  return [Math.min(base[0], ext[0]), Math.min(base[1], ext[1]),
    Math.max(base[2], ext[2]), Math.max(base[3], ext[3])];
}

// 36c: one tile-fetch loop for every drape. Missing tiles keep the
// painted ground colour underneath.
async function fetchMosaic(zoom, range, { usArea, look = {} }) {
  const nx = range.x1 - range.x0 + 1;
  const ny = range.y1 - range.y0 + 1;
  const canvas = document.createElement("canvas");
  canvas.width = nx * TILE_PX;
  canvas.height = ny * TILE_PX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = hexCss(look.terrainBase ?? 0xd2c9a9);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const jobs = [];
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) jobs.push([tx, ty]);
  }
  let drawn = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (jobs.length > 0) {
      const [tx, ty] = jobs.pop();
      try {
        const url = usArea ? usgsTileUrl(zoom, ty, tx)
          : apiUrl(`/api/aerial/${zoom}/${ty}/${tx}.jpeg`);
        const r = await fetch(url);
        if (!r.ok) continue;
        const img = await loadBitmap(await r.blob());
        ctx.drawImage(img, (tx - range.x0) * TILE_PX, (ty - range.y0) * TILE_PX);
        drawn += 1;
      } catch {
        // Missing tile: the painted ground colour shows through.
      }
    }
  }));
  return { canvas, drawn };
}

function mosaicTexture(THREE, renderer, mosaic) {
  const tex = new THREE.CanvasTexture(mosaic);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.generateMipmaps = true;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  return tex;
}

// 36c: drape the ride-corridor base plane (manifest.bounds). Painted
// fallback: any failure leaves the land-coloured plane as it is.
export async function drapeCorridorAerial({ THREE, renderer, groundMesh,
  bounds, look = {} }) {
  if (!groundMesh || !Array.isArray(bounds) || bounds.length < 4) {
    return { ok: false, reason: "bounds" };
  }
  const usArea = isUsLonLat((bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2);
  if (!usArea) {
    if (!LIVE_API) return { ok: false, reason: "static" };
    try {
      const r = await fetch(apiUrl("/api/aerial/status"));
      if (!r.ok) return { ok: false, reason: "status" };
      const status = await r.json();
      if (!status || status.hasKey !== true) return { ok: false, reason: "no-key" };
    } catch {
      return { ok: false, reason: "status" };
    }
  }
  const { zoom, range } = drapePlan(bounds, { usArea });
  const { canvas, drawn } = await fetchMosaic(zoom, range, { usArea, look });
  const tex = mosaicTexture(THREE, renderer, canvas);
  const geo = groundMesh.geometry;
  const pos = geo && geo.attributes && geo.attributes.position;
  if (pos && typeof pos.getX === "function" && pos.count > 0) {
    // The corridor plane is centred on the bounds, so local planar UVs
    // land exactly on the mosaic (north = +y before the -90° pitch).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanX = (maxX - minX) || 1;
    const spanY = (maxY - minY) || 1;
    let uv = geo.attributes.uv;
    const arr = uv && (uv.array || null);
    const set = uv && typeof uv.setXY === "function"
      ? (i, u, v) => uv.setXY(i, u, v)
      : null;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - minX) / spanX;
      const v = (maxY - pos.getY(i)) / spanY;
      if (set) set(i, u, v);
      else if (arr) { arr[i * 2] = u; arr[i * 2 + 1] = v; }
    }
    if (uv) uv.needsUpdate = true;
  }
  groundMesh.material.map = tex;
  groundMesh.material.needsUpdate = true;
  return { ok: true, tiles: drawn, zoom, texture: tex, range };
}

export async function drapeAerial({ THREE, renderer, scene, area, origin,
  terrainMesh = null, groundMesh = null, roadMeshes = [], roofMesh = null,
  fringeMesh = null, look = {}, style = "photo", bounds = null }) {
  // 26e: US areas drape USGS tiles fetched directly (no relay, no
  // key), so they work on a static build too. Korean areas keep the
  // relay path below.
  const usArea = isUsArea(area);
  if (!usArea) {
    // 23b: without a live API (no dev server, no relay) there is no
    // /api/aerial — the ground stays painted.
    if (!LIVE_API) return { ok: false, reason: "static" };
    // 1. Key check: without a key the painted ground stays as it is.
    let status = null;
    try {
      const r = await fetch(apiUrl("/api/aerial/status"));
      if (!r.ok) return { ok: false, reason: "status" };
      status = await r.json();
    } catch {
      return { ok: false, reason: "status" };
    }
    if (!status || status.hasKey !== true) return { ok: false, reason: "no-key" };
  }

  // 2. Zoom + tile range over the whole scene extent (36c), capped at
  // 4096 px per side.
  const effBounds = sceneDrapeBounds({ area, bounds, origin,
    terrainMesh, groundMesh, roofMesh, fringeMesh });
  const { zoom, range } = drapePlan(effBounds, { usArea });
  // 3. Fetch tiles (concurrency 6) into one canvas.
  const { canvas, drawn } = await fetchMosaic(zoom, range, { usArea, look });
  let mosaic = canvas;
  if (style === "painted") {
    // Painted grade: the same photo, 10 % less saturation so it sits
    // with the painted buildings.
    const graded = document.createElement("canvas");
    graded.width = canvas.width;
    graded.height = canvas.height;
    const g = graded.getContext("2d");
    g.filter = "saturate(0.9)";
    g.drawImage(canvas, 0, 0);
    mosaic = graded;
  }
  const tex = mosaicTexture(THREE, renderer, mosaic);

  // 4. Ground: lon/lat UVs per vertex; the photo replaces the land
  // mask. Every ground surface drapes (36c2): the complex plates /
  // landuse / road paint live in groundMesh, which the old
  // terrainMesh-only drape skipped, leaving beige plates in-scene.
  for (const ground of drapedGroundMeshes({ terrainMesh, groundMesh })) {
    pushMosaicUVs(ground.geometry, origin, range, zoom, false, ground);
    ground.material.map = tex;
    ground.material.vertexColors = false;
    ground.material.needsUpdate = true;
  }
  // Road ribbons stay readable under the route line at 35 % opacity.
  for (const m of roadMeshes || []) {
    if (!m || !m.material) continue;
    m.material.transparent = true;
    m.material.opacity = 0.35;
    m.material.needsUpdate = true;
  }

  // 5. Roofs: top faces only; walls keep their facades. The roofs are a
  // dedicated mesh, so planar photo UVs replace the metre UVs there.
  if (roofMesh) {
    pushMosaicUVs(roofMesh.geometry, origin, range, zoom, true, roofMesh);
    roofMesh.material.map = tex;
    roofMesh.material.color.setRGB(1, 1, 1);
    roofMesh.material.needsUpdate = true;
  }
  // 6. Fringe (36c2): the base plane under the scene edge gets the same
  // mosaic with lon/lat UVs and a white base colour so the photo reads
  // true. Untouched on ?ground=paint or drape failure, as before.
  if (fringeMesh && fringeMesh.geometry && fringeMesh.material) {
    pushMosaicUVs(fringeMesh.geometry, origin, range, zoom, false, fringeMesh);
    fringeMesh.material.map = tex;
    if (typeof fringeMesh.material.color?.setRGB === "function") {
      fringeMesh.material.color.setRGB(1, 1, 1);
    }
    fringeMesh.material.needsUpdate = true;
  }
  void scene;
  return { ok: true, tiles: drawn, zoom, texture: tex, range };
}

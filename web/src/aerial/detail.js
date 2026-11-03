// Stage 46a: camera-local aerial detail over the broad base drape.
//
// The full-scene base mosaic is capped at 4k pixels, so a close Pangyo
// view (2 km at z17) or a wide US view (8 km at z15) looks blurry.
// This module fetches one extra high-density patch around the camera
// target and blends it over the existing base material in the shader.
//
// Real imagery only: US comes from the USGS NAIP ImageServer export
// endpoint, KR reuses the existing VWorld tile proxy (/api/aerial).
// Nothing is upscaled or sharpened; nothing is written to disk.
import { TILE_PX, tilesForBBox, tileToLonLat } from "./tiles.js";
import { xyToLonLat, lonLatToXY } from "../frame.js";
import { apiUrl } from "../paths.js";

export const DETAIL_SPANS_M = [512, 1024, 2048, 4096, 8192];
const DETAIL_KEY = "aerial-detail-46a";
const PLAN_GAP_MS = 500;
const STABLE_MS = 350;
const RETRY_GAP_MS = 15000;
const FETCH_TIMEOUT_MS = 20000;
const NAIP_TIMEOUT_MS = 45000;
const TILE_CONCURRENCY = 6;
const MAX_TEX_PX = 4096;
// Live NAIP ImageServer cap (official f=pjson maxImageWidth/Height):
// requests above 4000px return HTTP 200 with a JSON 400 error.
export const NAIP_MAX_IMAGE_PX = 4000;

function fail(msg) {
  throw new TypeError(`planDetail: ${msg}`);
}

// Pure: quantize the camera view into a stable padded square patch.
// world EN = [target.x, -target.z]; three north is -z.
export function planDetail({ target, framedWidthM, origin, usArea = false, maxTextureSize = 4096 }) {
  if (!target || !Number.isFinite(Number(target.x)) || !Number.isFinite(Number(target.z))) {
    fail("target needs finite numeric x/z (three.js world)");
  }
  const widthReq = Number(framedWidthM);
  if (!Number.isFinite(widthReq) || widthReq <= 0) fail("framedWidthM must be a finite positive number");
  if (widthReq > 8192 / 1.5) throw new RangeError("planDetail: framedWidthM overwide (>8192/1.5)");
  if (!origin || !Number.isFinite(Number(origin.lon)) || !Number.isFinite(Number(origin.lat))) {
    fail("origin needs finite numeric lon/lat");
  }
  let cap = Math.floor(Number(maxTextureSize));
  if (!Number.isFinite(cap)) fail("maxTextureSize must be finite");
  cap = Math.min(MAX_TEX_PX, Math.max(256, cap));

  const width = Math.min(Math.max(widthReq, 1), 32000);
  const desired = width * 1.5;
  const span = DETAIL_SPANS_M.find((s) => s >= desired) ?? 8192;

  // Snap the centre to a span/8 grid so small camera moves reuse the patch.
  const cx = Number(target.x);
  const cy = -Number(target.z);
  const cell = span / 8;
  const scx = Math.round(cx / cell) * cell;
  const scy = Math.round(cy / cell) * cell;

  const wEn = scx - span / 2;
  const eEn = scx + span / 2;
  const sEn = scy - span / 2;
  const nEn = scy + span / 2;
  const sw = xyToLonLat(wEn, sEn, origin);
  const ne = xyToLonLat(eEn, nEn, origin);
  const padded = [sw[0], sw[1], ne[0], ne[1]]; // [west, south, east, north]

  if (usArea) {
    // NAIP export covers the exact padded bounds (never silently expanded).
    // Provider cap is 4000px (not the 4096 GPU cap): pixels match the URL.
    const usCap = Math.min(cap, NAIP_MAX_IMAGE_PX);
    const key = `naip@${span}m@${scx},${scy}#${usCap}`;
    return {
      key,
      source: "naip",
      bounds: padded,
      worldBounds: [wEn, -nEn, span, span], // [westX, northZ, width, depth]
      pixels: [usCap, usCap],
      span,
      center: { x: scx, y: scy },
    };
  }

  // KR: highest tile zoom (<= 19, >= 6) whose mosaic fits the texture cap.
  // The shader maps the FULL tile bounds, never a stretched crop.
  let zoom = 19;
  let range = tilesForBBox(padded, zoom);
  while (
    zoom > 6 &&
    ((range.x1 - range.x0 + 1) * TILE_PX > cap || (range.y1 - range.y0 + 1) * TILE_PX > cap)
  ) {
    zoom -= 1;
    range = tilesForBBox(padded, zoom);
  }
  const nw = tileToLonLat(range.x0, range.y0, zoom); // [west, north]
  const se = tileToLonLat(range.x1 + 1, range.y1 + 1, zoom); // [east, south]
  const full = [nw[0], se[1], se[0], nw[1]];
  const [ax, ay] = lonLatToXY(full[0], full[1], origin);
  const [bx, by] = lonLatToXY(full[2], full[3], origin);
  const westX = Math.min(ax, bx);
  const eastX = Math.max(ax, bx);
  const northY = Math.max(ay, by);
  const southY = Math.min(ay, by);
  return {
    key: `vworld@${zoom}/${range.x0}/${range.y0}-${range.x1}/${range.y1}`,
    source: "vworld",
    zoom,
    range: { ...range },
    bounds: full,
    worldBounds: [westX, -northY, eastX - westX, northY - southY],
    pixels: [(range.x1 - range.x0 + 1) * TILE_PX, (range.y1 - range.y0 + 1) * TILE_PX],
    span,
    center: { x: scx, y: scy },
  };
}

// Pure: exact NAIP export URL for a detail plan (US only).
export function naipDetailUrl(bounds, size) {
  const b = Array.isArray(bounds) ? bounds.map(Number) : [];
  if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) {
    throw new TypeError("naipDetailUrl: bounds must be [w,s,e,n] finite numbers");
  }
  let s = Math.floor(Number(size));
  if (!Number.isFinite(s) || s <= 0) throw new TypeError("naipDetailUrl: size must be finite positive");
  s = Math.min(NAIP_MAX_IMAGE_PX, s);
  return (
    "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage" +
    `?bbox=${b[0]},${b[1]},${b[2]},${b[3]}&bboxSR=4326&imageSR=3857` +
    `&size=${s},${s}&format=jpg&f=image&adjustAspectRatio=false`
  );
}

function effectiveCap(renderer) {
  let cap = MAX_TEX_PX;
  try {
    const gpuProp = renderer?.capabilities?.maxTextureSize;
    const gpuFn = typeof renderer?.capabilities?.getMaxTextureSize === "function"
      ? renderer.capabilities.getMaxTextureSize()
      : undefined;
    const gpu = Number.isFinite(Number(gpuProp)) ? gpuProp : gpuFn;
    if (Number.isFinite(Number(gpu))) cap = Math.min(cap, Math.floor(Number(gpu)));
    const cw = renderer?.domElement?.clientWidth;
    if (Number.isFinite(Number(cw)) && Number(cw) < 769) cap = Math.min(cap, 2048);
  } catch {
    // Keep the default cap; a fake renderer must never break planning.
  }
  return Math.max(256, cap);
}

function defaultLoadBitmap(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  return Promise.reject(new Error("no bitmap loader available"));
}

const VERT_DECL = "varying vec2 vAerialDetailXZ;\n";
const VERT_ASSIGN = "vAerialDetailXZ = (modelMatrix * vec4(transformed, 1.0)).xz;";
const FRAG_DECL =
  "uniform sampler2D uAerialDetailMap;\n" +
  "uniform vec4 uAerialDetailRect;\n" +
  "uniform float uAerialDetailOn;\n" +
  "uniform float uAerialDetailMpp;\n" +
  "uniform float uAerialDetailMinBase;\n" +
  "varying vec2 vAerialDetailXZ;\n";
const MAP_TAG = "#include <map_fragment>";

function withDetailVertex(src) {
  let s = String(src);
  if (s.includes("#include <common>")) s = s.replace("#include <common>", `#include <common>\n${VERT_DECL}`);
  else s = VERT_DECL + s;
  if (s.includes("#include <begin_vertex>")) {
    s = s.replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_ASSIGN}`);
  } else {
    s += `\n${VERT_ASSIGN}\n`;
  }
  return s;
}

// Blend the detail patch INSIDE its world rectangle only (2% edge
// feather); outside the rectangle the base map is untouched. No
// clamping/stretching beyond the patch. Works when the material has
// no map yet: the chunk keeps its USE_MAP guard, so the shader
// compiles once the async base map arrives.
function withDetailFragment(src, THREE) {
  let s = String(src);
  if (s.includes("#include <common>")) s = s.replace("#include <common>", `#include <common>\n${FRAG_DECL}`);
  else s = FRAG_DECL + s;
  const chunk = THREE?.ShaderChunk?.map_fragment ?? MAP_TAG;
  // Tint the sampled base texel BEFORE the map chunk multiplies it into
  // diffuseColor, so material tint (night) and vertex colors keep working.
  // The original chunk (USE_MAP guard + multiplication) stays verbatim.
  // Bounded rectangle with a 2% edge feather; skipped when the base
  // mosaic already out-resolves the patch (shared mpp threshold).
  const blendBody =
    "if (uAerialDetailOn > 0.5 && uAerialDetailMpp < uAerialDetailMinBase * 0.9) {\n" +
    "  vec2 dMin = uAerialDetailRect.xy;\n" +
    "  vec2 dMax = uAerialDetailRect.zw;\n" +
    "  vec2 dSize = dMax - dMin;\n" +
    "  if (dSize.x > 0.0 && dSize.y > 0.0) {\n" +
    "    vec2 dUv = (vAerialDetailXZ - dMin) / dSize;\n" +
    "    if (dUv.x >= 0.0 && dUv.x <= 1.0 && dUv.y >= 0.0 && dUv.y <= 1.0) {\n" +
    "      vec2 dEdge = min(dUv, 1.0 - dUv) / 0.02;\n" +
    "      float dBlend = clamp(min(dEdge.x, dEdge.y), 0.0, 1.0);\n" +
    "      vec3 dCol = texture2D(uAerialDetailMap, dUv).rgb;\n" +
    "      sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, dCol, dBlend);\n" +
    "    }\n" +
    "  }\n" +
    "}\n";
  const MULT = "diffuseColor *= sampledDiffuseColor;";
  if (typeof chunk === "string" && chunk.includes(MULT)) {
    const patched = chunk.replace(MULT, `${blendBody}${MULT}`);
    if (s.includes(MAP_TAG)) return s.replace(MAP_TAG, patched);
    return `${s}\n${patched}`;
  }
  const legacy =
    `${chunk}\n` +
    "if (uAerialDetailOn > 0.5) {\n" +
    "  vec2 dMin = uAerialDetailRect.xy;\n" +
    "  vec2 dMax = uAerialDetailRect.zw;\n" +
    "  vec2 dSize = dMax - dMin;\n" +
    "  if (dSize.x > 0.0 && dSize.y > 0.0) {\n" +
    "    vec2 dUv = (vAerialDetailXZ - dMin) / dSize;\n" +
    "    if (dUv.x >= 0.0 && dUv.x <= 1.0 && dUv.y >= 0.0 && dUv.y <= 1.0) {\n" +
    "      vec2 dEdge = min(dUv, 1.0 - dUv) / 0.02;\n" +
    "      float dBlend = clamp(min(dEdge.x, dEdge.y), 0.0, 1.0);\n" +
    "      vec3 dCol = texture2D(uAerialDetailMap, dUv).rgb;\n" +
    "      diffuseColor.rgb = mix(diffuseColor.rgb, dCol, dBlend);\n" +
    "    }\n" +
    "  }\n" +
    "}\n";
  if (s.includes(MAP_TAG)) return s.replace(MAP_TAG, legacy);
  return `${s}\n${legacy}`;
}

export function createAerialDetail({
  THREE,
  renderer,
  origin,
  usArea = false,
  look = {},
  fetchImpl = (...a) => fetch(...a),
  loadBitmap = defaultLoadBitmap,
  onReady,
} = {}) {
  if (!THREE) throw new TypeError("createAerialDetail: THREE is required");
  if (!renderer) throw new TypeError("createAerialDetail: renderer is required");
  if (!origin) throw new TypeError("createAerialDetail: origin is required");

  const RectCtor = THREE.Vector4 ?? function (x = 0, y = 0, z = 0, w = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  };
  if (!RectCtor.prototype?.set) {
    RectCtor.prototype.set = function (x, y, z, w) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
      return this;
    };
  }
  // One live uniform set shared by every patched material: swaps never
  // recompile, and per-frame updates allocate nothing on the GL side.
  const shared = {
    map: { value: null },
    rect: { value: new RectCtor(0, 0, 0, 0) },
    on: { value: 0 },
    mpp: { value: 0 }, // metres per pixel of the resident patch
    minBase: { value: 1e12 }, // coarsest tracked base mpp (unknown = 1e12, finite GL uniform)
  };

  const tracked = new Set();
  let enabled = false;
  let disposed = false;
  let seq = 0;
  let pending = null; // { key, seq, controller }
  let candidate = null; // { key, plan, firstSeen }
  let lastPlanAt = -Infinity;
  let lastErrorAt = -Infinity;
  let residentKey = null;
  let residentPlan = null;
  let lastDesiredKey = null;
  const counts = { requests: 0, swaps: 0, errors: 0 };

  function materialsOf(item) {
    if (!item || typeof item !== "object") return [];
    const src = item.material !== undefined ? item.material : item;
    if (Array.isArray(src)) return src.filter((m) => m && typeof m === "object");
    // Any object counts as a material: three.js materials always carry
    // onBeforeCompile, but fake/test materials may not.
    if (src && typeof src === "object") return [src];
    return [];
  }

  function patchMaterial(mat) {
    if (!mat || mat.userData?.[DETAIL_KEY]) return;
    const prevOBC = mat.onBeforeCompile;
    const prevKey = mat.customProgramCacheKey;
    const baseMpp = { value: 1e12 }; // per-material base density; refreshed on throttled update
    const obc = function (shader, r) {
      if (typeof prevOBC === "function") prevOBC.call(this, shader, r);
      shader.uniforms.uAerialDetailMap = shared.map;
      shader.uniforms.uAerialDetailRect = shared.rect;
      shader.uniforms.uAerialDetailOn = shared.on;
      shader.uniforms.uAerialDetailMpp = shared.mpp;
      shader.uniforms.uAerialDetailMinBase = baseMpp;
      shader.vertexShader = withDetailVertex(shader.vertexShader ?? "");
      shader.fragmentShader = withDetailFragment(shader.fragmentShader ?? "", THREE);
    };
    const ck = function () {
      let prev = "";
      try {
        if (typeof prevKey === "function") prev = prevKey.call(this) ?? "";
        else if (typeof prevKey === "string") prev = prevKey;
      } catch {
        prev = "";
      }
      return `${prev}|${DETAIL_KEY}`;
    };
    try {
      mat.onBeforeCompile = obc;
      mat.customProgramCacheKey = ck;
      mat.userData = mat.userData ?? {};
      mat.userData[DETAIL_KEY] = { prevOBC, prevKey, baseMpp };
      mat.needsUpdate = true;
    } catch {
      // Fake/test materials may be frozen; leave them unpatched.
    }
  }

  // Reread per-material base density (bases may land late). Runs on the
  // throttled update cadence, never per frame. Unknown base = 1e12.
  function refreshBaseMpp() {
    let max = 0;
    let any = false;
    for (const mat of tracked) {
      any = true;
      let v = 1e12;
      try {
        const raw = Number(mat?.map?.userData?.aerialMpp);
        if (Number.isFinite(raw)) v = raw;
      } catch {
        v = 1e12;
      }
      const rec = mat?.userData?.[DETAIL_KEY];
      if (rec && rec.baseMpp) rec.baseMpp.value = v;
      if (v > max) max = v;
    }
    shared.minBase.value = any ? max : 1e12;
  }

  function invalidatePending() {
    if (pending?.controller) {
      try {
        pending.controller.abort();
      } catch {
        // ignore
      }
    }
    pending = null;
  }

  function register(meshes) {
    if (disposed) return;
    const list = Array.isArray(meshes) ? meshes : [meshes];
    for (const item of list) {
      for (const mat of materialsOf(item)) {
        if (tracked.has(mat)) continue;
        patchMaterial(mat);
        tracked.add(mat);
      }
    }
  }

  function unregister(meshes) {
    const list = Array.isArray(meshes) ? meshes : [meshes];
    for (const item of list) {
      for (const mat of materialsOf(item)) {
        if (!tracked.has(mat)) continue;
        tracked.delete(mat);
        const saved = mat.userData?.[DETAIL_KEY];
        if (saved) {
          try {
            if ("prevOBC" in saved) mat.onBeforeCompile = saved.prevOBC;
            if ("prevKey" in saved) mat.customProgramCacheKey = saved.prevKey;
            mat.needsUpdate = true;
          } catch {
            // Keep the patched shader rather than break the material.
          }
          try {
            delete mat.userData[DETAIL_KEY];
          } catch {
            // ignore
          }
        }
      }
    }
  }

  function enable() {
    if (!disposed) enabled = true;
  }

  function meta(plan) {
    return {
      source: plan.source,
      zoom: plan.zoom,
      size: plan.pixels,
      bounds: plan.bounds,
      key: plan.key,
      requests: counts.requests,
      swaps: counts.swaps,
      errors: counts.errors,
      pending: !!pending,
    };
  }

  function stats() {
    return {
      source: residentPlan?.source ?? null,
      zoom: residentPlan?.zoom,
      size: residentPlan?.pixels ?? null,
      bounds: residentPlan?.bounds ?? null,
      key: residentKey,
      requests: counts.requests,
      swaps: counts.swaps,
      errors: counts.errors,
      pending: !!pending,
    };
  }

  // Full tile-mosaic extent for a fallback zoom, using the same
  // tileToLonLat/lonLatToXY math as planDetail: the shader maps full bounds.
  function fallbackExtent(range, z) {
    const nw = tileToLonLat(range.x0, range.y0, z);
    const se = tileToLonLat(range.x1 + 1, range.y1 + 1, z);
    const full = [nw[0], se[1], se[0], nw[1]];
    const [ax, ay] = lonLatToXY(full[0], full[1], origin);
    const [bx, by] = lonLatToXY(full[2], full[3], origin);
    const westX = Math.min(ax, bx);
    const eastX = Math.max(ax, bx);
    const northY = Math.max(ay, by);
    const southY = Math.min(ay, by);
    return {
      bounds: full,
      worldBounds: [westX, -northY, eastX - westX, northY - southY],
      pixels: [(range.x1 - range.x0 + 1) * TILE_PX, (range.y1 - range.y0 + 1) * TILE_PX],
    };
  }

  async function fetchTileBitmap(url, signal) {
    const r = await fetchImpl(url, { signal });
    if (!r.ok) throw new Error(`tile ${r.status}`);
    const blob = await r.blob();
    const img = await loadBitmap(blob);
    return img;
  }

  async function fetchKrCanvas(plan, signal) {
    const zooms = plan.zoom === 19 ? [19, 18] : [plan.zoom];
    let lastErr = null;
    for (const z of zooms) {
      const range = z === plan.zoom ? plan.range : tilesForBBox(plan.bounds, z);
      const jobs = [];
      for (let ty = range.y0; ty <= range.y1; ty++) {
        for (let tx = range.x0; tx <= range.x1; tx++) jobs.push([tx, ty]);
      }
      const doc = globalThis.document;
      if (!doc) throw new Error("no document for detail canvas");
      const canvas = doc.createElement("canvas");
      canvas.width = (range.x1 - range.x0 + 1) * TILE_PX;
      canvas.height = (range.y1 - range.y0 + 1) * TILE_PX;
      const ctx = canvas.getContext("2d");
      const lookBase = look.terrainBase;
      if (Number.isFinite(Number(lookBase))) {
        ctx.fillStyle = `#${Number(lookBase).toString(16).padStart(6, "0")}`;
      } else {
        ctx.fillStyle = "#d2c9a9";
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let ok = true;
      try {
        const workerCount = Math.max(1, Math.min(TILE_CONCURRENCY, 6));
        const settled = await Promise.allSettled(
          Array.from({ length: workerCount }, async () => {
            while (jobs.length > 0) {
              if (signal.aborted) throw new Error("aborted"); // parent abort: take no new jobs
              const job = jobs.pop();
              if (!job) break;
              const [tx, ty] = job;
              const url = apiUrl(`/api/aerial/${z}/${ty}/${tx}.jpeg`);
              const img = await fetchTileBitmap(url, signal);
              try {
                try {
                  ctx.filter = "saturate(0.9)";
                } catch {
                  // Canvas filter unsupported: draw unmodified.
                }
                ctx.drawImage(img, (tx - range.x0) * TILE_PX, (ty - range.y0) * TILE_PX);
              } finally {
                try {
                  if (typeof ctx.filter !== "undefined") ctx.filter = "none";
                } catch {
                  // ignore
                }
                try {
                  img.close?.();
                } catch {
                  // ignore
                }
              }
            }
          }),
        );
        const failed = settled.find((r) => r && r.status === "rejected");
        if (failed) throw failed.reason; // all workers finished: surface the failure
      } catch (e) {
        if (signal.aborted) throw new Error("aborted");
        lastErr = e;
        ok = false;
      }
      if (ok) {
        if (z === plan.zoom) return { canvas, zoom: z, range };
        // Fallback zoom: recompute the FULL tile-mosaic extent. The requested
        // key is kept so later updates stay stable instead of refetching.
        return { canvas, zoom: z, range, ...fallbackExtent(range, z) };
      }
      lastErr = lastErr ?? new Error("tile fetch failed");
      if (z === 19) continue; // try 18 once before giving up
      throw lastErr;
    }
    throw lastErr ?? new Error("tile fetch failed");
  }

  async function fetchUsCanvas(plan, signal) {
    const url = naipDetailUrl(plan.bounds, plan.pixels[0]);
    const r = await fetchImpl(url, { signal });
    if (!r.ok) throw new Error(`naip ${r.status}`);
    const img = await loadBitmap(await r.blob());
    const doc = globalThis.document;
    if (!doc) {
      try {
        img.close?.();
      } catch {
        // ignore
      }
      throw new Error("no document for detail canvas");
    }
    const canvas = doc.createElement("canvas");
    canvas.width = plan.pixels[0];
    canvas.height = plan.pixels[1];
    const ctx = canvas.getContext("2d");
    try {
      try {
        ctx.filter = "saturate(0.9)";
      } catch {
        // ignore
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally {
      try {
        img.close?.();
      } catch {
        // ignore
      }
    }
    return { canvas, zoom: undefined, range: undefined };
  }

  function startRequest(plan) {
    if (pending && pending.controller) {
      try {
        pending.controller.abort();
      } catch {
        // ignore
      }
    }
    seq += 1;
    const mySeq = seq;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, plan.source === "naip" ? NAIP_TIMEOUT_MS : FETCH_TIMEOUT_MS);
    pending = { key: plan.key, seq: mySeq, controller };
    counts.requests += 1;

    const done = async () => {
      try {
        if (plan.source === "naip") {
          const { canvas } = await fetchUsCanvas(plan, controller.signal);
          swapIn(plan, canvas, mySeq);
        } else {
          const res = await fetchKrCanvas(plan, controller.signal);
          // Fallback keeps the originally requested key (no refetch loop) but
          // carries the actual zoom/bounds/pixels for stats and the shader.
          const finalPlan = res.zoom === plan.zoom ? plan : {
            ...plan,
            zoom: res.zoom,
            range: res.range,
            bounds: res.bounds ?? plan.bounds,
            worldBounds: res.worldBounds ?? plan.worldBounds,
            pixels: res.pixels ?? plan.pixels,
          };
          swapIn(finalPlan, res.canvas, mySeq);
        }
      } catch {
        // Failure preserves the base map and any previous detail layer.
        if (!disposed && pending?.seq === mySeq) {
          pending = null;
          counts.errors += 1;
          lastErrorAt = lastPlanAt; // backoff from the latest planning tick
        }
      } finally {
        clearTimeout(timer);
      }
    };
    void done();
  }

  function swapIn(plan, canvas, mySeq) {
    if (disposed || pending?.seq !== mySeq || plan.key !== lastDesiredKey) {
      return false; // stale or torn down: never overwrite the live view
    }
    // Constructor failure throws to the request catch: pending clears, the
    // previous texture stays live, backoff applies.
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.generateMipmaps = true;
    try {
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    } catch {
      // keep the three.js default
    }
    tex.needsUpdate = true;
    const [westX, northZ, w, d] = plan.worldBounds;
    const old = shared.map.value;
    shared.map.value = tex;
    try {
      shared.rect.value.set(westX, northZ, westX + w, northZ + d);
    } catch {
      shared.rect.value = { x: westX, y: northZ, z: westX + w, w: northZ + d };
    }
    shared.mpp.value = plan.worldBounds[2] / canvas.width;
    shared.on.value = 1;
    // Dispose the previous detail texture only after the swap succeeds.
    // Base maps live on the materials and are never touched here.
    if (old && old !== tex) {
      try {
        old.dispose?.();
      } catch {
        // ignore
      }
    }
    pending = null;
    residentKey = plan.key;
    residentPlan = plan;
    counts.swaps += 1;
    try {
      onReady?.(meta(plan));
    } catch {
      // A metadata listener must never break the swap.
    }
    return true;
  }

  function update({ target, framedWidthM, now } = {}) {
    if (disposed || !enabled || tracked.size === 0) return;
    const t = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (t - lastPlanAt < PLAN_GAP_MS) return; // planning at most every 500 ms
    lastPlanAt = t;
    refreshBaseMpp(); // bases may land late: reread metadata here, never per frame
    let plan;
    try {
      plan = planDetail({
        target,
        framedWidthM,
        origin,
        usArea,
        maxTextureSize: effectiveCap(renderer),
      });
    } catch {
      // Invalid/overwide: the desired view is nothing; drop pending + candidate.
      lastDesiredKey = null;
      candidate = null;
      invalidatePending();
      return;
    }
    if (plan.key !== lastDesiredKey) {
      // Desired patch changed (including back to resident): the in-flight
      // fetch is stale, so cancel it now instead of swapping it in later.
      lastDesiredKey = plan.key;
      candidate = null;
      invalidatePending();
    }
    if (plan.key === residentKey) {
      candidate = null;
      return; // slow drift inside the quantized cell reuses the patch
    }
    if (pending && plan.key === pending.key) return; // same key in flight
    if (!candidate || candidate.key !== plan.key) {
      candidate = { key: plan.key, plan, firstSeen: t };
      return; // start only after the candidate key proves stable
    }
    if (t - candidate.firstSeen < STABLE_MS) return;
    if (t - lastErrorAt < RETRY_GAP_MS) return;
    const planMpp = plan.worldBounds[2] / plan.pixels[0];
    if (planMpp >= shared.minBase.value * 0.9) {
      candidate = null;
      return; // base maps already denser: detail would add nothing
    }
    startRequest(plan);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (pending?.controller) {
      try {
        pending.controller.abort();
      } catch {
        // ignore
      }
    }
    pending = null;
    candidate = null;
    const old = shared.map.value;
    shared.map.value = null;
    shared.on.value = 0;
    if (old) {
      try {
        old.dispose?.();
      } catch {
        // ignore
      }
    }
    tracked.clear();
    residentKey = null;
    residentPlan = null;
    lastDesiredKey = null;
  }

  return { register, unregister, enable, update, dispose, stats };
}

// Stage 29L1 pure helpers (no WebGL): route occlusion, beacons, dusk, follow.
export const ROUTE_OCCLUDED_OPACITY = 0.22;

export function routeMaterialsFor() {
  return {
    visible: { depthTest: true, opacity: 0.85, dashed: false },
    occluded: { depthTest: false, opacity: ROUTE_OCCLUDED_OPACITY, dashed: true, dashSize: 6, gapSize: 4 },
  };
}

export function beaconsVisible(minuteOfDay, sunsetMin, sunriseMin) {
  const m = Number(minuteOfDay);
  const sset = Number(sunsetMin);
  const srise = Number(sunriseMin);
  if (!Number.isFinite(m) || !Number.isFinite(sset) || !Number.isFinite(srise)) return false;
  if (srise <= sset) return m >= sset || m < srise;
  return m >= sset && m < srise;
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// Dusk (18:30) palette: roofs lighter than walls, roads lighter than ground,
// all four pairwise >= 0.06 apart in relative luminance. Day look untouched.
export function duskPaletteAt1830() {
  return { wall: "#46546e", roof: "#9aa5b8", road: "#6b7686", ground: "#1e242e" };
}

export function followPitchFor({ blocked, pitch, maxPitch, basePitch = 0.32, rate = 0.25 }) {
  const p = Number(pitch);
  const mx = Number(maxPitch);
  const bs = Number(basePitch);
  const r = Number(rate);
  if (!Number.isFinite(p) || !Number.isFinite(mx)) return p;
  if (blocked) {
    if (p >= mx) return mx;
    const next = p + (mx - p) * r + 0.01;
    return Math.min(mx, next);
  }
  const base = Number.isFinite(bs) ? bs : p;
  const rr = Number.isFinite(r) ? r : 0.25;
  return p + (base - p) * rr;
}

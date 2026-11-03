// Fringe extent for the ground base plane (pure, no three.js).
//
// The base plane must sit under buffered buildings: its rectangle is the
// union of the area bbox and the scene terrain grid, plus every building
// footprint ring, expanded by a fixed margin. Home and destination areas
// share this helper so neither ground sits inside its own buildings.
import { bboxToXY, lonLatToXY } from "../frame.js";

export const FRINGE_MARGIN_M = 80;

// Pure: reads bbox/origin/terrain/buildings, never mutates them.
// terrain: scene grid { x0, z0, step, nx, nz } in world metres
// (x = east, z = -north) or null for the flat fallback.
// demMin: scene meta dem.min_m or null. Returns area-local east/north
// { cx, cy, width, depth, baseY } with finite numbers only.
export function areaExtent({ bbox, origin, terrain = null, demMin = null, buildings = [], margin = FRINGE_MARGIN_M } = {}) {
  const m = Number(margin);
  const pad = Number.isFinite(m) && m >= 0 ? m : FRINGE_MARGIN_M;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const eat = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  // Terrain grid rectangle (z = -north, so the north edge is -z0).
  if (terrain) {
    const { x0, z0, step, nx, nz } = terrain;
    if ([x0, z0, step, nx, nz].every(Number.isFinite) && nx >= 1 && nz >= 1 && step > 0) {
      const ex1 = x0 + step * (nx - 1);
      const wz1 = z0 + step * (nz - 1);
      eat(x0, -wz1);
      eat(ex1, -z0);
    }
  }
  // Every building Polygon/MultiPolygon ring (lon/lat -> east/north).
  for (const b of buildings || []) {
    const g = b ? b.geometry : null;
    if (!g) continue;
    const polys = g.type === "Polygon" ? [g.coordinates]
      : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) {
      if (!Array.isArray(poly)) continue;
      for (const ring of poly) {
        if (!Array.isArray(ring)) continue;
        for (const pt of ring) {
          if (!Array.isArray(pt)) continue;
          const [x, y] = lonLatToXY(pt[0], pt[1], origin);
          eat(x, y);
        }
      }
    }
  }
  // Minimum: the bbox is always covered, even with no terrain/buildings.
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  try {
    const box = bboxToXY(bbox, origin);
    bx0 = box.minX;
    by0 = box.minY;
    bx1 = box.maxX;
    by1 = box.maxY;
  } catch {
    // bboxToXY is pure arithmetic; keep the infinite guards below.
  }
  eat(bx0, by0);
  eat(bx1, by1);
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) {
    minX = Number.isFinite(bx0) ? bx0 : 0;
    maxX = Number.isFinite(bx1) ? bx1 : 0;
    if (maxX <= minX) maxX = minX + 1;
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || maxY <= minY) {
    minY = Number.isFinite(by0) ? by0 : 0;
    maxY = Number.isFinite(by1) ? by1 : 0;
    if (maxY <= minY) maxY = minY + 1;
  }
  // The margin only grows the rectangle, so the bbox stays covered.
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  if (Number.isFinite(bx0)) minX = Math.min(minX, bx0);
  if (Number.isFinite(by0)) minY = Math.min(minY, by0);
  if (Number.isFinite(bx1)) maxX = Math.max(maxX, bx1);
  if (Number.isFinite(by1)) maxY = Math.max(maxY, by1);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    depth: maxY - minY,
    baseY: Number.isFinite(demMin) ? demMin - 1 : -0.05,
  };
}

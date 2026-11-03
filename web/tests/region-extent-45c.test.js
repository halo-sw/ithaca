// Stage 45c1: destination fringe extent (pure geometry, no WebGL/DOM).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { areaExtent, FRINGE_MARGIN_M } from "../src/scene/extent.js";
import { bboxToXY, lonLatToXY } from "../src/frame.js";

const ORIGIN = { lon: 127.1, lat: 37.4 };

// Bbox corners + terrain rect in east/north metres.
function eastNorth(lon, lat) {
  return lonLatToXY(lon, lat, ORIGIN);
}

describe("45c1 fringe extent", () => {
  it("contains a buffered building ring outside bbox and terrain extents", () => {
    const bbox = [127.0, 37.4, 127.01, 37.41];
    const terrain = { x0: -5000, z0: -5000, step: 10, nx: 101, nz: 101, dm: [] };
    // Buffered footprint ~300 m east of the bbox, outside the terrain too.
    const far = [127.03, 37.405];
    const ring = [
      [127.029, 37.404], [127.031, 37.404],
      [127.031, 37.406], [127.029, 37.406], [127.029, 37.404],
    ];
    const buildings = [{ geometry: { type: "Polygon", coordinates: [ring] } }];
    const ext = areaExtent({ bbox, origin: ORIGIN, terrain, demMin: 60, buildings });
    assert.ok(Number.isFinite(ext.cx) && Number.isFinite(ext.width));
    assert.ok(ext.width > 0 && ext.depth > 0);
    const box = bboxToXY(bbox, ORIGIN);
    // Bbox corners stay covered (margin only grows the rectangle).
    assert.ok(ext.cx - ext.width / 2 <= box.minX);
    assert.ok(ext.cx + ext.width / 2 >= box.maxX);
    assert.ok(ext.cy - ext.depth / 2 <= box.minY);
    assert.ok(ext.cy + ext.depth / 2 >= box.maxY);
    // The far buffered ring is inside the fringe.
    const [fx, fy] = eastNorth(...far);
    assert.ok(fx >= ext.cx - ext.width / 2 && fx <= ext.cx + ext.width / 2);
    assert.ok(fy >= ext.cy - ext.depth / 2 && fy <= ext.cy + ext.depth / 2);
    // Margin applied on every side (at least the 80 m pad beyond bbox).
    assert.ok(ext.cx - ext.width / 2 <= box.minX - FRINGE_MARGIN_M + 1);
  });

  it("base sits below min terrain, including negative US terrain", () => {
    const bbox = [-122.1, 36.9, -122.0, 37.0];
    const usOrigin = { lon: -122.05, lat: 36.95 };
    const neg = areaExtent({ bbox, origin: usOrigin, terrain: null, demMin: -50, buildings: [] });
    assert.equal(neg.baseY, -51);
    const flat = areaExtent({ bbox, origin: usOrigin, terrain: null, demMin: null, buildings: [] });
    assert.equal(flat.baseY, -0.05);
  });

  it("does not mutate its inputs", () => {
    const bbox = [127.0, 37.4, 127.01, 37.41];
    const terrain = { x0: 0, z0: 0, step: 5, nx: 11, nz: 11, dm: new Array(121).fill(100) };
    const buildings = [{
      geometry: {
        type: "MultiPolygon",
        coordinates: [[[[127.002, 37.402], [127.004, 37.402], [127.004, 37.404], [127.002, 37.402]]]],
      },
    }];
    const before = JSON.stringify({ bbox, terrain, buildings });
    areaExtent({ bbox, origin: ORIGIN, terrain, demMin: 10, buildings });
    assert.equal(JSON.stringify({ bbox, terrain, buildings }), before);
  });

  it("accepts Polygon and MultiPolygon rings together", () => {
    const bbox = [127.0, 37.4, 127.001, 37.401];
    const west = [[126.99, 37.4005]];
    const east = [[127.02, 37.4005]];
    const buildings = [
      { geometry: { type: "Polygon", coordinates: [[[126.99, 37.4], [126.991, 37.4], [126.991, 37.401], [126.99, 37.4]]] } },
      { geometry: { type: "MultiPolygon", coordinates: [[[[127.02, 37.4], [127.021, 37.4], [127.021, 37.401], [127.02, 37.4]]]] } },
    ];
    const ext = areaExtent({ bbox, origin: ORIGIN, terrain: null, demMin: null, buildings });
    const [wx] = eastNorth(...west[0]);
    const [ex] = eastNorth(...east[0]);
    assert.ok(ext.cx - ext.width / 2 <= wx);
    assert.ok(ext.cx + ext.width / 2 >= ex);
  });
});

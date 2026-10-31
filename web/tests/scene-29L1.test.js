// Stage 29L1: route reads on the street, beacons only at night,
// readable dusk, follow never loses the person (pure helpers, no WebGL).
import { test } from "node:test";
import assert from "node:assert/strict";
import { beaconsVisible, duskPaletteAt1830, followPitchFor,
  relativeLuminance, routeMaterialsFor } from "../src/render/scene29L1.js";

test("route draws a depth-tested pass plus a faint dashed occluded pass", () => {
  const spec = routeMaterialsFor();
  assert.equal(spec.visible.depthTest, true);
  assert.equal(spec.occluded.depthTest, false);
  assert.equal(spec.occluded.dashed, true);
  assert.ok(spec.occluded.opacity <= 0.25,
    `occluded opacity ${spec.occluded.opacity}`);
});

test("beacons hide by day, show after sunset and before sunrise", () => {
  // 08:20 with sunset 17:25 / sunrise 07:05 → daylight, hidden.
  assert.equal(beaconsVisible(8 * 60 + 20, 17 * 60 + 25, 7 * 60 + 5), false);
  assert.equal(beaconsVisible(18 * 60 + 30, 17 * 60 + 25, 7 * 60 + 5), true);
  assert.equal(beaconsVisible(5 * 60, 17 * 60 + 25, 7 * 60 + 5), true);
});

test("dusk palette keeps walls, roofs, roads and ground distinct", () => {
  const p = duskPaletteAt1830();
  const lum = {
    wall: relativeLuminance(p.wall),
    roof: relativeLuminance(p.roof),
    road: relativeLuminance(p.road),
    ground: relativeLuminance(p.ground),
  };
  const keys = Object.keys(lum);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const d = Math.abs(lum[keys[i]] - lum[keys[j]]);
      assert.ok(d >= 0.06, `${keys[i]}/${keys[j]} luminance gap ${d}`);
    }
  }
  assert.ok(lum.roof > lum.wall, "roofs lighter than walls");
  assert.ok(lum.road > lum.ground, "roads lighter than ground");
});

test("follow pitch rises while blocked, eases back when clear", () => {
  const up = followPitchFor({ blocked: true, pitch: 0.32, maxPitch: 1.1 });
  assert.ok(up > 0.32 && up <= 1.1, `raised pitch ${up}`);
  const down = followPitchFor({ blocked: false, pitch: 0.9, maxPitch: 1.1,
    basePitch: 0.32 });
  assert.ok(down < 0.9 && down >= 0.32, `eased-back pitch ${down}`);
});

// 46b: broader base mosaic within bounded desktop GPU memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { drapePlan } from "../src/aerial/drape.js";

const PANGYO = [127.10, 37.38, 127.125, 37.401];
const US8KM = [-122.20, 37.43, -122.11, 37.51];
const TILE_PX = 256;

function dims(range) {
  return [(range.x1 - range.x0 + 1) * TILE_PX, (range.y1 - range.y0 + 1) * TILE_PX];
}

test("Pangyo wide bbox at 6144/bias1 reaches >= 18", () => {
  const { zoom, range } = drapePlan(PANGYO, { usArea: false, maxMosaicPx: 6144, detailBias: 1 });
  assert.ok(zoom >= 18, `pangyo zoom ${zoom} must be >= 18`);
  const [w, h] = dims(range);
  assert.ok(w <= 6144 && h <= 6144, `mosaic ${w}x${h} exceeds 6144`);
});

test("US 8km bbox at 6144 stays at 16 (never > 16)", () => {
  const { zoom, range } = drapePlan(US8KM, { usArea: true, maxMosaicPx: 6144, detailBias: 1 });
  assert.equal(zoom, 16);
  const [w, h] = dims(range);
  assert.ok(w <= 6144 && h <= 6144, `mosaic ${w}x${h} exceeds 6144`);
});

test("default US cap 4096 remains <= 16", () => {
  const { zoom, range } = drapePlan(US8KM, { usArea: true });
  assert.ok(zoom <= 16, `zoom ${zoom} must be <= 16`);
  const [w, h] = dims(range);
  assert.ok(w <= 4096 && h <= 4096, `mosaic ${w}x${h} exceeds 4096`);
});

test("all plans respect cap; default/mobile unchanged", () => {
  for (const [b, o, cap] of [[PANGYO, { usArea: false, maxMosaicPx: 6144, detailBias: 1 }, 6144], [US8KM, { usArea: true, maxMosaicPx: 6144, detailBias: 1 }, 6144], [US8KM, { usArea: true }, 4096]]) {
    const { range } = drapePlan(b, o);
    const [w, h] = dims(range);
    assert.ok(w <= cap && h <= cap, `mosaic ${w}x${h} exceeds ${cap}`);
  }
  const a = drapePlan(US8KM, { usArea: true });
  const b = drapePlan(US8KM, { usArea: true, maxMosaicPx: 4096, detailBias: 0 });
  assert.equal(a.zoom, b.zoom);
});

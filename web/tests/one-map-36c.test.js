// Stage 36c: one map everywhere (pure helpers, no DOM / WebGL).
//
// - drapePlan(bounds): the 판교 scene extent (4 km wide) steps down from
//   z18 until the mosaic is <= 4096 px per side; the corridor c1 bounds
//   give zoom <= 15 and <= 4096 px; a 1.2 km box keeps z18; the range
//   contains every corner of the bounds.
// - createJourneyLayer(...).setManifest(m) calls the drapeCorridor hook
//   once with m.bounds, and not again for the same manifest id.
// - SimCredit (SSR): no VWorld over the beige corridor (aerial without
//   aerialCorridor during a ride); VWorld outside a ride and once the
//   corridor drape lands.
// - mapsim-view.jsx is gone.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

import { drapePlan, sceneDrapeBounds } from "../src/aerial/drape.js";
import { TILE_PX, lonLatToTile } from "../src/aerial/tiles.js";
import { createJourneyLayer } from "../src/journey-scene.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORRIDOR_C1 = [127.027608, 37.394364, 127.111157, 37.513716];
// 판교 scene extent: about 4 km wide (the old area.bbox was ~1.3 km).
const PANGYO_EXTENT = [127.09, 37.39, 127.1354, 37.42];
// 1.2 km box: about 1200 m wide at mid latitude.
const SMALL_BOX = [127.0, 37.5, 127.0136, 37.508];

function mosaicPx(range) {
  return [(range.x1 - range.x0 + 1) * TILE_PX,
    (range.y1 - range.y0 + 1) * TILE_PX];
}

function assertContainsCorners(bounds, zoom, range) {
  const [w, s, e, n] = bounds;
  for (const [lon, lat] of [[w, s], [e, s], [w, n], [e, n]]) {
    const t = lonLatToTile(lon, lat, zoom);
    assert.ok(Math.floor(t.x) >= range.x0 && Math.floor(t.x) <= range.x1,
      `corner lon ${lon} outside x range`);
    assert.ok(Math.floor(t.y) >= range.y0 && Math.floor(t.y) <= range.y1,
      `corner lat ${lat} outside y range`);
  }
}

describe("36c drapePlan", () => {
  it("판교 scene extent (4 km) steps down from 18 within 4096 px", () => {
    const { zoom, range } = drapePlan(PANGYO_EXTENT);
    assert.ok(zoom < 18, `expected a step down from 18, got ${zoom}`);
    const [px, py] = mosaicPx(range);
    assert.ok(px <= 4096 && py <= 4096, `mosaic ${px}x${py}`);
    assertContainsCorners(PANGYO_EXTENT, zoom, range);
  });

  it("corridor c1 bounds give zoom <= 15 within 4096 px", () => {
    const { zoom, range } = drapePlan(CORRIDOR_C1);
    assert.ok(zoom <= 15, `expected zoom <= 15, got ${zoom}`);
    const [px, py] = mosaicPx(range);
    assert.ok(px <= 4096 && py <= 4096, `mosaic ${px}x${py}`);
    assertContainsCorners(CORRIDOR_C1, zoom, range);
  });

  it("a 1.2 km box keeps z18", () => {
    const { zoom, range } = drapePlan(SMALL_BOX);
    assert.equal(zoom, 18);
    const [px, py] = mosaicPx(range);
    assert.ok(px <= 4096 && py <= 4096, `mosaic ${px}x${py}`);
    assertContainsCorners(SMALL_BOX, zoom, range);
  });

  it("sceneDrapeBounds never drops below area.bbox", () => {
    const area = { bbox: [127.0, 37.5, 127.02, 37.51] };
    const out = sceneDrapeBounds({ area, origin: null });
    assert.deepEqual(out, area.bbox);
    const explicit = sceneDrapeBounds({ area, bounds: CORRIDOR_C1 });
    assert.deepEqual(explicit, CORRIDOR_C1);
  });
});

describe("36c corridor drape hook", () => {
  it("setManifest calls the hook once with m.bounds", () => {
    const layer = createJourneyLayer({ add() {}, remove() {} },
      { lon: 127.07, lat: 37.45 });
    const calls = [];
    layer.drapeCorridor((bounds) => { calls.push(bounds); });
    const m = { id: "c1", bounds: [...CORRIDOR_C1], tiles: [] };
    layer.setManifest(m);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], m.bounds);
    layer.setManifest(m);
    assert.equal(calls.length, 1, "same manifest id must not re-fire");
    layer.setManifest({ id: "c2", bounds: [...CORRIDOR_C1], tiles: [] });
    assert.equal(calls.length, 2);
    layer.dispose();
  });
});

describe("36c SimCredit follows the photo (SSR, no DOM)", () => {
  let React;
  let renderToString;
  let SimCredit;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ SimCredit } = await import("../src/ui/app.jsx"));
  });

  const render = (state) => renderToString(React.createElement(SimCredit, { state }));
  const label = "간략 지도 (건물 높이 추정)";

  it("no VWorld over the beige corridor", () => {
    const html = render({ aerial: true,
      journey: { corridorLabel: label }, aerialCorridor: false });
    assert.ok(!html.includes("VWorld"), "no aerial claim without the drape");
    assert.ok(html.includes("OpenStreetMap"), "OSM always shown");
  });

  it("VWorld outside a ride once the station drape lands", () => {
    const html = render({ aerial: true, journey: null });
    assert.ok(html.includes("VWorld"), "aerial credit shown");
  });

  it("VWorld during a ride once the corridor drape lands", () => {
    const html = render({ aerial: true,
      journey: { corridorLabel: label }, aerialCorridor: true });
    assert.ok(html.includes("VWorld"), "aerial credit shown");
  });
});

describe("36c dead code is gone", () => {
  it("mapsim-view.jsx does not exist", () => {
    assert.equal(
      existsSync(join(HERE, "..", "src", "ui", "mapsim-view.jsx")), false);
  });
});

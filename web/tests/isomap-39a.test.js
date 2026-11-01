// Stage 39a — isomap shooting mode: pure helpers (query parsing with
// defaults/clamping, N×N tile stepping via the repo frame helpers) and
// the dev data dir gz fallback. No network, no browser.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { METERS_PER_DEG_LAT, xyToLonLat } from "../src/frame.js";
import { hideIsomapChrome, hideIsomapThing, isomapCameraOffset, isomapDataUrlToBuffer, isomapOrthoFrustum, isomapTileCenters, naipExportUrl, naipUvForLonLat, parseIsomapParams } from "../src/isomap.js";
import { pickDataPath, resolveDataPath } from "../vite.config.js";

describe("parseIsomapParams", () => {
  it("applies defaults (span 240, az 45, el 35, px 1024)", () => {
    const p = parseIsomapParams("isomap=1&area=st-압구정&lon=127.028&lat=37.527");
    assert.equal(p.enabled, true);
    assert.equal(p.area, "st-압구정");
    assert.equal(p.lon, 127.028);
    assert.equal(p.lat, 37.527);
    assert.equal(p.span, 240);
    assert.equal(p.az, 45);
    assert.equal(p.el, 35);
    assert.equal(p.px, 1024);
  });
  it("clamps span 60–1200, el 15–75, px 256–2048", () => {
    const lo = parseIsomapParams("span=10&el=5&px=64");
    assert.equal(lo.span, 60);
    assert.equal(lo.el, 15);
    assert.equal(lo.px, 256);
    const hi = parseIsomapParams("span=5000&el=90&px=5000");
    assert.equal(hi.span, 1200);
    assert.equal(hi.el, 75);
    assert.equal(hi.px, 2048);
    const mid = parseIsomapParams("span=300&el=50&px=512");
    assert.equal(mid.span, 300);
    assert.equal(mid.el, 50);
    assert.equal(mid.px, 512);
  });
});

describe("isomapTileCenters", () => {
  it("grid 1 is the request point itself", () => {
    const [t] = isomapTileCenters({ lon: 127, lat: 37.5, span: 240, grid: 1, overlap: 0.15 });
    assert.deepEqual([t.r, t.c, t.dx, t.dy], [0, 0, 0, 0]);
    assert.equal(t.lon, 127);
    assert.equal(t.lat, 37.5);
  });
  it("grid 2 steps by span*(1-overlap) east/north via the frame helpers", () => {
    const lon = 127;
    const lat = 37.5;
    const step = 240 * (1 - 0.15); // 204
    assert.equal(step, 204);
    const tiles = isomapTileCenters({ lon, lat, span: 240, grid: 2, overlap: 0.15 });
    assert.equal(tiles.length, 4);
    const origin = { lon, lat };
    const kx = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    for (const t of tiles) {
      const half = 0.5;
      assert.equal(t.dx, (t.c - half) * step);
      assert.equal(t.dy, (half - t.r) * step);
      // Exact frame-helper mapping, not a reimplementation.
      const [elon, elat] = xyToLonLat(t.dx, t.dy, origin);
      assert.ok(Math.abs(t.lon - elon) < 1e-12, `lon drift ${t.lon} vs ${elon}`);
      assert.ok(Math.abs(t.lat - elat) < 1e-12, `lat drift ${t.lat} vs ${elat}`);
      assert.ok(Math.abs(t.lon - (lon + t.dx / kx)) < 1e-12);
      assert.ok(Math.abs(t.lat - (lat + t.dy / METERS_PER_DEG_LAT)) < 1e-12);
    }
    // Corner tile exact numbers.
    const t00 = tiles.find((t) => t.r === 0 && t.c === 0);
    assert.deepEqual([t00.dx, t00.dy], [-102, 102]);
    assert.ok(Math.abs(t00.lat - (37.5 + 102 / 111320)) < 1e-12);
  });
});

describe("isomap camera helpers", () => {
  it("az 0 looks from the south, az 90 from the east", () => {
    const [x0, y0, z0] = isomapCameraOffset(0, 35, 3000);
    assert.ok(Math.abs(x0) < 1e-9, `x0=${x0}`);
    assert.ok(Math.abs(y0 - 3000 * Math.sin((35 * Math.PI) / 180)) < 1e-9);
    assert.ok(Math.abs(z0 - 3000 * Math.cos((35 * Math.PI) / 180)) < 1e-9);
    const [x90, , z90] = isomapCameraOffset(90, 35, 3000);
    assert.ok(Math.abs(z90) < 1e-6, `z90=${z90}`);
    assert.ok(x90 > 0, `x90=${x90}`);
  });
  it("frustum fits span metres in a square", () => {
    assert.deepEqual(isomapOrthoFrustum(240), { left: -120, right: 120, top: 120, bottom: -120 });
  });
});

describe("dev data dir gz fallback", () => {
  it("missing .json + present .json.gz resolves to the gz path", () => {
    const files = new Set(["/d/st-압구정/area.json.gz"]);
    const r = pickDataPath("/d/st-압구정/area.json", (p) => files.has(p));
    assert.deepEqual(r, { path: "/d/st-압구정/area.json.gz", gzipped: true });
  });
  it("present .json wins; missing both is null; non-json has no fallback", () => {
    assert.deepEqual(pickDataPath("/d/a.json", () => true), { path: "/d/a.json", gzipped: false });
    assert.equal(pickDataPath("/d/a.json", () => false), null);
    assert.equal(pickDataPath("/d/a.csv", () => false), null);
  });
  it("traversal still 403", () => {
    assert.throws(() => resolveDataPath("/d", "/../secret.json"), (e) => e && e.code === 403);
    assert.throws(() => resolveDataPath("/d", "/..%2Fsecret.json"), (e) => e && e.code === 403);
  });
});

describe("39a2 NAIP export (US sharp drape)", () => {
  it("builds the exact exportImage URL for a bbox", () => {
    assert.equal(
      naipExportUrl([-122.16, 37.47, -122.15, 37.48], 2048),
      "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage" +
      "?bbox=-122.16,37.47,-122.15,37.48&bboxSR=4326&imageSR=3857&size=2048,2048&format=jpg&f=image");
  });
  it("maps bbox corners to 0/1 and the centre to 0.5 (Mercator v)", () => {
    const bbox = [-122.1562, 37.4795, -122.1561, 37.4796];
    const [uSW, vSW] = naipUvForLonLat(bbox[0], bbox[1], bbox);
    const [uNE, vNE] = naipUvForLonLat(bbox[2], bbox[3], bbox);
    assert.ok(Math.abs(uSW - 0) < 1e-12, `sw u=${uSW}`);
    assert.ok(Math.abs(vSW - 1) < 1e-12, `sw v=${vSW}`);
    assert.ok(Math.abs(uNE - 1) < 1e-12, `ne u=${uNE}`);
    assert.ok(Math.abs(vNE - 0) < 1e-12, `ne v=${vNE}`);
    const [uC, vC] = naipUvForLonLat((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2, bbox);
    assert.ok(Math.abs(uC - 0.5) < 1e-9, `centre u=${uC}`);
    assert.ok(Math.abs(vC - 0.5) < 1e-6, `centre v=${vC}`);
    // North is up: v falls as latitude rises.
    const [, vS] = naipUvForLonLat(-122.15615, 37.47952, bbox);
    const [, vN] = naipUvForLonLat(-122.15615, 37.47958, bbox);
    assert.ok(vN < vS, `v north=${vN} must be under v south=${vS}`);
  });
});

describe("39a2 hideIsomapThing", () => {
  it("hides an array, skipping nulls, without throwing", () => {
    const a = { visible: true };
    const b = { visible: true };
    assert.doesNotThrow(() => hideIsomapThing([a, null, b]));
    assert.equal(a.visible, false);
    assert.equal(b.visible, false);
  });
  it("hides an object of meshes without throwing", () => {
    const o = { first: { visible: true }, second: { visible: true } };
    assert.doesNotThrow(() => hideIsomapThing(o));
    assert.equal(o.first.visible, false);
    assert.equal(o.second.visible, false);
  });
  it("hides a Group-like via traverse without throwing", () => {
    const kids = [{ visible: true }, { visible: true }];
    const group = { traverse(fn) { for (const k of kids) fn(k); } };
    assert.doesNotThrow(() => hideIsomapThing(group));
    assert.deepEqual(kids.map((k) => k.visible), [false, false]);
  });
  it("tolerates null and a single mesh without throwing", () => {
    assert.doesNotThrow(() => hideIsomapThing(null));
    assert.doesNotThrow(() => hideIsomapThing(undefined));
    const m = { visible: true };
    assert.doesNotThrow(() => hideIsomapThing(m));
    assert.equal(m.visible, false);
  });
});

describe("39a3 hideIsomapChrome (ancestor-safe)", () => {
  function fakeNode(kids = []) {
    const n = { children: kids, parentElement: null, style: {} };
    for (const k of kids) k.parentElement = n;
    return n;
  }
  it("keeps the canvas + ancestors visible, hides siblings, pins the wrapper", () => {
    const canvas = fakeNode();
    const overlay = fakeNode();
    const wrap = fakeNode([canvas, overlay]);
    const sidebar = fakeNode();
    const body = fakeNode([wrap, sidebar]);
    assert.doesNotThrow(() => hideIsomapChrome(canvas, 512));
    assert.notEqual(canvas.style.display, "none");
    assert.notEqual(wrap.style.display, "none");
    assert.notEqual(body.style.display, "none");
    assert.equal(overlay.style.display, "none");
    assert.equal(sidebar.style.display, "none");
    assert.equal(wrap.style.position, "fixed");
    assert.equal(wrap.style.inset, "0");
    assert.equal(wrap.style.width, "512px");
    assert.equal(wrap.style.height, "512px");
  });
});

describe("39a3 isomapDataUrlToBuffer", () => {
  it("round-trips bytes through a data:image/png;base64 URL", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0xff]);
    const url = `data:image/png;base64,${bytes.toString("base64")}`;
    assert.deepEqual(isomapDataUrlToBuffer(url), bytes);
  });
});

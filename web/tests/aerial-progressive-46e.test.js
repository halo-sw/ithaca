// 46e: progressive aerial base — coarse photo first, refine in background.
import { test } from "node:test";
import assert from "node:assert/strict";
import { drapeAerial, drapePlan } from "../src/aerial/drape.js";
import { drapeAreaOnce, resetAreaDrapes, forgetAreaDrape } from "../src/area-ground.js";

// Eight-kilometre US bbox [-122.20, 37.43, -122.11, 37.51] where the 6144
// desktop plan (z16) outzooms the legacy 4096 plan (z15),
// and a small one where both plans agree (no preview fetch).
const BIG = [-122.20, 37.43, -122.11, 37.51];
const SMALL = [-122.165, 37.441, -122.155, 37.449];
const US_AREA = {
  id: "us-46e", country: "US", lon: -122.16, lat: 37.445,
  center: [-122.16, 37.445], bbox: BIG,
};

function desktopRenderer() {
  return {
    capabilities: { maxTextureSize: 8192, getMaxAnisotropy: () => 4 },
    domElement: { clientWidth: 1920 },
  };
}

function fakeTHREE(textures) {
  return {
    SRGBColorSpace: "srgb",
    CanvasTexture: function (mosaic) {
      const t = { userData: {}, mosaic, disposed: false, dispose() { t.disposed = true; } };
      textures.push(t);
      return t;
    },
  };
}

function fakeMesh() {
  return {
    geometry: {
      attributes: { position: { count: 0 }, uv: { array: [], needsUpdate: false } },
      setAttribute() {},
    },
    material: { map: null, vertexColors: true, needsUpdate: false },
  };
}

function zoomOf(url) {
  const m = String(url).match(/\/tile\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

// US tiles need no status check: stub fetch + document canvas +
// createImageBitmap only. failZoom makes one zoom level 404.
function installStubs({ failZoom = null } = {}) {
  const realFetch = globalThis.fetch;
  const realDocument = globalThis.document;
  const realCib = globalThis.createImageBitmap;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (zoomOf(url) === failZoom) return { ok: false };
    return { ok: true, blob: async () => ({}) };
  };
  const ctx = { fillStyle: "", filter: "", fillRect() {}, drawImage() {} };
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
  globalThis.createImageBitmap = async () => ({ close() {} });
  return {
    urls,
    restore() {
      if (realFetch === undefined) delete globalThis.fetch;
      else globalThis.fetch = realFetch;
      if (realDocument === undefined) delete globalThis.document;
      else globalThis.document = realDocument;
      if (realCib === undefined) delete globalThis.createImageBitmap;
      else globalThis.createImageBitmap = realCib;
    },
  };
}

test("coarse preview paints first, final refines and retires it", async () => {
  const legacy = drapePlan(BIG, { usArea: true });
  const fin = drapePlan(BIG, { usArea: true, maxMosaicPx: 6144, detailBias: 1 });
  assert.ok(legacy.zoom < fin.zoom, `need split plans, got ${legacy.zoom} vs ${fin.zoom}`);
  const { urls, restore } = installStubs();
  try {
    const textures = [];
    const ground = fakeMesh();
    const previews = [];
    const r = await drapeAerial({
      THREE: fakeTHREE(textures), renderer: desktopRenderer(), scene: {},
      area: US_AREA, origin: { lon: -122.16, lat: 37.47 }, groundMesh: ground, bounds: BIG,
      onPreview: (p) => previews.push(p),
    });
    assert.equal(previews.length, 1, "exactly one coarse preview");
    assert.equal(previews[0].ok, true);
    assert.equal(previews[0].preview, true);
    assert.equal(previews[0].zoom, legacy.zoom);
    assert.equal(r.ok, true);
    assert.equal(r.zoom, fin.zoom);
    assert.equal(r.preview, undefined);
    assert.equal(ground.material.map, r.texture);
    assert.equal(previews[0].texture.disposed, true, "coarse texture retired after final swap");
    assert.deepEqual([...new Set(urls.map(zoomOf))].sort(), [legacy.zoom, fin.zoom].sort());
  } finally {
    restore();
  }
});

test("failed refine keeps the successful coarse photo", async () => {
  const legacy = drapePlan(BIG, { usArea: true });
  const fin = drapePlan(BIG, { usArea: true, maxMosaicPx: 6144, detailBias: 1 });
  assert.ok(legacy.zoom < fin.zoom, `need split plans, got ${legacy.zoom} vs ${fin.zoom}`);
  const { restore } = installStubs({ failZoom: fin.zoom });
  try {
    const textures = [];
    const ground = fakeMesh();
    const previews = [];
    const r = await drapeAerial({
      THREE: fakeTHREE(textures), renderer: desktopRenderer(), scene: {},
      area: US_AREA, origin: { lon: -122.16, lat: 37.47 }, groundMesh: ground, bounds: BIG,
      onPreview: (p) => previews.push(p),
    });
    assert.equal(previews.length, 1);
    assert.equal(r.ok, true);
    assert.equal(r.preview, true);
    assert.equal(r.zoom, legacy.zoom);
    assert.equal(ground.material.map, r.texture);
  } finally {
    restore();
  }
});

test("same plan fetches once and never previews", async () => {
  const legacy = drapePlan(SMALL, { usArea: true });
  const fin = drapePlan(SMALL, { usArea: true, maxMosaicPx: 6144, detailBias: 1 });
  assert.equal(legacy.zoom, fin.zoom, "small region must agree on one plan");
  const { urls, restore } = installStubs();
  try {
    const textures = [];
    let previews = 0;
    const r = await drapeAerial({
      THREE: fakeTHREE(textures), renderer: desktopRenderer(), scene: {},
      area: US_AREA, origin: { lon: -122.16, lat: 37.47 }, groundMesh: fakeMesh(), bounds: SMALL,
      onPreview: () => { previews += 1; },
    });
    assert.equal(r.ok, true);
    assert.equal(r.zoom, fin.zoom);
    assert.equal(previews, 0);
    assert.deepEqual([...new Set(urls.map(zoomOf))], [fin.zoom]);
  } finally {
    restore();
  }
});

test("drapeAreaOnce forwards preview then final, preserving caller onPreview", async () => {
  resetAreaDrapes();
  const order = [];
  const userSeen = [];
  const drapeFn = async (a) => {
    a.onPreview({ ok: true, preview: true, tag: "pre" });
    return { ok: true, tag: "fin" };
  };
  const r = await drapeAreaOnce({
    areaId: "p3", drapeFn,
    args: { onPreview: (p) => userSeen.push(p) },
    onOk: (id, rr) => order.push([id, rr.tag]),
  });
  assert.deepEqual(order, [["p3", "pre"], ["p3", "fin"]]);
  assert.deepEqual(userSeen.map((p) => p.tag), ["pre"]);
  assert.equal(r.tag, "fin");
});

test("evicted preview never publishes onOk", async () => {
  resetAreaDrapes();
  let captured = null;
  let release;
  const gate = new Promise((res) => { release = res; });
  const drapeFn = (a) => {
    captured = a.onPreview;
    return gate;
  };
  const seen = [];
  const p = drapeAreaOnce({
    areaId: "p2", drapeFn, args: {}, onOk: (id, r) => seen.push(r),
  });
  await new Promise((res) => setImmediate(res));
  assert.equal(typeof captured, "function", "preview callback must be injected");
  forgetAreaDrape("p2");
  captured({ ok: true, preview: true });
  assert.equal(seen.length, 0, "evicted preview must not call onOk");
  release({ ok: true });
  assert.equal((await p).ok, true);
  assert.equal(seen.length, 0);
});

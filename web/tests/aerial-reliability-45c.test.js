// 45c: reliable aerial maps — US zoom cap, no-tiles early return, drape cache.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  drapePlan,
  drapeAerial,
  drapeCorridorAerial,
  US_ZOOM_LIMIT16,
} from "../src/aerial/drape.js";
import { drapeAreaOnce, resetAreaDrapes, forgetAreaDrape, drapedAreaIds } from "../src/area-ground.js";

// Small Palo Alto bbox (~0.9 km a side) and a same-sized Seoul bbox.
const US_BBOX = [-122.165, 37.441, -122.155, 37.449];
const KR_BBOX = [127.045, 37.505, 127.055, 37.513];
const TILE_PX = 256;

test("drapePlan caps a small US bbox at 16 while the equivalent KR bbox is 18", () => {
  assert.equal(US_ZOOM_LIMIT16, 16);
  const us = drapePlan(US_BBOX, { usArea: true });
  const kr = drapePlan(KR_BBOX, { usArea: false });
  assert.ok(us.zoom <= 16, `us zoom ${us.zoom} must be <= 16`);
  assert.equal(kr.zoom, 18);
});

test("drapePlan keeps a large US mosaic within 4096px and spanning tiles", () => {
  const big = [-122.28, 37.32, -122.02, 37.58];
  const { zoom, range } = drapePlan(big, { usArea: true });
  assert.ok(zoom <= 16, `zoom ${zoom} must be <= 16`);
  const wPx = (range.x1 - range.x0 + 1) * TILE_PX;
  const hPx = (range.y1 - range.y0 + 1) * TILE_PX;
  assert.ok(wPx > 0 && hPx > 0);
  assert.ok(wPx <= 4096, `width ${wPx}px exceeds 4096`);
  assert.ok(hPx <= 4096, `height ${hPx}px exceeds 4096`);
  assert.ok(range.x0 <= range.x1 && range.y0 <= range.y1);
});

// Stub document canvas (fillRect only) and fail every fetch. US bboxes
// skip the /api/aerial/status check, so no network is needed.
function stubGlobals() {
  const realFetch = globalThis.fetch;
  const realDocument = globalThis.document;
  globalThis.fetch = async () => ({ ok: false });
  const ctx = { fillStyle: "", fillRect() {}, drawImage() {} };
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
  return () => {
    if (realFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = realFetch;
    if (realDocument === undefined) delete globalThis.document;
    else globalThis.document = realDocument;
  };
}

function throwingTHREE(counter) {
  return {
    SRGBColorSpace: "srgb",
    CanvasTexture: function () {
      counter.count += 1;
      throw new Error("texture must not be constructed on no-tiles");
    },
  };
}

const US_AREA = {
  id: "us-st-palo-alto",
  country: "US",
  lon: -122.16,
  lat: 37.445,
  center: [-122.16, 37.445],
  bbox: US_BBOX,
};

test("drapeAerial with all fetches failing touches nothing and reports no-tiles", async () => {
  const restore = stubGlobals();
  try {
    const counter = { count: 0 };
    const groundMesh = {
      geometry: { attributes: {} },
      material: { map: "OLDMAP", vertexColors: true, needsUpdate: false },
    };
    const roadMesh = {
      material: { transparent: false, opacity: 1, map: "OLDROAD", needsUpdate: false },
    };
    const r = await drapeAerial({
      THREE: throwingTHREE(counter),
      renderer: {},
      scene: {},
      area: US_AREA,
      origin: [0, 0],
      groundMesh,
      roadMeshes: [roadMesh],
      bounds: US_BBOX,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no-tiles");
    assert.equal(groundMesh.material.map, "OLDMAP");
    assert.equal(groundMesh.material.vertexColors, true);
    assert.equal(roadMesh.material.map, "OLDROAD");
    assert.equal(roadMesh.material.transparent, false);
    assert.equal(counter.count, 0);
  } finally {
    restore();
  }
});

test("drapeCorridorAerial with all fetches failing touches nothing and reports no-tiles", async () => {
  const restore = stubGlobals();
  try {
    const counter = { count: 0 };
    const groundMesh = {
      geometry: { attributes: {} },
      material: { map: "OLDMAP", needsUpdate: false },
    };
    const r = await drapeCorridorAerial({
      THREE: throwingTHREE(counter),
      renderer: {},
      groundMesh,
      bounds: US_BBOX,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no-tiles");
    assert.equal(groundMesh.material.map, "OLDMAP");
    assert.equal(counter.count, 0);
  } finally {
    restore();
  }
});

test("drapeAreaOnce shares one call across concurrent same-target callers", async () => {
  resetAreaDrapes();
  let calls = 0;
  const mesh = {};
  const drapeFn = async () => {
    calls += 1;
    await new Promise((res) => setTimeout(res, 10));
    return { ok: true };
  };
  const p1 = drapeAreaOnce({ areaId: "c1", drapeFn, args: { groundMesh: mesh } });
  const p2 = drapeAreaOnce({ areaId: "c1", drapeFn, args: { groundMesh: mesh } });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(calls, 1);
  assert.ok(r1.ok && r2.ok);
});

test("drapeAreaOnce retries after a failed target and calls onOk only on success", async () => {
  resetAreaDrapes();
  let calls = 0;
  let okCalls = 0;
  const drapeFn = async () => {
    calls += 1;
    return calls === 1 ? { ok: false, reason: "x" } : { ok: true };
  };
  const onOk = () => { okCalls += 1; };
  const r1 = await drapeAreaOnce({ areaId: "c2", drapeFn, args: {}, onOk });
  assert.equal(r1.ok, false);
  const r2 = await drapeAreaOnce({ areaId: "c2", drapeFn, args: {}, onOk });
  assert.equal(r2.ok, true);
  assert.equal(calls, 2);
  assert.equal(okCalls, 1);
});

test("drapeAreaOnce drapes again for a rebuilt mesh target with the same area id", async () => {
  resetAreaDrapes();
  let calls = 0;
  const drapeFn = async () => {
    calls += 1;
    return { ok: true, n: calls };
  };
  const r1 = await drapeAreaOnce({
    areaId: "c3", drapeFn, args: { groundMesh: { v: 1 } },
  });
  const r2 = await drapeAreaOnce({
    areaId: "c3", drapeFn, args: { groundMesh: { v: 2 } },
  });
  assert.equal(calls, 2);
  assert.equal(r2.n, 2);
  void r1;
});

test("drapeAreaOnce old failure cannot clear a newer target's promise", async () => {
  resetAreaDrapes();
  let releaseSlow;
  const slowGate = new Promise((res) => { releaseSlow = res; });
  const calls = { slow: 0, fast: 0 };
  const slowArgs = { groundMesh: { v: "slow" } };
  const fastArgs = { groundMesh: { v: "fast" } };
  const drapeFn = (a) => {
    if (a === slowArgs) {
      calls.slow += 1;
      return slowGate.then(() => ({ ok: false, reason: "stale" }));
    }
    calls.fast += 1;
    return Promise.resolve({ ok: true });
  };
  const p1 = drapeAreaOnce({ areaId: "c4", drapeFn, args: slowArgs });
  const p2 = drapeAreaOnce({ areaId: "c4", drapeFn, args: fastArgs });
  releaseSlow();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, true);
  const r3 = await drapeAreaOnce({ areaId: "c4", drapeFn, args: fastArgs });
  assert.equal(r3.ok, true);
  assert.equal(calls.fast, 1, "newer target result must stay cached");
  assert.equal(calls.slow, 1);
});

test("forgetAreaDrape stops a pending evicted target from publishing onOk", async () => {
  resetAreaDrapes();
  let release;
  const gate = new Promise((res) => { release = res; });
  let calls = 0;
  let okCalls = 0;
  const mesh = {};
  const drapeFn = () => {
    calls += 1;
    return gate.then(() => ({ ok: true }));
  };
  const onOk = () => { okCalls += 1; };
  const p = drapeAreaOnce({ areaId: "f1", drapeFn, args: { groundMesh: mesh }, onOk });
  forgetAreaDrape("f1");
  release();
  const r = await p;
  assert.equal(r.ok, true);
  assert.equal(okCalls, 0, "evicted pending result must not publish onOk");
  assert.ok(!drapedAreaIds().includes("f1"));
  const r2 = await drapeAreaOnce({
    areaId: "f1",
    drapeFn: async () => {
      calls += 1;
      return { ok: true };
    },
    args: { groundMesh: mesh },
    onOk,
  });
  assert.equal(r2.ok, true);
  assert.equal(calls, 2, "same area must drape again after forget");
  assert.equal(okCalls, 1);
});

test("forgetAreaDrape clears only the named area", async () => {
  resetAreaDrapes();
  let callsA = 0;
  let callsB = 0;
  await drapeAreaOnce({
    areaId: "fA",
    drapeFn: async () => {
      callsA += 1;
      return { ok: true };
    },
    args: {},
  });
  await drapeAreaOnce({
    areaId: "fB",
    drapeFn: async () => {
      callsB += 1;
      return { ok: true };
    },
    args: {},
  });
  forgetAreaDrape("fA");
  assert.ok(!drapedAreaIds().includes("fA"));
  assert.ok(drapedAreaIds().includes("fB"));
  await drapeAreaOnce({
    areaId: "fB",
    drapeFn: async () => {
      callsB += 1;
      return { ok: true };
    },
    args: {},
  });
  assert.equal(callsB, 1, "forgetting A must not clear B");
  await drapeAreaOnce({
    areaId: "fA",
    drapeFn: async () => {
      callsA += 1;
      return { ok: true };
    },
    args: {},
  });
  assert.equal(callsA, 2, "forgotten area must drape again");
});

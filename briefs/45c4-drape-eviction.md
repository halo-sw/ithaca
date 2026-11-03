# 45c4 — Release the new drape cache when destination meshes are evicted

Muse authors product code/tests per AGENTS.md. Small implementation, no subagents/git/network/full tests/build, no reading other briefs. Current exact source below; use it to edit immediately, no read/search calls. First tool edits. Leave all other renderer behavior unchanged.

The new target-aware cache retains mesh references. ensureSecondArea removes an old destination group after 2 slots but leaves that cache entry and aerialSecondByArea flag, retaining large terrain buffers and stale source status.

- Export forgetAreaDrape(areaId) from area-ground.js: remove that entry. Keep resetAreaDrapes and existing public functions.
- In drapeAreaOnce, invoke onOk only if this promise is still the current cache entry for that ID; an evicted or superseded pending result must not publish a success for a removed scene. Failed old promises already avoid deleting newer ones.
- Import forgetAreaDrape in main.js and call when evicting oldest destination; remove only that ID from state.aerialSecondByArea. Keep other drapes/credits. Do not dispose shared material textures in this patch.
- Add behavior tests to aerial-reliability-45c.test.js: forgetting pending target prevents onOk and removes cachedID, same area can subsequently drape again; forgetting A doesn't clear B. Existing cache/failure tests remain.
- Run node --test web/tests/aerial-reliability-45c.test.js web/tests/home-and-dest-36f.test.js web/tests/one-map-36c.test.js. At most one fix retry. Report files/counts then stop, no commit.

## Current area-ground.js
```js
// Stage 36f: one cached drape per area, shared by the home world and
// the journey's second (workplace) area. Each area drapes at most once
// (cached by area id, concurrent calls share one promise); the 4096 px
// mosaic cap lives in drapePlan (aerial/drape.js), and every area gets
// its own mosaic and bounds from drapeAerial. The drape function is
// injectable so node tests can spy on it.
import { drapeAerial } from "./aerial/drape.js";

const drapeByArea = new Map(); // areaId -> { promise, refs }

// 45c: the cache identity is the area id plus the actual mesh/scene
// targets. Calls with no mesh targets (unit spies) keep area-only
// identity via an empty refs list.
const TARGET_FIELDS = ["scene", "terrainMesh", "groundMesh", "fringeMesh"];

function targetRefs(args) {
  if (!args || typeof args !== "object") return [];
  const refs = [];
  for (const k of TARGET_FIELDS) {
    if (args[k] != null) refs.push(args[k]);
  }
  return refs;
}

function sameRefs(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function resetAreaDrapes() {
  drapeByArea.clear();
}

export function drapedAreaIds() {
  return [...drapeByArea.keys()];
}

export function drapeAreaOnce({ areaId, drapeFn = drapeAerial, args, onOk }) {
  if (!areaId) return Promise.resolve(null);
  const refs = targetRefs(args);
  const existing = drapeByArea.get(areaId);
  if (existing && sameRefs(existing.refs, refs)) return existing.promise;
  const p = Promise.resolve()
    .then(() => drapeFn(args))
    .then((r) => {
      if (r && r.ok && onOk) {
        try {
          onOk(areaId, r);
        } catch { /* a store update must not break the scene */ }
      }
      // Failed/null results leave no cache entry so a later retry can
      // drape again — but never evict a newer target's promise.
      if (!r || !r.ok) {
        const cur = drapeByArea.get(areaId);
        if (cur && cur.promise === p) drapeByArea.delete(areaId);
      }
      return r;
    })
    .catch(() => {
      const cur = drapeByArea.get(areaId);
      if (cur && cur.promise === p) drapeByArea.delete(areaId);
      return null;
    });
  drapeByArea.set(areaId, { promise: p, refs });
  return p;
}

```

## main.js current block
```js
import { drapeAreaOnce } from "./area-ground.js";
```

## main.js current block
```js
    if (areaId === run.meta.area || secondAreas.has(areaId)) return secondAreas.get(areaId) || null;
    if (secondAreas.size >= 2) {
      const oldest = secondAreas.keys().next().value;
      const slot = secondAreas.get(oldest);
      // 45c1: eviction also drops the area's night entries so the night
      // table stays bounded to the live groups' material sets.
      if (slot) {
        scene.remove(slot.group);
        for (const e of slot.nightEntries || []) {
          const i = nightMats.indexOf(e);
          if (i >= 0) nightMats.splice(i, 1);
        }
      }
      secondAreas.delete(oldest);
    }
    const label = (AREAS.find((a) => a.id === areaId) || {}).label || areaId;
    store.set({ journeyLoading: `${label} 지도 불러오는 중…` });
    try {
      const data = await fetchArea(areaId);
      let scene14b = null;
      try {
        scene14b = await fetchScene(areaId);
```

## Current test file (append tests; do not weaken)
```js
// 45c: reliable aerial maps — US zoom cap, no-tiles early return, drape cache.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  drapePlan,
  drapeAerial,
  drapeCorridorAerial,
  US_ZOOM_LIMIT16,
} from "../src/aerial/drape.js";
import { drapeAreaOnce, resetAreaDrapes } from "../src/area-ground.js";

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

```

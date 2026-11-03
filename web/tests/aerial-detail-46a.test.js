// Stage 46a tests: camera-local aerial detail (pure planning + patch + fetch).
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { planDetail, naipDetailUrl, createAerialDetail } from "../src/aerial/detail.js";

const ORIGIN_KR = { lon: 127.1, lat: 37.39 }; // Pangyo-ish
const ORIGIN_US = { lon: -122.25, lat: 37.55 }; // Menlo Park-ish

function makeRenderer(clientWidth = 1280, maxTex = 4096) {
  return {
    capabilities: {
      getMaxAnisotropy: () => 4,
      getMaxTextureSize: () => maxTex,
    },
    domElement: { clientWidth },
  };
}

function stubDocument() {
  const contexts = [];
  const stub = {
    createElement: () => {
      const canvas = { width: 0, height: 0 };
      const ctx = {
        fillStyle: "",
        filter: "none",
        fillRect() {},
        drawImage() {},
      };
      canvas.getContext = () => {
        contexts.push(ctx);
        return ctx;
      };
      return canvas;
    },
  };
  const prev = globalThis.document;
  globalThis.document = stub;
  return { contexts, restore: () => { globalThis.document = prev; } };
}

function fakeBitmap() {
  return { width: 256, height: 256, closed: false, close() { this.closed = true; } };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("planDetail US (NAIP)", () => {
  it("quantizes span to next power of two over width*1.5", () => {
    const p = planDetail({ target: { x: 0, z: 0 }, framedWidthM: 2000, origin: ORIGIN_US, usArea: true });
    assert.equal(p.span, 4096); // 2000*1.5 = 3000 -> next pow2 4096
    assert.equal(p.source, "naip");
    assert.deepEqual(p.pixels, [4000, 4000]);
    assert.equal(p.worldBounds[2], 4096);
    assert.equal(p.worldBounds[3], 4096);
  });

  it("caps US pixels and URL size at provider max 4000 (KR keeps 4096)", () => {
    const us = planDetail({ target: { x: 0, z: 0 }, framedWidthM: 2000, origin: ORIGIN_US, usArea: true, maxTextureSize: 16384 });
    assert.deepEqual(us.pixels, [4000, 4000]);
    assert.ok(us.key.includes("#4000"));
    for (const s of [4096, 8192]) {
      const u = naipDetailUrl([-122.3, 37.5, -122.2, 37.6], s);
      assert.ok(u.includes("size=4000,4000"), s + " capped");
    }
    const kr = planDetail({ target: { x: 0, z: 0 }, framedWidthM: 300, origin: ORIGIN_KR, maxTextureSize: 16384 });
    assert.ok(kr.pixels[0] <= 4096 && kr.pixels[1] <= 4096);
  });

  it("keeps the exact padded bounds and a stable key for small moves", () => {
    const a = planDetail({ target: { x: 100, z: -50 }, framedWidthM: 800, origin: ORIGIN_US, usArea: true });
    const b = planDetail({ target: { x: 110, z: -60 }, framedWidthM: 800, origin: ORIGIN_US, usArea: true });
    assert.equal(a.key, b.key); // same span/8 cell
    assert.deepEqual(a.bounds, b.bounds);
    const c = planDetail({ target: { x: 5000, z: -50 }, framedWidthM: 800, origin: ORIGIN_US, usArea: true });
    assert.notEqual(a.key, c.key); // large move replaces the patch
  });

  it("handles negative world coordinates", () => {
    const p = planDetail({ target: { x: -1500, z: 900 }, framedWidthM: 600, origin: ORIGIN_US, usArea: true });
    assert.ok(p.key.length > 0);
    const [w, s, e, n] = p.bounds;
    assert.ok(w < e && s < n);
    assert.ok(Number.isFinite(w + s + e + n));
  });

  it("respects the texture cap", () => {
    const p = planDetail({
      target: { x: 0, z: 0 }, framedWidthM: 2000, origin: ORIGIN_US, usArea: true, maxTextureSize: 1024,
    });
    assert.deepEqual(p.pixels, [1024, 1024]);
    assert.ok(p.key.includes("#1024"));
  });

  it("rejects invalid arguments", () => {
    assert.throws(() => planDetail({ target: { x: NaN, z: 0 }, framedWidthM: 500, origin: ORIGIN_US, usArea: true }));
    assert.throws(() => planDetail({ target: { x: 0, z: 0 }, framedWidthM: -3, origin: ORIGIN_US, usArea: true }));
    assert.throws(() => planDetail({ target: { x: 0, z: 0 }, framedWidthM: 500, origin: {}, usArea: true }));
  });
});

describe("planDetail KR (VWorld)", () => {
  it("picks z19 for a close view and downsteps for a wide one", () => {
    const close = planDetail({ target: { x: 0, z: 0 }, framedWidthM: 300, origin: ORIGIN_KR });
    assert.equal(close.source, "vworld");
    assert.equal(close.zoom, 19);
    const wide = planDetail({ target: { x: 0, z: 0 }, framedWidthM: 4000, origin: ORIGIN_KR });
    assert.ok(wide.zoom < 19 && wide.zoom >= 6);
    assert.ok(wide.pixels[0] <= 4096 && wide.pixels[1] <= 4096);
  });

  it("maps the full tile bounds (density fits the cap)", () => {
    const p = planDetail({ target: { x: 0, z: 0 }, framedWidthM: 600, origin: ORIGIN_KR, maxTextureSize: 2048 });
    const nx = p.range.x1 - p.range.x0 + 1;
    const ny = p.range.y1 - p.range.y0 + 1;
    assert.equal(p.pixels[0], nx * 256);
    assert.equal(p.pixels[1], ny * 256);
    assert.ok(p.pixels[0] <= 2048 && p.pixels[1] <= 2048);
  });
});

describe("naipDetailUrl", () => {
  it("uses exact bounds with adjustAspectRatio=false (never expanded)", () => {
    const url = naipDetailUrl([-122.3, 37.5, -122.2, 37.6], 2048);
    assert.ok(url.includes("bbox=-122.3,37.5,-122.2,37.6"));
    assert.ok(url.includes("bboxSR=4326"));
    assert.ok(url.includes("imageSR=3857"));
    assert.ok(url.includes("size=2048,2048"));
    assert.ok(url.includes("adjustAspectRatio=false"));
    assert.ok(url.includes("format=jpg&f=image"));
  });
});

describe("material patch", () => {
  it("chains onBeforeCompile + cache key and leaves base UVs alone", () => {
    const renderer = makeRenderer();
    const d = createAerialDetail({ THREE, renderer, origin: ORIGIN_KR });
    let prevCalled = 0;
    const mat = {
      userData: {},
      onBeforeCompile(shader) {
        prevCalled += 1;
        shader.uniforms.uPrev = { value: 1 };
      },
      customProgramCacheKey() { return "roof-fade"; },
    };
    d.register([{ material: mat }]);
    d.register([{ material: mat }]); // second register is a no-op
    const prevKey = mat.customProgramCacheKey();
    assert.equal(prevKey, "roof-fade|aerial-detail-46a");
    const shader = {
      vertexShader: "#include <common>\n#include <begin_vertex>\n",
      fragmentShader: `#include <common>\n${THREE.ShaderChunk.map_fragment}\nvoid main(){}\n`,
      uniforms: {},
    };
    mat.onBeforeCompile(shader, renderer);
    assert.equal(prevCalled, 1); // previous patch still runs
    assert.ok(shader.uniforms.uPrev);
    assert.ok(shader.uniforms.uAerialDetailMap);
    // Base map chunk preserved verbatim (UV contract unchanged).
    assert.ok(shader.fragmentShader.includes("sampledDiffuseColor = texture2D( map, vMapUv );"));
    assert.ok(shader.fragmentShader.includes("uAerialDetailMap"));
    assert.ok(shader.vertexShader.includes("modelMatrix * vec4(transformed, 1.0)"));
    d.dispose();
  });

  it("works for fringe materials with no map yet (no sampling before readiness)", () => {
    const renderer = makeRenderer();
    const d = createAerialDetail({ THREE, renderer, origin: ORIGIN_KR });
    const mat = { userData: {} };
    d.register([{ material: mat }]);
    const shader = {
      vertexShader: "void main(){}",
      fragmentShader: `#include <common>\n${THREE.ShaderChunk.map_fragment}\n`,
      uniforms: {},
    };
    mat.onBeforeCompile(shader, renderer);
    assert.equal(shader.uniforms.uAerialDetailOn.value, 0);
    assert.ok(shader.fragmentShader.includes("uAerialDetailOn > 0.5"));
    d.dispose();
  });
});

describe("fetch lifecycle (mocked, no network)", () => {
  let doc;
  beforeEach(() => { doc = stubDocument(); });
  afterEach(() => { doc.restore(); });

  function usHarness(urls) {
    const gates = [];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      const g = deferred();
      gates.push(g);
      await g.promise;
      return { ok: true, blob: async () => ({}) };
    };
    return { fetchImpl, gates };
  }

  it("US success swaps, reports metadata, shares live uniforms", async () => {
    const urls = [];
    const { fetchImpl, gates } = usHarness(urls);
    const seen = [];
    const renderer = makeRenderer();
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true, fetchImpl,
      loadBitmap: async () => fakeBitmap(),
      onReady: (m) => seen.push(m),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 600 });
    await tick();
    assert.equal(urls.length, 1);
    gates[0].resolve();
    await tick(); await tick();
    assert.ok(urls[0].includes("adjustAspectRatio=false"));
    const st = d.stats();
    assert.equal(st.requests, 1);
    assert.equal(st.swaps, 1);
    assert.equal(st.source, "naip");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].key, st.key);
    d.dispose();
  });

  it("stale results never overwrite the current view", async () => {
    const urls = [];
    const { fetchImpl, gates } = usHarness(urls);
    const renderer = makeRenderer();
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true, fetchImpl, loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 600 }); // request A
    await tick();
    assert.equal(gates.length, 1);
    d.update({ target: { x: 9000, z: 0 }, framedWidthM: 800, now: 1200 }); // candidate B
    d.update({ target: { x: 9000, z: 0 }, framedWidthM: 800, now: 1800 }); // request B
    await tick();
    assert.equal(gates.length, 2);
    gates[1].resolve(); // B lands first
    await tick(); await tick();
    const keyB = d.stats().key;
    assert.ok(keyB);
    gates[0].resolve(); // A lands late: must be ignored
    await tick(); await tick();
    assert.equal(d.stats().key, keyB);
    assert.equal(d.stats().swaps, 1);
    d.dispose();
  });

  it("failure preserves the previous layer and invalid width requests nothing", async () => {
    const renderer = makeRenderer();
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return { ok: false, status: 404 }; };
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true, fetchImpl, loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: NaN, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: NaN, now: 600 });
    assert.equal(calls, 0); // overwide/invalid: keep base, no request
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 1200 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 1800 });
    await tick(); await tick();
    assert.equal(calls, 1);
    const st = d.stats();
    assert.equal(st.swaps, 0);
    assert.equal(st.errors, 1);
    assert.equal(st.key, null);
    d.dispose();
  });

  it("dispose bounds textures: late success after dispose swaps nothing", async () => {
    const urls = [];
    const { fetchImpl, gates } = usHarness(urls);
    const renderer = makeRenderer();
    let disposedCount = 0;
    const fakeTHREE = {
      ShaderChunk: THREE.ShaderChunk,
      SRGBColorSpace: THREE.SRGBColorSpace,
      Vector4: THREE.Vector4,
      CanvasTexture: class {
        constructor(canvas) { this.image = canvas; }
        dispose() { disposedCount += 1; }
      },
    };
    const d = createAerialDetail({
      THREE: fakeTHREE, renderer, origin: ORIGIN_US, usArea: true, fetchImpl, loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 600 });
    await tick();
    d.dispose();
    gates[0].resolve();
    await tick(); await tick();
    assert.equal(d.stats().swaps, 0);
    assert.ok(disposedCount <= 1); // at most the single pending texture
  });
});

describe("46c1 detail controller finish", () => {
  let doc;
  beforeEach(() => { doc = stubDocument(); });
  afterEach(() => { doc.restore(); });

  function gatedHarness(urls) {
    const gates = [];
    const fetchImpl = async (url) => {
      urls.push(String(url));
      const g = deferred();
      gates.push(g);
      await g.promise;
      return { ok: true, blob: async () => ({}) };
    };
    return { fetchImpl, gates };
  }

  function mkShader() {
    return {
      vertexShader: "#include <common>\n#include <begin_vertex>\n",
      fragmentShader: `#include <common>\n${THREE.ShaderChunk.map_fragment}\nvoid main(){}\n`,
      uniforms: {},
    };
  }

  it("GPU512: renderer texture cap limits the export request", async () => {
    const urls = [];
    const { fetchImpl, gates } = gatedHarness(urls);
    const renderer = makeRenderer(1280, 512);
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true, fetchImpl,
      loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 600 });
    await tick();
    assert.equal(urls.length, 1);
    assert.ok(urls[0].includes("size=512,512"));
    gates[0].resolve();
    await tick(); await tick();
    assert.equal(d.stats().swaps, 1);
    d.dispose();
  });

  it("overwide framedWidthM throws RangeError and requests nothing", () => {
    assert.throws(
      () => planDetail({ target: { x: 0, z: 0 }, framedWidthM: 6000, origin: ORIGIN_US, usArea: true }),
      RangeError,
    );
    let calls = 0;
    const renderer = makeRenderer();
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true,
      fetchImpl: async () => { calls += 1; return { ok: true, blob: async () => ({}) }; },
      loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 6000, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 6000, now: 600 });
    assert.equal(calls, 0);
    assert.equal(d.stats().requests, 0);
    d.dispose();
  });

  it("lower-density detail is not requested when base aerialMpp is 0.1", async () => {
    let calls = 0;
    const renderer = makeRenderer();
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true,
      fetchImpl: async () => { calls += 1; return { ok: true, blob: async () => ({}) }; },
      loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {}, map: { userData: { aerialMpp: 0.1 } } } }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 0 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 600 });
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 1200 });
    await tick(); await tick();
    assert.equal(calls, 0);
    assert.equal(d.stats().requests, 0);
    assert.equal(d.stats().swaps, 0);
    d.dispose();
  });

  it("per-material base uniforms track each map (0.25 vs 2)", () => {
    const renderer = makeRenderer();
    let calls = 0;
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_KR,
      fetchImpl: async () => { calls += 1; return { ok: true, blob: async () => ({}) }; },
      loadBitmap: async () => fakeBitmap(),
    });
    const matA = { userData: {}, map: { userData: { aerialMpp: 0.25 } } };
    const matB = { userData: {}, map: { userData: { aerialMpp: 2 } } };
    d.register([{ material: matA }, { material: matB }]);
    d.enable();
    d.update({ target: { x: 0, z: 0 }, framedWidthM: 800, now: 0 });
    const shA = mkShader();
    const shB = mkShader();
    matA.onBeforeCompile(shA, renderer);
    matB.onBeforeCompile(shB, renderer);
    assert.equal(shA.uniforms.uAerialDetailMinBase.value, 0.25);
    assert.equal(shB.uniforms.uAerialDetailMinBase.value, 2);
    assert.notEqual(
      shA.uniforms.uAerialDetailMinBase,
      shB.uniforms.uAerialDetailMinBase,
    );
    assert.equal(calls, 0);
    d.dispose();
  });

  it("returning to resident cancels the newer pending fetch", async () => {
    const urls = [];
    const { fetchImpl, gates } = gatedHarness(urls);
    const renderer = makeRenderer();
    const d = createAerialDetail({
      THREE, renderer, origin: ORIGIN_US, usArea: true, fetchImpl,
      loadBitmap: async () => fakeBitmap(),
    });
    d.register([{ material: { userData: {} } }]);
    d.enable();
    const A = { x: 0, z: 0 };
    const B = { x: 9000, z: 0 };
    d.update({ target: A, framedWidthM: 800, now: 0 });
    d.update({ target: A, framedWidthM: 800, now: 600 }); // request A
    await tick();
    assert.equal(gates.length, 1);
    gates[0].resolve();
    await tick(); await tick();
    const keyA = d.stats().key;
    assert.ok(keyA);
    assert.equal(d.stats().swaps, 1);
    d.update({ target: B, framedWidthM: 800, now: 1200 }); // candidate B
    d.update({ target: B, framedWidthM: 800, now: 1800 }); // request B
    await tick();
    assert.equal(gates.length, 2);
    d.update({ target: A, framedWidthM: 800, now: 2400 }); // back to resident: cancel B
    gates[1].resolve(); // B lands late: must be ignored
    await tick(); await tick(); await tick();
    assert.equal(d.stats().swaps, 1);
    assert.equal(d.stats().key, keyA);
    d.update({ target: A, framedWidthM: 800, now: 3000 });
    d.update({ target: A, framedWidthM: 800, now: 3600 });
    await tick(); await tick();
    assert.equal(urls.length, 2); // no refetch of the resident patch
    d.dispose();
  });

  it("shader blends detail into sampledDiffuseColor before material multiplication", () => {
    const renderer = makeRenderer();
    const d = createAerialDetail({ THREE, renderer, origin: ORIGIN_KR });
    const mat = { userData: {} };
    d.register([{ material: mat }]);
    const shader = mkShader();
    mat.onBeforeCompile(shader, renderer);
    // Base map chunk preserved verbatim (UV contract unchanged).
    assert.ok(shader.fragmentShader.includes("sampledDiffuseColor = texture2D( map, vMapUv );"));
    const blendAt = shader.fragmentShader.indexOf("uAerialDetailMap");
    const multAt = shader.fragmentShader.indexOf("*= sampledDiffuseColor");
    assert.ok(blendAt !== -1);
    assert.ok(multAt !== -1 && blendAt < multAt);
    d.dispose();
  });

  it("KR 19→18 fallback keeps the requested key and aligns pixels", async () => {
    const canvases = [];
    const prevDoc = globalThis.document;
    globalThis.document = {
      createElement: () => {
        const canvas = { width: 0, height: 0, draws: [] };
        const ctx = {
          fillStyle: "", filter: "none", fillRect() {},
          drawImage(img, x, y) { canvas.draws.push([x, y]); },
        };
        canvas.getContext = () => ctx;
        canvases.push(canvas);
        return canvas;
      },
    };
    try {
      const urls19 = [];
      const urls18 = [];
      const seen = [];
      const fetchImpl = async (url) => {
        const u = String(url);
        const m = u.match(/\/aerial\/(19|18)\/(\d+)\/(\d+)\.jpeg/);
        assert.ok(m, `unexpected tile url ${u}`);
        if (m[1] === "19") { urls19.push(u); return { ok: false, status: 500 }; }
        urls18.push(u);
        return { ok: true, blob: async () => ({}) };
      };
      const renderer = makeRenderer();
      const d = createAerialDetail({
        THREE, renderer, origin: ORIGIN_KR, fetchImpl,
        loadBitmap: async () => fakeBitmap(),
        onReady: (m) => seen.push(m),
      });
      d.register([{ material: { userData: {} } }]);
      d.enable();
      d.update({ target: { x: 0, z: 0 }, framedWidthM: 300, now: 0 });
      d.update({ target: { x: 0, z: 0 }, framedWidthM: 300, now: 600 });
      for (let i = 0; i < 10; i++) await tick();
      assert.equal(d.stats().swaps, 1);
      assert.ok(urls19.length > 0 && urls18.length > 0);
      const st = d.stats();
      assert.ok(st.key.startsWith("vworld@19/")); // original requested key kept
      assert.equal(seen.length, 1);
      assert.equal(seen[0].key, st.key);
      if ("zoom" in seen[0]) assert.equal(seen[0].zoom, 18); // actual zoom reported
      // Extent/pixel alignment of the fallback mosaic.
      const last = canvases[canvases.length - 1];
      const xs = new Set();
      const ys = new Set();
      for (const u of urls18) {
        const m = u.match(/\/aerial\/18\/(\d+)\/(\d+)\.jpeg/);
        ys.add(Number(m[1])); xs.add(Number(m[2]));
      }
      assert.equal(last.width, xs.size * 256);
      assert.equal(last.height, ys.size * 256);
      if (seen[0].pixels) assert.deepEqual(seen[0].pixels, [last.width, last.height]);
      assert.equal(last.draws.length, urls18.length);
      for (const [x, y] of last.draws) {
        assert.ok(x >= 0 && x + 256 <= last.width && y >= 0 && y + 256 <= last.height);
      }
      // Stable afterwards: no refetch loop on the kept key.
      const n19 = urls19.length;
      const n18 = urls18.length;
      d.update({ target: { x: 0, z: 0 }, framedWidthM: 300, now: 1200 });
      d.update({ target: { x: 0, z: 0 }, framedWidthM: 300, now: 1800 });
      for (let i = 0; i < 4; i++) await tick();
      assert.equal(urls19.length, n19);
      assert.equal(urls18.length, n18);
      assert.equal(d.stats().swaps, 1);
      d.dispose();
    } finally {
      globalThis.document = prevDoc;
    }
  });
});

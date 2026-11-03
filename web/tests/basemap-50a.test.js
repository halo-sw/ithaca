// Stage 50a — per-URL basemap load state for the current visible tiles.
// node --test, no network: pure helpers from basemap.js actually used
// by chatmap.jsx, plus source pins for the render contract.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basemapTileUrl, basemapTileUrlsFor, basemapLoadStatus,
  basemapFailedUrls, applyBasemapTileEvent, pruneBasemapTileState,
  nextBasemapRetry, isBasemapTileAttemptCurrent,
  BASEMAP_TILE_TIMEOUT_MS, BASEMAP_TILE_STATE_LIMIT } from "../src/basemap.js";

const A = "https://relay.example";
const u1 = basemapTileUrl(A, 16, 1, 1);
const u2 = basemapTileUrl(A, 16, 1, 2);
const u3 = basemapTileUrl(A, 10, 0, 0);

describe("50a basemapLoadStatus: pending is not success", () => {
  it("all-pending urls are loading, never loaded", () => {
    const s = basemapLoadStatus([u1, u2], {});
    assert.equal(s.status, "loading");
    assert.equal(s.loaded, 0);
    assert.equal(s.pending, 2);
  });
  it("all-loaded urls are loaded", () => {
    const s = basemapLoadStatus([u1, u2],
      { [u1]: "loaded", [u2]: "loaded" });
    assert.equal(s.status, "loaded");
  });
  it("errors with one success are partial and the success is kept", () => {
    const s = basemapLoadStatus([u1, u2],
      { [u1]: "loaded", [u2]: "error" });
    assert.equal(s.status, "partial");
    assert.equal(s.loaded, 1);
    assert.equal(s.errors, 1);
  });
  it("all-errored urls are unavailable", () => {
    const s = basemapLoadStatus([u1, u2],
      { [u1]: "error", [u2]: "error" });
    assert.equal(s.status, "unavailable");
  });
  it("loaded underlay counts when detail fails", () => {
    const s = basemapLoadStatus([u1, u2, u3],
      { [u1]: "error", [u2]: "error", [u3]: "loaded" });
    assert.equal(s.status, "partial");
    assert.equal(s.loaded, 1);
  });
});

describe("50a retry selects only failed current urls", () => {
  it("returns exactly the errored visible urls", () => {
    const failed = basemapFailedUrls([u1, u2, u3],
      { [u1]: "loaded", [u2]: "error" });
    assert.deepEqual(failed, [u2]);
  });
  it("nextBasemapRetry clears failed, keeps successes and nonces", () => {
    const { state, nonce } = nextBasemapRetry(
      { [u1]: "loaded", [u2]: "error" }, { [u1]: 0, [u2]: 2 }, [u1, u2, u3]);
    assert.equal(state[u1], "loaded");
    assert.ok(!(u2 in state), "failed url back to pending");
    assert.equal(nonce[u1], 0);
    assert.equal(nonce[u2], 3);
    assert.ok(!(u3 in state));
  });
  it("no failures returns the same references", () => {
    const st = { [u1]: "loaded" };
    const no = {};
    const { state, nonce } = nextBasemapRetry(st, no, [u1]);
    assert.equal(state, st);
    assert.equal(nonce, no);
  });
});

describe("50a view/provider change is not contaminated", () => {
  it("errors on old urls do not affect fresh urls", () => {
    const old = { [u1]: "error", [u2]: "error" };
    const fresh = [basemapTileUrl(A, 15, 9, 9), basemapTileUrl(A, 15, 9, 10)];
    const s = basemapLoadStatus(fresh, old);
    assert.equal(s.status, "loading");
    assert.equal(s.errors, 0);
    assert.deepEqual(basemapFailedUrls(fresh, old), []);
  });
  it("usgs urls never collide with proxy urls", () => {
    const usgs = basemapTileUrl(null, 14, 1, 1, { provider: "usgs" });
    assert.ok(!usgs.includes("/api/tiles/"), "direct USGS url");
    const s = basemapLoadStatus([usgs], { [u1]: "error" });
    assert.equal(s.status, "loading");
  });
});

describe("50a event safety and bounded state", () => {
  it("duplicate events return the same reference", () => {
    const st = { [u1]: "loaded" };
    assert.equal(applyBasemapTileEvent(st, u1, "loaded"), st);
  });
  it("stale-generation events are dropped", () => {
    const st = {};
    assert.equal(applyBasemapTileEvent(st, u1, "loaded", 1, 2), st);
    assert.notEqual(applyBasemapTileEvent(st, u1, "loaded", 2, 2), st);
  });
  it("prune keeps visible urls and caps the rest", () => {
    const big = {};
    for (let i = 0; i < 500; i++) big[`https://r/x/${i}.png`] = "loaded";
    const pruned = pruneBasemapTileState(big, [u1, "https://r/x/7.png"], 10);
    assert.ok(Object.keys(pruned).length <= 10);
    assert.equal(pruned["https://r/x/7.png"], "loaded");
  });
  it("timeout is bounded (~12 s)", () => {
    assert.ok(BASEMAP_TILE_TIMEOUT_MS >= 5000
      && BASEMAP_TILE_TIMEOUT_MS <= 30000, `${BASEMAP_TILE_TIMEOUT_MS}ms`);
  });
  it("basemapTileUrlsFor builds full provider urls", () => {
    const urls = basemapTileUrlsFor(A,
      [{ z: 16, y: 1, x: 1 }, { z: 16, y: 1, x: 2 }], "vworld");
    assert.deepEqual(urls, [u1, u2]);
  });
});

describe("50a chatmap.jsx source pins", () => {
  const src = readFileSync(new URL("../src/ui/chatmap.jsx", import.meta.url), "utf8");
  it("opacity is 0.9, not language-dependent", () => {
    assert.ok(src.includes("opacity={0.9}"), "uniform opacity 0.9");
    assert.ok(!src.includes("0.45"), "no 0.45 washout");
  });
  it("mute filter is bounded to the viewBox with userSpaceOnUse", () => {
    assert.ok(src.includes('filterUnits="userSpaceOnUse"'), "userSpaceOnUse");
  });
  it("retry re-requests by remount key, without query params", () => {
    assert.ok(/tileNonce\[url\]/.test(src), "nonce remount key");
    assert.ok(!/basemapTileUrl\([^)]*\?/.test(src), "no query params");
  });
  it("basemapOn is keyed to loaded current tiles, not a lifetime count", () => {
    assert.ok(!src.includes("failCount"), "no lifetime failCount");
    assert.ok(!src.includes("failedRef"), "no lifetime failed set");
    assert.ok(/basemapOn = normalStatus\.loaded/.test(src), "loaded-keyed");
  });
  it("retry button and localized status live in the credit column", () => {
    assert.ok(src.includes("ui-chatmap-retry"), "retry button");
    assert.ok(src.includes("다시 시도"), "korean retry");
  });
});

describe("50b per-url stale event safety", () => {
  it("a retired attempt is rejected, the current one accepted", () => {
    const nonce = { [u1]: 2, [u2]: 1 };
    assert.equal(isBasemapTileAttemptCurrent(nonce, u1, 1), false);
    assert.equal(isBasemapTileAttemptCurrent(nonce, u1, 2), true);
  });
  it("a sibling url retry never invalidates this url", () => {
    const nonce = { [u1]: 1, [u2]: 1 };
    const after = nextBasemapRetry(
      { [u1]: "loaded", [u2]: "error" }, nonce, [u1, u2]);
    assert.equal(after.nonce[u1], 1, "success keeps its key");
    assert.equal(isBasemapTileAttemptCurrent(after.nonce, u1, 1), true);
    assert.equal(isBasemapTileAttemptCurrent(after.nonce, u2, 1), false);
    assert.equal(isBasemapTileAttemptCurrent(after.nonce, u2, 2), true);
  });
  it("missing nonce means first attempt (id 0)", () => {
    assert.equal(isBasemapTileAttemptCurrent({}, u3, 0), true);
    assert.equal(isBasemapTileAttemptCurrent({}, u3, 1), false);
  });
});

describe("50b retry attempt identity", () => {
  it("a second timed-out retry assigns a fresh id, never reusing the retired one", () => {
    const first = nextBasemapRetry({ [u1]: "error" }, {}, [u1]);
    assert.equal(first.nonce[u1], 1);
    assert.ok(!(u1 in first.state), "failed url back to pending");
    // Timeout flips the still-pending url back to error; retry again.
    const second = nextBasemapRetry(
      { ...first.state, [u1]: "error" }, first.nonce, [u1]);
    assert.equal(second.nonce[u1], 2);
    assert.ok(!(u1 in second.state));
    assert.equal(isBasemapTileAttemptCurrent(second.nonce, u1, 1), false);
    assert.equal(isBasemapTileAttemptCurrent(second.nonce, u1, 2), true);
  });
  it("retry bounds retained nonces like tile state", () => {
    const big = {};
    for (let i = 0; i < 500; i++) big[`https://r/x/${i}.png`] = i + 1;
    const { nonce } = nextBasemapRetry({ [u1]: "error" }, big, [u1]);
    assert.ok(Object.keys(nonce).length <= BASEMAP_TILE_STATE_LIMIT);
    assert.equal(nonce[u1], 1, "visible retried url always kept");
  });
});

describe("50b chatmap.jsx source pins", () => {
  const src = readFileSync(new URL("../src/ui/chatmap.jsx", import.meta.url), "utf8");
  it("images capture their per-url attempt and key on the full url", () => {
    assert.ok(src.includes('markTile(url, "loaded", nonce)'), "load carries attempt");
    assert.ok(src.includes('markTile(url, "error", nonce)'), "error carries attempt");
    assert.ok(src.includes("`${url}#${nonce}`"), "full-url remount key");
  });
  it("timeout restarts on the retry epoch and rejects obsolete snapshots", () => {
    assert.ok(src.includes("[visibleUrls.join(\"|\"), retryEpoch]"), "epoch dep");
    assert.ok(src.includes("epoch !== retryEpochRef.current"), "obsolete snapshot rejected");
  });
  it("status and retry elements opt out of DOM translation", () => {
    assert.ok(src.includes("ui-chatmap-basemap-status\" role=\"status\" data-no-i18n"), "status");
    assert.ok(src.includes("ui-chatmap-retry\" data-no-i18n"), "retry");
  });
  it("no leftover null placeholder before subway layers", () => {
    assert.ok(!src.includes("{null}"), "no {null}");
  });
});

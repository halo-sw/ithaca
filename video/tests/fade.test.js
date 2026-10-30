import test from "node:test";
import assert from "node:assert/strict";
import {
  appearOpacity,
  clamp01,
  riseOffset,
  sceneOpacity,
  windowOpacity,
} from "../src/fade.js";

test("scene fades in from 0 and out to 0", () => {
  const D = 360;
  assert.equal(sceneOpacity(0, D), 0);
  assert.equal(sceneOpacity(15, D), 1);
  assert.equal(sceneOpacity(180, D), 1);
  assert.equal(sceneOpacity(D - 15, D), 1);
  assert.ok(sceneOpacity(D - 1, D) < 0.1);
});

test("appear stays visible once shown", () => {
  assert.equal(appearOpacity(0, 8), 0);
  assert.equal(appearOpacity(8, 8), 0);
  assert.equal(appearOpacity(23, 8), 1);
  assert.equal(appearOpacity(999, 8), 1);
});

test("rise rests at 0 after its fade", () => {
  assert.equal(riseOffset(23, 8), 0);
  assert.ok(riseOffset(8, 8) > 0);
  assert.ok(riseOffset(8, 8) <= 24);
});

test("window opacity brackets a pill visit", () => {
  assert.equal(windowOpacity(100, 100, 220), 0);
  assert.equal(windowOpacity(112, 100, 220), 1);
  assert.equal(windowOpacity(160, 100, 220), 1);
  assert.equal(windowOpacity(220, 100, 220), 0);
});

test("clamp01 clamps", () => {
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.5), 0.5);
});

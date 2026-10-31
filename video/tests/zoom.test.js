import test from "node:test";
import assert from "node:assert/strict";
import { easeInOutCubic, zoomTarget, zoomTransform } from "../src/zoom.js";

const FPS = 30;
const BOX_W = 1707;
const BOX_H = 952;
const WIN = [{ at: 2, until: 8, rect: [0.5, 0.5, 0.5, 0.5] }];

test("outside every window returns identity", () => {
  for (const t of [0, 1.999, 8, 20]) {
    assert.deepEqual(zoomTransform(WIN, t, BOX_W, BOX_H, FPS), {
      scale: 1,
      tx: 0,
      ty: 0,
    });
  }
});

test("missing zooms returns identity", () => {
  assert.deepEqual(zoomTransform(undefined, 5, BOX_W, BOX_H, FPS), {
    scale: 1,
    tx: 0,
    ty: 0,
  });
});

test("mid-window scale and centre for rect [0.5, 0.5, 0.5, 0.5]", () => {
  assert.deepEqual(zoomTransform(WIN, 5, BOX_W, BOX_H, FPS), {
    scale: 2,
    tx: -853.5,
    ty: -476,
  });
});

test("zoomTarget fits the rect into the box", () => {
  assert.deepEqual(zoomTarget([0.5, 0.5, 0.5, 0.5], BOX_W, BOX_H), {
    scale: 2,
    tx: -853.5,
    ty: -476,
  });
});

test("easing at frame 0 of a window is identity", () => {
  assert.deepEqual(zoomTransform(WIN, 2, BOX_W, BOX_H, FPS), {
    scale: 1,
    tx: 0,
    ty: 0,
  });
});

test("easing at frame 9 of a window is half strength", () => {
  const got = zoomTransform(WIN, 2 + 9 / FPS, BOX_W, BOX_H, FPS);
  for (const [key, want] of [
    ["scale", 1.5],
    ["tx", -426.75],
    ["ty", -238],
  ]) {
    assert.ok(
      Math.abs(got[key] - want) < 1e-9,
      `${key}: got ${got[key]}, want ${want}`
    );
  }
});

test("easeInOutCubic matches Easing.inOut(Easing.cubic)", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(
    Math.abs(easeInOutCubic(0.25) - 0.0625) < 1e-12,
    `got ${easeInOutCubic(0.25)}`
  );
});

test("clamp at the edges never shows past the left/top edge", () => {
  const zooms = [{ at: 0, until: 10, rect: [0, 0, 0.2, 0.2] }];
  const got = zoomTransform(zooms, 5, BOX_W, BOX_H, FPS);
  assert.equal(got.scale, 2.5);
  assert.equal(got.tx, ((2.5 - 1) / 2) * BOX_W);
  assert.equal(got.ty, ((2.5 - 1) / 2) * BOX_H);
  // Scaled clip edges sit exactly on (never inside) the box edges.
  assert.equal(-got.scale * (BOX_W / 2) + got.tx, -BOX_W / 2);
  assert.equal(-got.scale * (BOX_H / 2) + got.ty, -BOX_H / 2);
});

test("scale is capped at 2.5", () => {
  const zooms = [{ at: 0, until: 10, rect: [0.4, 0.4, 0.1, 0.1] }];
  const got = zoomTransform(zooms, 5, BOX_W, BOX_H, FPS);
  assert.equal(got.scale, 2.5);
});

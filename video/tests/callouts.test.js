import test from "node:test";
import assert from "node:assert/strict";
import { CALLOUT_HOLD_SEC, calloutWindows } from "../src/callouts.js";

test("a lone callout stays the full 4 s", () => {
  assert.equal(CALLOUT_HOLD_SEC, 4);
  assert.deepEqual(calloutWindows([{ at: 6, text_en: "x" }], 18), [
    { at: 6, text_en: "x", until: 10 },
  ]);
});

test("a callout is cut short when the next one comes sooner", () => {
  const out = calloutWindows(
    [
      { at: 8, text_en: "a" },
      { at: 10, text_en: "b" },
    ],
    22
  );
  assert.deepEqual(
    out.map((w) => [w.at, w.until]),
    [
      [8, 10],
      [10, 14],
    ]
  );
});

test("a callout never runs past the scene end", () => {
  const out = calloutWindows([{ at: 34, text_en: "x" }], 36);
  assert.equal(out[0].until, 36);
});

test("real script callouts each get their full window", () => {
  const out = calloutWindows(
    [{ at: 10 }, { at: 22 }, { at: 34 }].map((c) => ({
      ...c,
      text_en: "x",
    })),
    45
  );
  assert.deepEqual(
    out.map((w) => w.until),
    [14, 26, 38]
  );
});

test("no callouts means no windows", () => {
  assert.deepEqual(calloutWindows([], 10), []);
  assert.deepEqual(calloutWindows(undefined, 10), []);
});

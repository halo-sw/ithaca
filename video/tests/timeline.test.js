import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  sceneToFrames,
  totalDurationInFrames,
  validateScript,
} from "../src/timeline.js";

const here = dirname(fileURLToPath(import.meta.url));
const script = JSON.parse(
  readFileSync(join(here, "../data/script.json"), "utf8")
);

test("sceneToFrames converts seconds to frames", () => {
  assert.deepEqual(sceneToFrames({ start: 12, duration: 8 }, 30), {
    from: 360,
    durationInFrames: 240,
  });
});

test("total duration is the end of the last scene", () => {
  assert.equal(totalDurationInFrames(script), 180 * 30);
});

test("real script.json has no overlaps, gaps or stray callouts", () => {
  assert.deepEqual(validateScript(script), []);
});

test("detects an overlap", () => {
  const bad = {
    fps: 30,
    scenes: [
      { id: "a", start: 0, duration: 10 },
      { id: "b", start: 9, duration: 10 },
    ],
  };
  const errors = validateScript(bad);
  assert.ok(errors.some((e) => e.includes("overlaps")));
});

test("detects a gap", () => {
  const bad = {
    fps: 30,
    scenes: [
      { id: "a", start: 0, duration: 10 },
      { id: "b", start: 11, duration: 10 },
    ],
  };
  const errors = validateScript(bad);
  assert.ok(errors.some((e) => e.includes("gap")));
});

test("detects a callout outside its scene", () => {
  for (const at of [-1, 10, 99]) {
    const bad = {
      fps: 30,
      scenes: [{ id: "a", start: 0, duration: 10, callouts: [{ at }] }],
    };
    const errors = validateScript(bad);
    assert.ok(
      errors.some((e) => e.includes("callout")),
      `at=${at} should error`
    );
  }
});

test("accepts callouts at the scene edges", () => {
  const ok = {
    fps: 30,
    scenes: [
      { id: "a", start: 0, duration: 10, callouts: [{ at: 0 }, { at: 9.9 }] },
    ],
  };
  assert.deepEqual(validateScript(ok), []);
});

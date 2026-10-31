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
  const last = script.scenes[script.scenes.length - 1];
  assert.equal(
    totalDurationInFrames(script),
    Math.round((last.start + last.duration) * script.fps)
  );
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

test("a fixture with a bad zoom produces an error", () => {
  const cases = [
    // until before at
    { at: 5, until: 3, rect: [0, 0, 0.5, 0.5] },
    // until past the scene duration
    { at: 8, until: 11, rect: [0, 0, 0.5, 0.5] },
    // negative at
    { at: -1, until: 3, rect: [0, 0, 0.5, 0.5] },
    // rect wider than the clip
    { at: 1, until: 3, rect: [0.8, 0, 0.5, 0.5] },
    // zero width
    { at: 1, until: 3, rect: [0, 0, 0, 0.5] },
    // negative height
    { at: 1, until: 3, rect: [0, 0, 0.5, -0.1] },
  ];
  for (const zoom of cases) {
    const bad = {
      fps: 30,
      scenes: [{ id: "a", start: 0, duration: 10, zooms: [zoom] }],
    };
    const errors = validateScript(bad);
    assert.ok(
      errors.some((e) => e.includes("zoom")),
      `${JSON.stringify(zoom)} should error`
    );
  }
});

test("accepts a valid zoom", () => {
  const ok = {
    fps: 30,
    scenes: [
      {
        id: "a",
        start: 0,
        duration: 10,
        zooms: [{ at: 1, until: 5, rect: [0.5, 0.5, 0.5, 0.5] }],
      },
    ],
  };
  assert.deepEqual(validateScript(ok), []);
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

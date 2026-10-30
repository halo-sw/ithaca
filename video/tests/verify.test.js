import test from "node:test";
import assert from "node:assert/strict";
import { stepAppearFrame, stepTone } from "../src/verify.js";

test("a step starting with Check: is a fail", () => {
  assert.equal(stepTone("Check: 2 must-haves missing", false), "fail");
  assert.equal(stepTone("Check: x", true), "fail");
});

test("the final non-fail step is the pass step", () => {
  assert.equal(stepTone("Pass — must 100%", true), "pass");
  assert.equal(stepTone("Report drafted", false), "normal");
  assert.equal(stepTone("Retry with the reasons", false), "normal");
});

test("real script tones: normal, fail, normal, pass", () => {
  const steps = [
    "Report drafted",
    "Check: 2 must-haves missing",
    "Retry with the reasons",
    "Pass — must 100%, weighted ≥ 0.8",
  ];
  assert.deepEqual(
    steps.map((t, i) => stepTone(t, i === steps.length - 1)),
    ["normal", "fail", "normal", "pass"]
  );
});

test("steps are evenly spaced with the first at frame 0", () => {
  const durationInFrames = 22 * 30;
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => stepAppearFrame(i, 4, durationInFrames)),
    [0, 165, 330, 495]
  );
});

// Stage 36h5: ride markers use the camera that renders the frame, and the
// train pin's dot (not the pill centre) sits on the point.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(HERE, "../src/main.js"), "utf8");
const cssSrc = readFileSync(join(HERE, "../src/style.css"), "utf8");

// Sim frame loop region: the journey-frame block that ends in renderFrame.
const loopAnchor = "const jfTrain = journeyFrame()";
const anchorIdx = mainSrc.indexOf(loopAnchor);
assert.ok(anchorIdx >= 0, "sim frame loop journey block exists");
const loopSrc = mainSrc.slice(anchorIdx, anchorIdx + 4000);

describe("sim frame order (stage 36h5)", () => {
  it("sizes and places ride markers after the camera moves, before render", () => {
    for (const token of ["journeyLayer.setTrain(",
      "journeyLayer.updateMarkerScale(", "journeyLayer.updateStationLabels("]) {
      const callIdx = loopSrc.indexOf(token);
      assert.ok(callIdx >= 0, `${token} runs in the sim frame loop`);
      const camIdx = loopSrc.indexOf("controls.update()");
      const renderIdx = loopSrc.indexOf("renderCtl.renderFrame(");
      assert.ok(camIdx >= 0 && renderIdx >= 0, "camera + render found");
      assert.ok(callIdx > camIdx, `${token} runs after controls.update()`);
      assert.ok(callIdx < renderIdx, `${token} runs before renderFrame`);
    }
  });

  it("updates station labels in every visible journey phase", () => {
    const labelIdx = loopSrc.indexOf("journeyLayer.updateStationLabels(");
    assert.ok(labelIdx >= 0, "updateStationLabels runs in the sim frame loop");
    const guard = loopSrc.slice(Math.max(0, labelIdx - 500), labelIdx);
    assert.ok(guard.includes("boarding"),
      "updateStationLabels is not gated to rising/cruise/descending only");
  });
});

describe("train pin anchor (stage 36h5)", () => {
  it("anchors the dot centre (not the pill centre) on the point", () => {
    const pinRule = cssSrc.slice(cssSrc.indexOf(".trainpin {"), cssSrc.indexOf(".trainpin {") + 300);
    assert.ok(!pinRule.includes("translate(-50%"), ".trainpin has no translate(-50% on X");
    const dotRule = cssSrc.slice(cssSrc.indexOf(".trainpin-dot {"),
      cssSrc.indexOf(".trainpin-dot {") + 300);
    const widthPx = Number(/width:\s*(\d+)px/.exec(dotRule)?.[1]);
    assert.ok(Number.isFinite(widthPx), ".trainpin-dot width found");
    const m = /translate\(\s*(-?[\d.]+px)\s*,/.exec(pinRule);
    assert.ok(m, ".trainpin X translate found");
    assert.equal(m[1], `-${widthPx / 2}px`);
  });
});

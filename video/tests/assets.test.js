import test from "node:test";
import assert from "node:assert/strict";
import { assetStatus } from "../src/assets.js";

const manifest = ["clips/01-intake.mp4", "clips/still.png"];

test("an mp4 in the manifest is a video", () => {
  assert.equal(assetStatus("clips/01-intake.mp4", manifest), "video");
});

test("a png in the manifest is an image", () => {
  assert.equal(assetStatus("clips/still.png", manifest), "image");
});

test("an asset missing from the manifest shows the placeholder", () => {
  assert.equal(assetStatus("clips/99-missing.mp4", manifest), "missing");
});

test("an empty manifest means every scene is a placeholder", () => {
  assert.equal(assetStatus("clips/01-intake.mp4", []), "missing");
});

test("a missing or empty asset path is a placeholder", () => {
  assert.equal(assetStatus(undefined, manifest), "missing");
  assert.equal(assetStatus(null, manifest), "missing");
  assert.equal(assetStatus("", manifest), "missing");
});

test("an unknown extension is a placeholder even when listed", () => {
  assert.equal(assetStatus("clips/raw.mov2", ["clips/raw.mov2"]), "missing");
  assert.equal(assetStatus("clips/noext", ["clips/noext"]), "missing");
});

test("matching is case-insensitive on the extension", () => {
  assert.equal(assetStatus("clips/A.MP4", ["clips/A.MP4"]), "video");
});

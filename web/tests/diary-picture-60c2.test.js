import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MUSE_IMAGE_ENABLED,
  DIARY_PICTURE_CAPTION,
  sceneKindOf,
  regionOf,
  postDiaryPictureWith,
} from "../src/ui/diary-picture.js";

test("sceneKindOf maps ids to kinds", () => {
  assert.equal(sceneKindOf({ id: "t000083" }), "commute");
  assert.equal(sceneKindOf({ id: "away:h1:15:1129:errand" }), "errand");
  assert.equal(sceneKindOf({ id: "away:h2:3:489:ride" }), "ride");
  assert.equal(sceneKindOf({ id: "h2:d27:0600:weekend_plan:00" }), "plan");
  assert.equal(sceneKindOf({ id: "x:y" }), null);
});

test("sceneKindOf park suffix", () => {
  assert.equal(sceneKindOf({ id: "away:h1:2:300:park" }), "park");
});

test("regionOf maps compare area", () => {
  assert.equal(regionOf({ home_a: { area: "us-menlo" } }), "us");
  assert.equal(regionOf({}), "kr");
});

test("postDiaryPictureWith maps throwing fetch to network", async () => {
  const out = await postDiaryPictureWith(
    async () => {
      throw new Error("down");
    },
    "https://example.test/api/image/diary",
    { kind: "park", minute: 1, region: "kr" },
  );
  assert.deepEqual(out, { ok: false, error: "network" });
});

test("postDiaryPictureWith maps bad JSON to upstream", async () => {
  const out = await postDiaryPictureWith(
    async () => ({
      json: async () => {
        throw new Error("bad json");
      },
    }),
    "https://example.test/api/image/diary",
    { kind: "park", minute: 1, region: "kr" },
  );
  assert.deepEqual(out, { ok: false, error: "upstream" });
});

test("postDiaryPictureWith sets the JSON header", async () => {
  let seen = null;
  await postDiaryPictureWith(
    async (url, init) => {
      seen = init;
      return { json: async () => ({ ok: true }) };
    },
    "https://example.test/api/image/diary",
    { kind: "park", minute: 1, region: "kr" },
  );
  const headers = seen?.headers || {};
  const ctype =
    typeof headers.get === "function" ? headers.get("Content-Type") : headers["Content-Type"];
  assert.equal(ctype, "application/json");
});

test("MUSE_IMAGE_ENABLED is false under node", () => {
  assert.equal(MUSE_IMAGE_ENABLED, false);
});

test("DIARY_PICTURE_CAPTION labels the illustration", () => {
  assert.equal(DIARY_PICTURE_CAPTION, "Muse Image 일러스트 · 실제 장소 사진이 아니에요");
});

test("chat.jsx wires the diary picture block", () => {
  const src = readFileSync(new URL("../src/ui/chat.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("MUSE_IMAGE_ENABLED &&") || src.includes("MUSE_IMAGE_ENABLED ?"));
  assert.ok(src.includes("DIARY_PICTURE_CAPTION"));
  assert.ok(src.includes("장면 하나 그림으로 보기"));
  assert.ok(src.includes("setDiaryPictureOff()"));
  assert.ok(src.includes("region={regionOf(data.compare)}"));
});

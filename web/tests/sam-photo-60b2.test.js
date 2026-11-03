import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SAM_PHOTO_ENABLED,
  windowsLine,
  postWindowsWith,
} from "../src/ui/windows-photo.js";

const here = dirname(fileURLToPath(import.meta.url));
const listingsSrc = readFileSync(join(here, "..", "src", "ui", "listings.jsx"), "utf8");

describe("windowsLine", () => {
  it("count 2 unionFrac 0.291", () => {
    assert.equal(
      windowsLine({ ok: true, count: 2, unionFrac: 0.291 }),
      "이 사진에서 창 2개 · 사진의 29%",
    );
  });
  it("count 0", () => {
    assert.equal(
      windowsLine({ ok: true, count: 0, unionFrac: 0 }),
      "이 사진에서 창을 찾지 못했어요.",
    );
  });
  it("null", () => {
    assert.equal(windowsLine(null), "사진을 읽지 못했어요");
  });
});

describe("postWindowsWith", () => {
  it("network error", async () => {
    const r = await postWindowsWith(async () => {
      throw new Error("down");
    }, "http://x", {});
    assert.deepEqual(r, { ok: false, error: "network" });
  });
  it("non-JSON answer", async () => {
    const r = await postWindowsWith(
      async () => ({
        json: async () => {
          throw new Error("bad json");
        },
      }),
      "http://x",
      {},
    );
    assert.equal(r.error, "upstream");
    assert.equal(r.ok, false);
  });
  it("passes JSON through and sends jpeg content type", async () => {
    let captured = null;
    const r = await postWindowsWith(
      async (url, init) => {
        captured = init;
        return { json: async () => ({ ok: true, count: 1 }) };
      },
      "http://x",
      {},
    );
    assert.deepEqual(r, { ok: true, count: 1 });
    assert.equal(captured.headers["Content-Type"], "image/jpeg");
  });
});

describe("flag", () => {
  it("SAM_PHOTO_ENABLED is false under node", () => {
    assert.equal(SAM_PHOTO_ENABLED, false);
  });
});

describe("listings.jsx source", () => {
  it("contains photo cue strings", () => {
    assert.ok(listingsSrc.includes("SAM_PHOTO_ENABLED &&"));
    assert.ok(listingsSrc.includes("사진 근거"));
    assert.ok(
      listingsSrc.includes(
        "사진 한 장 기준이에요. 방향·층·앞 건물에 따라 실제 채광은 달라요. 현장에서 확인하세요.",
      ),
    );
    assert.ok(listingsSrc.includes("사진을 읽지 못했어요"));
    assert.ok(
      listingsSrc.includes("사진은 창을 찾는 데만 쓰고 저장하지 않아요."),
    );
  });
  it("photo block has no 측정", () => {
    const start = listingsSrc.indexOf("SAM_PHOTO_ENABLED &&");
    assert.ok(start >= 0);
    const block = listingsSrc.slice(start, start + 4000);
    assert.ok(!block.includes("측정"));
  });
});

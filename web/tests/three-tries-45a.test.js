// 45a: free trial is 3 sessions a day per network, say so.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (p) => fs.readFileSync(path.join(here, p), "utf8");

describe("45a three tries a day copy", () => {
  let LANDING_TRIAL_CAPTION;
  before(async () => {
    ({ LANDING_TRIAL_CAPTION } = await import("../src/ui/no-answer-alert.js"));
  });

  it("caption names 3 a day", () => {
    assert.equal(LANDING_TRIAL_CAPTION, "무료 체험 하루 3회 · 이후 내 키");
  });

  it("sources carry no one-try copy", () => {
    for (const p of ["../src/ui/no-answer-alert.js", "../src/ui/entry-hero.jsx", "../src/ui/chat.jsx"]) {
      const s = readSrc(p);
      assert.ok(!s.includes("무료 체험 1회"), p);
      assert.ok(!s.includes("무료 체험(1회)"), p);
      assert.ok(!s.includes("한 번만 쓸 수 있어요"), p);
    }
  });
});

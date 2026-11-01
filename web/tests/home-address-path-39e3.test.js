import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const engineUrl = pathToFileUrlSafe("../src/chat/engine.js");
function pathToFileUrlSafe(rel) {
  return new URL(rel, import.meta.url).href;
}

const engine = await import(engineUrl);
const homeForScenario = engine.homeForScenario;
assert.equal(typeof homeForScenario, "function", "homeForScenario is exported");

test("homeForScenario keeps address object with road + sigungu", () => {
  const out = homeForScenario({
    id: "h1",
    name: "X",
    scene: "st-x",
    lon: 127,
    lat: 37.5,
    address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구" },
  });
  assert.deepEqual(out.address, { road: "천호대로157길 45", sigungu: "서울특별시 강동구" });
});

test("homeForScenario without address has no address key", () => {
  const out = homeForScenario({ id: "h1", name: "X", scene: "st-x", lon: 127, lat: 37.5 });
  assert.ok(!("address" in out), "no address key when candidate has none");
});

test("main.js: data-no-i18n only on home pill sub; complex sub is plain item.sub", () => {
  const src = fs.readFileSync(path.join(here, "../src/main.js"), "utf8");
  const noI18nIdx = src.indexOf('data-no-i18n');
  assert.ok(noI18nIdx !== -1, "data-no-i18n exists in main.js");
  // The data-no-i18n line must sit inside a branch that tests the home: id.
  const windowStart = Math.max(0, noI18nIdx - 600);
  const before = src.slice(windowStart, noI18nIdx);
  assert.ok(before.includes("home:"), "data-no-i18n branch tests the home: id");
  // Complex sub branch assigns item.sub without data-no-i18n.
  const plainAssign = "sub.textContent = item.sub";
  assert.ok(src.includes(plainAssign), "complex sub branch assigns item.sub");
  const plainIdx = src.indexOf(plainAssign);
  const afterPlain = src.slice(plainIdx, plainIdx + 200);
  assert.ok(!afterPlain.includes("data-no-i18n"), "complex sub branch has no data-no-i18n");
});

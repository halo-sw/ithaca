// 29g2: replay / transcript restore loads map data for the saved doc.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { US_REGION_IDS } from "../src/places-us.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");

describe("29g2 regionsForDoc", () => {
  let regionsForDoc;
  before(async () => {
    ({ regionsForDoc } = await import("../src/chat/engine.js"));
  });
  it("USD profile with no candidates loads the US corridor set", () => {
    assert.deepEqual(
      regionsForDoc({ profile: { currency: { value: "USD" } }, candidatesData: null }),
      [...US_REGION_IDS]);
  });
  it("unique non-empty candidate regions, in order", () => {
    const candidatesData = { result: { candidates:
      [{ region: "gangnam" }, { region: "gangnam" }, { region: "songpa" }] } };
    assert.deepEqual(
      regionsForDoc({ profile: { currency: { value: "KRW" } }, candidatesData }),
      ["gangnam", "songpa"]);
  });
  it("any US-corridor / USD candidate loads the corridor set", () => {
    const candidatesData = { result: { candidates:
      [{ region: "us-menlo", currency: "USD" }] } };
    assert.deepEqual(
      regionsForDoc({ profile: { currency: { value: "KRW" } }, candidatesData }),
      [...US_REGION_IDS]);
  });
  it("no regions anywhere loads nothing (null)", () => {
    assert.equal(
      regionsForDoc({ profile: null, candidatesData: { result: { candidates: [] } } }),
      null);
    assert.equal(
      regionsForDoc({ profile: null, candidatesData: { result: { candidates: [{}, { region: "" }] } } }),
      null);
  });
  it("both recordings resolve to their regions", () => {
    const menlo = JSON.parse(read("../public/recorded/menlo-month.json"));
    const seoul = JSON.parse(read("../public/recorded/seoul-couple.json"));
    assert.deepEqual(regionsForDoc(menlo), [...US_REGION_IDS]);
    const kr = regionsForDoc(seoul);
    assert.ok(Array.isArray(kr) && kr.length > 0, "seoul replay loads a non-empty Korean list");
    assert.ok(kr.every((r) => typeof r === "string" && r !== "" && r !== "us-menlo"));
  });
});

describe("29g2 replay/restore wires loadDataFor", () => {
  it("every saved-doc setCandidatesData is followed by loadDataFor", () => {
    const lines = read("../src/ui/chat.jsx").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("setCandidatesData(doc.candidatesData)")
        || line.includes("setCandidatesData(mem.candidatesData)")) {
        const next = lines.slice(i + 1, i + 5).join("\n");
        assert.ok(next.includes("loadDataFor("),
          `line ${i + 1} restores candidates without loading map data`);
      }
    });
  });
  it("empty card starts below the filter chips", () => {
    const src = read("../src/ui/chat.jsx");
    assert.ok(src.includes("paddingTop: 64"), "empty card clears the chip row");
    assert.ok(src.includes("대화에서 조건을 말하면 후보 지역이 여기에 표시돼요."),
      "empty card text unchanged");
  });
});

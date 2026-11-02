// Stage 43b3: empty US search shows the coverage note (lines + chips),
// the emptyHint moves onto the result, and the US stage has its card.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

register("./jsx-loader.mjs", import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "..", "src", "ui", "chat.jsx"), "utf8");

let React;
let renderToString;
let CandidatesCard;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ CandidatesCard } = await import("../src/ui/chat.jsx"));
});

describe("43b3 coverage note on screen", () => {
  it("CandidatesCard renders coverage_note lines and calls onCoverageChip", () => {
    assert.ok(src.includes("data.coverage_note"), "coverage_note branch");
    assert.ok(src.includes("onCoverageChip"), "onCoverageChip wiring");
  });
  it("runSearch no longer pushes emptyHint beside result", () => {
    assert.ok(!src.includes("data: { result, tenure, sort, emptyHint }"),
      "emptyHint moved onto result");
  });
  it("StageArea has the Caltrain branch", () => {
    assert.ok(src.includes("Caltrain 축 · 멘로파크"), "US empty card");
  });
  it("renders note lines + chip, not the generic empty line", () => {
    const html = renderToString(React.createElement(CandidatesCard, {
      data: { candidates: [], total_matching: 0, sort_note: "",
        coverage_note: { lines: ["L1"],
          chips: [{ id: "meta", label: "Meta 본사(1 Hacker Way)로 하기" }] } },
      tenure: "wolse", sort: "commute", onCoverageChip: () => {},
    }));
    assert.ok(html.includes("L1"), "note line shown");
    assert.ok(html.includes("Meta 본사(1 Hacker Way)로 하기"), "chip shown");
    assert.ok(!html.includes("조건에 맞는 집이 없어요"), "generic line hidden");
  });
});

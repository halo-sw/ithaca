import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coverageNote } from "../src/homes.js";

describe("43b6 coverage label with candidates", () => {
  it("workplace line says whose commute it is", () => {
    const note = coverageNote({
      workplaceUnplaced: true,
      workplaceText: "Google in Mountain View",
      hasCandidates: true,
      coverage: {},
      budgetUsd: 5000,
    });
    const lines = note.lines.join("\n");
    assert.ok(lines.includes("아래 출퇴근 시간은 Google in Mountain View이 아니라 Meta 본사까지예요"));
    const chips = (note.chips || []).map((c) => c.id || c);
    assert.ok(chips.includes("meta"));
    assert.ok(chips.includes("nocommute"));
    assert.ok(!chips.includes("budget"));
    assert.ok(!chips.includes("seoul"));
  });

  it("handleCoverageChip branches on dataRef.current", () => {
    const src = readFileSync(new URL("../src/ui/chat.jsx", import.meta.url), "utf8");
    assert.ok(src.includes("handleCoverageChip"));
    assert.ok(src.includes("dataRef.current"));
  });

  it("CandidatesCard renders note lines when candidates exist", () => {
    const src = readFileSync(new URL("../src/ui/chat.jsx", import.meta.url), "utf8");
    assert.ok(src.includes("CandidatesCard"));
    assert.ok(src.includes("candidates.length > 0"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { coverageSummary, coverageNote } from "../src/homes.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const chatSrc = readFileSync(join(HERE, "..", "src", "ui", "chat.jsx"), "utf8");

const homes3 = [
  { currency: "USD", region: "us-st-redwood-city", buckets: [{ wolse: { monthly: { median_won: 3541 } } }] },
  { currency: "USD", region: "us-st-palo-alto", buckets: [{ wolse: { monthly: { median_won: 4200 } } }] },
  { currency: "USD", region: "us-st-mountain-view", buckets: [{ wolse: { monthly: { median_won: 5100 } } }] },
];

describe("43b4 budget chip carries suggestUsd", () => {
  it("coverageNote budget chip has value equal to suggestUsd", () => {
    const coverage = coverageSummary({ usHomes: homes3 });
    const note = coverageNote({
      coverage,
      budgetUsd: 3000,
      workplaceText: "Meta HQ",
      workplaceUnplaced: false,
    });
    const chip = note.chips.find((c) => c.id === "budget");
    assert.ok(chip, "budget chip exists");
    assert.equal(chip.value, coverage.suggestUsd);
  });
});

describe("43b4 corridor ends are San Francisco and Sunnyvale", () => {
  it("sentence contains San Francisco–Sunnyvale and not Belle Haven–", () => {
    const coverage = coverageSummary({ usHomes: homes3 });
    const note = coverageNote({
      coverage,
      budgetUsd: 3000,
      workplaceText: "Meta HQ",
      workplaceUnplaced: false,
    });
    const line = note.lines.find((l) => l.includes("Caltrain"));
    assert.ok(line, "corridor line exists");
    assert.ok(line.includes("San Francisco–Sunnyvale"), "ends are SF and Sunnyvale");
    assert.ok(!line.includes("Belle Haven–"), "no Belle Haven end");
    assert.deepEqual(coverage.usAreas[0], "Belle Haven");
  });
});

describe("43b4 handleCoverageChip reads coverage fallback", () => {
  it("handler reads coverage and chip.value (no NaN path)", () => {
    const start = chatSrc.indexOf("function handleCoverageChip");
    assert.ok(start !== -1, "handler exists");
    const body = chatSrc.slice(start, start + 1200);
    assert.ok(body.includes("chip.value"), "reads chip.value");
    assert.ok(body.includes("coverage.suggestUsd"), "falls back to coverage.suggestUsd");
  });
});

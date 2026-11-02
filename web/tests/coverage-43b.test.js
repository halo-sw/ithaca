import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coverageSummary, coverageNote } from "../src/homes.js";
import { toolResultNumbers } from "../src/consult/guards.js";
import { fieldRows } from "../src/chat/engine.js";

const homes3 = [
  { currency: "USD", region: "us-st-redwood-city", buckets: [{ wolse: { monthly: { median_won: 3541 } } }] },
  { currency: "USD", region: "us-st-palo-alto", buckets: [{ wolse: { monthly: { median_won: 4200 } } }] },
  { currency: "USD", region: "us-st-mountain-view", buckets: [{ wolse: { monthly: { median_won: 5100 } } }] },
];

describe("coverageSummary", () => {
  it("summarizes US coverage", () => {
    const c = coverageSummary({ usHomes: homes3 });
    assert.equal(c.usAreas.length, 8);
    assert.equal(c.minMonthlyUsd, 3541);
    assert.equal(c.minMonthlyArea, "Redwood City");
    assert.equal(c.suggestUsd, 3600);
  });
});

describe("coverageNote", () => {
  it("unplaced + tight budget gives 2 lines and 4 chips", () => {
    const coverage = coverageSummary({ usHomes: homes3 });
    const note = coverageNote({
      coverage,
      budgetUsd: 3500,
      workplaceText: "Google in Mountain View",
      workplaceUnplaced: true,
    });
    assert.equal(note.lines.length, 2);
    assert.ok(note.lines[0].includes("Google in Mountain View"));
    assert.deepEqual(note.chips.map((c) => c.id), ["meta", "nocommute", "budget", "seoul"]);
  });
  it("placed + enough budget gives empty", () => {
    const coverage = coverageSummary({ usHomes: homes3 });
    const note = coverageNote({
      coverage,
      budgetUsd: 5000,
      workplaceText: "Meta HQ",
      workplaceUnplaced: false,
    });
    assert.deepEqual(note, { lines: [], chips: [] });
  });
});

describe("toolResultNumbers accepts coverage numbers", () => {
  it("contains 3541 and 3600", () => {
    const coverage = coverageSummary({ usHomes: homes3 });
    const coverage_note = coverageNote({
      coverage,
      budgetUsd: 3500,
      workplaceText: "Google in Mountain View",
      workplaceUnplaced: true,
    });
    const nums = toolResultNumbers([{ coverage, coverage_note }]);
    assert.ok(nums.has(3541));
    assert.ok(nums.has(3600));
  });
});

describe("profile workplace line", () => {
  it("USD profile without resolved workplace says commute not computed", () => {
    const rows = fieldRows({
      currency: { value: "USD" },
      workplaces: { value: [{ text: "Google in Mountain View" }] },
    });
    const row = rows.find((r) => r.key === "workplaces");
    assert.ok(row.text.includes("출퇴근 계산 안 됨"));
    assert.ok(!row.text.includes("(모름)"));
  });
});

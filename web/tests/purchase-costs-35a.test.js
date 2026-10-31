import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acquisitionTaxRatePct,
  purchaseCosts,
  brokerageCapWon,
} from "../src/money/purchase.js";
import { tenureCost, amortisedMonthly } from "../src/money/tenure.js";

const byKey = (items, key) => items.find((it) => it.key === key);

describe("purchase costs 35a: acquisition tax rate", () => {
  it("band rates", () => {
    assert.equal(acquisitionTaxRatePct(500000000), 1);
    assert.equal(acquisitionTaxRatePct(600000000), 1);
    assert.equal(acquisitionTaxRatePct(750000000), 2);
    assert.equal(acquisitionTaxRatePct(900000000), 3);
    assert.equal(acquisitionTaxRatePct(1200000000), 3);
  });
  it("6.5억 rounds to 4 decimals", () => {
    assert.equal(acquisitionTaxRatePct(650000000), 1.3333);
  });
});

describe("purchase costs 35a: worked examples", () => {
  it("7억 5천만 at 84㎡", () => {
    const r = purchaseCosts({ price_won: 750000000, area_m2: 84 });
    assert.equal(byKey(r.items, "acquisition_tax").won, 15000000);
    assert.equal(byKey(r.items, "education_tax").won, 1500000);
    assert.equal(byKey(r.items, "rural_tax"), undefined);
    const b = byKey(r.items, "brokerage_cap");
    assert.equal(b.won, 3000000);
    assert.equal(b.rate_pct, 0.4);
    assert.equal(r.total_won, 19500000);
  });
  it("12억 at 101㎡", () => {
    const r = purchaseCosts({ price_won: 1200000000, area_m2: 101 });
    assert.equal(byKey(r.items, "acquisition_tax").won, 36000000);
    assert.equal(byKey(r.items, "education_tax").won, 3600000);
    assert.equal(byKey(r.items, "rural_tax").won, 2400000);
    const b = byKey(r.items, "brokerage_cap");
    assert.equal(b.won, 7200000);
    assert.equal(b.rate_pct, 0.6);
  });
});

describe("purchase costs 35a: brokerage limits", () => {
  it("caps apply", () => {
    assert.equal(brokerageCapWon(150000000), 750000);
    assert.equal(brokerageCapWon(40000000), 240000);
    assert.equal(brokerageCapWon(190000000), 800000);
  });
});

describe("purchase costs 35a: unknown area", () => {
  it("leaves out rural tax and notes it", () => {
    const r = purchaseCosts({ price_won: 750000000 });
    assert.equal(byKey(r.items, "rural_tax"), undefined);
    assert.ok(r.notes.some((n) => n.includes("85㎡")));
  });
});

describe("purchase costs 35a: tenureCost 매매", () => {
  it("cash pays one-off first; loan amortises the rest", () => {
    const r = tenureCost({ tenure: "매매", price_won: 900000000, cash_won: 300000000,
      area_m2: 84, loan_rate_pct: 4, loan_years: 30 });
    assert.equal(r.breakdown.one_off_total_won, 27000000 + 2700000 + 4500000);
    assert.equal(r.loan_won, 900000000 + 34200000 - 300000000);
    assert.equal(r.monthly_won, amortisedMonthly(634200000, 4, 30));
    assert.equal(r.breakdown.one_off_items.length, 3);
    assert.equal(r.breakdown.loan_share_pct, Math.round((634200000 / 900000000) * 100));
  });
});

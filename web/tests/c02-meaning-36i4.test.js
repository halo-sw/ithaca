// Stage 36i4: C02 meaning follows tenure; romanize keeps capitals after →.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { reportDigest } from "../src/verify/compare.js";
import { verifyHomeFor } from "../src/chat/custom-money.js";
import { romanize } from "../src/i18n/romanize.js";
import { REPORT_PROMPT, REPORT_PROMPT_EN } from "../src/consult/report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));

function tinyRun() {
  return {
    meta: { start_date: "2026-11-01", area: "seoul-x" },
    agents: [{ key: "h1", household: true }],
    trips: [],
    aways: [],
    decisions: [],
  };
}

const BASE_HOME = { monthly_won: 500000, maintenance_won_month: 100000,
  utilities_won_month: 50000 };

function c02Of(home) {
  const digest = reportDigest({ runs: { A: tinyRun() }, labels: ["A"],
    homes: { A: home }, persona: "newlywed_couple", groundTruth: GT });
  return digest.items.find((it) => it.id === "C02").values.A;
}

describe("36i4 C02 meaning follows tenure", () => {
  it("trade homes read loan payment, never rent", () => {
    const v = c02Of({ ...BASE_HOME, tenure: "trade" });
    assert.ok(v.meaning_ko.includes("대출 상환"));
    assert.ok(!v.meaning_ko.includes("월세"));
    assert.ok(v.meaning_en.includes("loan payment"));
    assert.ok(!v.meaning_en.includes("rent"));
  });
  it("jeonse homes say jeonse has no monthly rent", () => {
    const v = c02Of({ ...BASE_HOME, tenure: "jeonse" });
    assert.ok(v.meaning_ko.includes("전세는 월세 없음"));
  });
  it("wolse homes read rent", () => {
    const v = c02Of({ ...BASE_HOME, tenure: "wolse" });
    assert.ok(v.meaning_ko.includes("월세"));
  });
  it("USD homes keep the ZIP-rent meaning", () => {
    const v = c02Of({ monthly_won: 4000, currency: "USD" });
    assert.match(v.meaning_ko, /ZIP 평균 월세/);
    assert.match(v.meaning_en, /no fees/);
  });
  it("unknown tenure never says 월세", () => {
    const v = c02Of({ ...BASE_HOME });
    assert.ok(!v.meaning_ko.includes("월세"));
    assert.ok(v.meaning_ko.includes("관리비·공과금"));
  });
});

describe("36i4 REPORT_PROMPT states the C02 wording rule", () => {
  it("bans 월세 for purchases in both languages", () => {
    assert.ok(REPORT_PROMPT.includes("매매 집에 '월세'라고 쓰지 않는다"));
    assert.ok(REPORT_PROMPT_EN.includes('never call a purchase "rent"'));
  });
});

describe("36i5 verifyHomeFor carries tenure", () => {
  it("returns tenure trade from default_tenure", () => {
    const moneyDoc = {
      default_tenure: { A: "매매" },
      homes: { A: { by_tenure: { 매매: { housing: { monthly_won: 500000 } } } } },
    };
    assert.equal(verifyHomeFor(moneyDoc, "A").tenure, "trade");
  });
  it("reportDigest fed that home reads loan payment", () => {
    const moneyDoc = {
      default_tenure: { A: "매매" },
      homes: { A: { by_tenure: { 매매: { housing: { monthly_won: 500000 } } } } },
    };
    const v = c02Of(verifyHomeFor(moneyDoc, "A"));
    assert.ok(v.meaning_ko.includes("대출 상환"));
  });
});

describe("36i4 romanize keeps capitals after →", () => {
  it("romanizes each arrow segment", () => {
    assert.equal(romanize("남한산성입구→모란"), "Namhansanseongipgu→Moran");
  });
  it("capitalizes the name after the arrow", () => {
    const after = romanize("석촌→복정").split("→")[1];
    assert.ok(after[0] === after[0].toUpperCase());
  });
});

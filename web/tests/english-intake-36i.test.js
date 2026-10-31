// Stage 36i — an English buyer's first message reads right, both
// salaries count, and English mode never shows the Korean fallback.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./jsx-loader.mjs", import.meta.url);
import { extract_profile } from "../src/profile.js";
import { moneyMembersFromProfile } from "../src/chat/custom-money.js";
import { numbersOnlyAnswer } from "../src/consult/guards.js";

const EN = "We are an engaged couple and we both work in Pangyo. Our salaries are ₩60M and ₩50M, and we have ₩200M saved. We want to buy a home of 50 m² or more for ₩700M or less.";
const KO = "판교로 출근하는 맞벌이 예비부부예요. 연봉은 6천, 5천이고 모은 돈은 2억이에요. 7억 이하로 50㎡ 이상 집을 사고 싶어요.";
const PARTNER = "My salary is ₩60M and my partner earns ₩50M. We have ₩200M saved and want to buy a 50 sqm home under ₩700M.";

describe("36i English first message", () => {
  it("reads price, size, cash, both salaries, trade tenure", () => {
    const { profile } = extract_profile(EN);
    assert.equal(profile.priceMax.value, 700000000);
    assert.ok(String(profile.priceMax.evidence).includes("₩700M"));
    assert.equal(profile.sizeMin.value, 50);
    assert.equal(profile.cash.value, 200000000);
    assert.deepEqual(profile.salaryAnnual.value, [60000000, 50000000]);
    assert.equal(profile.tenure.value, "trade");
  });

  it("Korean salary list gives both salaries plus price/cash/size", () => {
    const { profile } = extract_profile(KO);
    assert.deepEqual(profile.salaryAnnual.value, [60000000, 50000000]);
    assert.equal(profile.priceMax.value, 700000000);
    assert.equal(profile.cash.value, 200000000);
    assert.equal(profile.sizeMin.value, 50);
  });

  it("partner anchor sets the second salary", () => {
    const { profile } = extract_profile(PARTNER);
    assert.deepEqual(profile.salaryAnnual.value, [60000000, 50000000]);
    assert.equal(profile.priceMax.value, 700000000);
  });

  it("area is never money", () => {
    const a = extract_profile("a 59 m2 flat, budget ₩600M").profile;
    assert.equal(a.priceMax.value, 600000000);
    assert.notEqual(a.priceMax.value, 59000000);
    const b = extract_profile("84 m² under 900M won").profile;
    assert.equal(b.priceMax.value, 900000000);
    assert.notEqual(b.priceMax.value, 84000000);
  });

  it("single salary keeps one amount", () => {
    const { profile } = extract_profile("연봉 4천, 모은 돈 1억, 4억 이하 집 사고 싶어");
    assert.deepEqual(profile.salaryAnnual.value, [40000000]);
    assert.equal(profile.priceMax.value, 400000000);
  });

  it("moneyMembersFromProfile maps one salary per member", () => {
    const out = moneyMembersFromProfile(
      { salaryAnnual: { value: [60000000, 50000000] }, takehomeMonthly: { value: null } },
      [{ id: "m1" }, { id: "m2" }]);
    assert.equal(out.m1.annual_salary_won, 60000000);
    assert.equal(out.m2.annual_salary_won, 50000000);
  });
});

describe("36i fallback wording", () => {
  it("English numbers-only has no Hangul", () => {
    const out = numbersOnlyAnswer([], { lang: "en" });
    assert.ok(!/[\uac00-\ud7a3]/.test(out), out);
    assert.ok(out.includes("couldn't finish"));
  });

  it("English bullets use English labels", () => {
    const out = numbersOnlyAnswer(
      [{ reference: { trade: { median: 700000000, p25: 650000000, p75: 750000000, count: 5 } },
        complex: "X", area_m2: 59 }], { lang: "en" });
    assert.ok(out.includes("purchase"), out);
    assert.ok(out.includes("5 deals"), out);
    assert.ok(out.includes("real deals"), out);
    for (const ko of ["매매", "전세", "건", "실거래", "그래프", "가정값", "합계"]) {
      assert.ok(!out.includes(ko), `${ko}: ${out}`);
    }
  });

  it("Korean default avoids plain-form wording", () => {
    const out = numbersOnlyAnswer([]);
    assert.ok(!out.includes("넘었다"), out);
    assert.ok(!out.includes("합니다"), out);
  });

  it("agent.js has no round-limit Korean line", () => {
    const src = readFileSync(new URL("../src/consult/agent.js", import.meta.url), "utf8");
    assert.ok(!src.includes("라운드를 넘었다"));
  });
});

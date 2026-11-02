// Stage 41l — Korean workplace/salary sentences read right; pins say
// "출근" only for a real door-to-door commute. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

import { extract_profile, guardProfileValues } from "../src/profile.js";
import { tagCommuteLine, tagLines } from "../src/chatmap.js";

let pinAriaLabel;
let legendItems;
before(async () => {
  ({ pinAriaLabel, legendItems } = await import("../src/ui/chatmap.jsx"));
});

const KO = "판교에서 둘 다 일하는 예비부부예요. 연봉은 6천만 원, 5천만 원이고 모은 돈은 2억 원이에요. 7억 원 이하로 50㎡ 이상 집을 사고 싶어요.";
const EN = "We are an engaged couple, both working in Pangyo. Salaries 60M and 50M won, 200M won saved.";
const STATIONS = ["판교", "강남"];

describe("41l Korean demo sentence", () => {
  it("workplace 판교, salaries 60M/50M, cash 200M, cap 700M, 50㎡", () => {
    const r = extract_profile(KO, null, { stations: STATIONS });
    assert.deepEqual(guardProfileValues(r.profile, KO), []);
    const wps = r.profile.workplaces.value;
    assert.ok(Array.isArray(wps) && wps.length >= 1, "a workplace is read");
    assert.ok(wps.some((w) => (w.resolved && w.resolved.station) === "판교"
      || String(w.text).includes("판교")), JSON.stringify(wps));
    assert.deepEqual(r.profile.salaryAnnual.value, [60000000, 50000000]);
    assert.equal(r.profile.cash.value, 200000000);
    assert.equal(r.profile.priceMax.value, 700000000);
    assert.equal(r.profile.sizeMin.value, 50);
  });
});

describe("41l English savings never leak into salary", () => {
  it("salaries 60M/50M, cash 200M", () => {
    const r = extract_profile(EN, null, { stations: STATIONS });
    assert.deepEqual(r.profile.salaryAnnual.value, [60000000, 50000000]);
    assert.equal(r.profile.cash.value, 200000000);
  });
});

describe("41l Korean workplace forms", () => {
  for (const s of ["둘 다 판교로 출근하는 부부예요", "판교에서 근무해요", "직장은 판교예요"]) {
    it(`${s} → 판교`, () => {
      const r = extract_profile(s, null, { stations: STATIONS });
      const wps = r.profile.workplaces.value || [];
      assert.ok(wps.some((w) => (w.resolved && w.resolved.station) === "판교"),
        `${s}: ${JSON.stringify(wps)}`);
    });
  }
  it("39a person words still give two workplaces", () => {
    const r = extract_profile("남편은 강남, 저는 판교에서 일해요",
      null, { stations: STATIONS });
    const wps = r.profile.workplaces.value;
    assert.equal(wps.length, 2);
    assert.equal(wps.find((w) => w.member === 0).resolved.station, "판교");
    assert.equal(wps.find((w) => w.member === 1).resolved.station, "강남");
  });
});

describe("41l pin labels name 출근 only with a workplace", () => {
  const pin = { n: 1, id: "p1", commuteMin: 5, candidate: { name: "집" } };
  it("no workplace: station walk, never 출근", () => {
    assert.equal(tagCommuteLine(pin, "ko", false), "역까지 걸어서 5분");
    assert.equal(tagCommuteLine(pin, "en", false), "5 min walk to station");
    assert.ok(!tagLines(pin, { lang: "ko", hasWorkplace: false }).commute.includes("출근"));
    const label = pinAriaLabel(pin, "", undefined, false);
    assert.ok(!label.includes("출근"), label);
    assert.ok(label.includes("역까지 걸어서 5분"), label);
    const en = pinAriaLabel(pin, "", "en", false);
    assert.ok(!en.includes("commute"), en);
    assert.ok(en.includes("5 min walk to station"), en);
  });
  it("with a workplace: 출근 N분 stays", () => {
    assert.equal(tagCommuteLine(pin, "ko", true), "출근 5분");
    assert.equal(tagCommuteLine(pin, "en", true), "5 min");
    assert.equal(tagLines(pin, { lang: "ko", hasWorkplace: true }).commute, "출근 5분");
    assert.ok(pinAriaLabel(pin, "", undefined, true).includes("출근 5분"));
  });
  it("legend: 출근 시간 only with a workplace", () => {
    const withWork = legendItems("ko", null, false, "trade", "vworld", true).join(" · ");
    const without = legendItems("ko", null, false, "trade", "vworld", false).join(" · ");
    assert.ok(withWork.includes("출근 시간"), withWork);
    assert.ok(!without.includes("출근"), without);
    const enWithout = legendItems("en", null, false, "trade", "vworld", false).join(" · ");
    assert.ok(!enWithout.includes("commute"), enWithout);
  });
});

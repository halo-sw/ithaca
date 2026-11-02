import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

register("./jsx-loader.mjs", import.meta.url);

import { extract_profile } from "../src/profile.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const moneySrc = readFileSync(join(HERE, "..", "src", "ui", "money.jsx"), "utf8");

// 41c: mirror of the money.jsx real-deal line (kept in sync by the
// source-guard test below).
function realDealLine(h) {
  return `실제로 거래된 값 ${h.area_m2}㎡${(h.parcel_rows != null || h.name_rows != null) ? ` (${h.match_method === "parcel+name" ? "땅+단지 이름" : "단지 이름"}으로 찾은 ${(Number(h.parcel_rows) || 0) + (Number(h.name_rows) || 0)}건 중)` : ""}: `;
}

describe("41c real-deal line", () => {
  it("source guards the row count (no bare NaN sum)", () => {
    assert.ok(!moneySrc.includes("h.parcel_rows + h.name_rows"));
    assert.ok(moneySrc.includes("(Number(h.parcel_rows) || 0) + (Number(h.name_rows) || 0)"));
  });
  it("no row counts has no NaN and no 건 중", () => {
    const s = realDealLine({ area_m2: 30 });
    assert.ok(!s.includes("NaN"), s);
    assert.ok(!s.includes("건 중"), s);
    assert.ok(s.includes("실제로 거래된 값 30㎡"), s);
  });
  it("row counts keep the N건 중 part", () => {
    const s = realDealLine({ area_m2: 30, parcel_rows: 2, name_rows: 3 });
    assert.ok(s.includes("5건 중"), s);
  });
});

describe("41c English tenure words", () => {
  it("deposit lease → jeonse with a 300M cap", () => {
    const r = extract_profile("I want a deposit lease up to 300M won", null, { stations: [] });
    assert.equal(r.profile.tenure.value, "jeonse");
    assert.equal(r.profile.depositMax.value, 300000000);
  });
  it("deposit-lease and lump-sum deposit → jeonse", () => {
    for (const text of [
      "Find me a deposit-lease home under 200M won",
      "A lump-sum deposit place under 200M won",
      "A key money place under 200M won",
    ]) {
      const r = extract_profile(text, null, { stations: [] });
      assert.equal(r.profile.tenure.value, "jeonse", text);
    }
  });
  it("monthly rent still → wolse", () => {
    const r = extract_profile("Looking for monthly rent near Pangyo", null, { stations: ["판교"] });
    assert.equal(r.profile.tenure.value, "wolse");
  });
});

describe("41c lot-number HomeName", () => {
  it("English lot-number candidate renders the English name only", async () => {
    const { HomeName } = await import("../src/ui/candidate-card.jsx");
    const { displayNameFor } = await import("../src/homes.js");
    const { homeNameEn } = await import("../src/i18n/home-names.js");
    const candidate = { name: "84-0", kind: "연립·다세대", station: "산성" };
    const ko = displayNameFor(candidate);
    assert.ok(/[가-힣]/.test(ko), ko);
    const el = HomeName({ name: ko, lang: "en", rawName: candidate.name });
    const s = JSON.stringify(el);
    assert.ok(!/[가-힣]/.test(s), s);
    assert.ok(!s.includes("ui-name-gloss"), s);
    assert.ok(s.includes(homeNameEn(ko)), s);
  });
  it("real Korean names keep Korean + English gloss", async () => {
    const { HomeName } = await import("../src/ui/candidate-card.jsx");
    const el = HomeName({ name: "현대아파트(75-1)", lang: "en", rawName: "현대아파트(75-1)" });
    const s = JSON.stringify(el);
    assert.ok(s.includes("현대아파트"), s);
    assert.ok(s.includes("ui-name-gloss"), s);
  });
});

// Stage 41i — English money is full digits + " won" everywhere (never
// ₩ abbreviations, never K/M/B), and the English post-run summary
// carries clean English names. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

import { fmtMoney, fmtWonEn } from "../src/money/currency.js";
import { tagPriceLine } from "../src/chatmap.js";
import { cleanupEnglishAnswer } from "../src/consult/guards.js";
import { romanizeName } from "../src/i18n/romanize.js";
import { homeNameEn } from "../src/i18n/home-names.js";

let pinAriaLabel;
let diaryFallbackLine;

before(async () => {
  ({ pinAriaLabel } = await import("../src/ui/chatmap.jsx"));
  ({ diaryFallbackLine } = await import("../src/ui/chat.jsx"));
});

describe("41i English money is full digits + won", () => {
  it("fmtWonEn spells every size out", () => {
    assert.equal(fmtWonEn(117000000), "117,000,000 won");
    assert.equal(fmtWonEn(960000), "960,000 won");
    assert.equal(fmtWonEn(10000000), "10,000,000 won");
    assert.equal(fmtWonEn(1500000000), "1,500,000,000 won");
  });
  it("fmtMoney in English matches fmtWonEn", () => {
    assert.equal(fmtMoney(117000000, "KRW", { lang: "en" }), "117,000,000 won");
    assert.equal(fmtMoney(960000, "KRW", { lang: "en" }), "960,000 won");
    assert.equal(fmtMoney(10000000, "KRW", { lang: "en" }), "10,000,000 won");
    assert.equal(fmtMoney(1500000000, "KRW", { lang: "en" }), "1,500,000,000 won");
  });
  it("Korean output is unchanged", () => {
    const ko = fmtMoney(117000000);
    assert.ok(ko.includes("억"), ko);
    assert.ok(!ko.includes("won"), ko);
    assert.ok(!ko.includes("₩"), ko);
  });
  it("USD is unchanged", () => {
    assert.equal(fmtMoney(4261, "USD"), "$4,261");
    assert.equal(fmtMoney(4261, "USD", { lang: "en" }), "$4,261");
  });
  it("no English output abbreviates won", () => {
    for (const o of [fmtWonEn(117000000), fmtWonEn(960000),
      fmtMoney(1500000000, "KRW", { lang: "en" })]) {
      assert.ok(!o.includes("₩"), o);
      assert.ok(!/[\d.,]\s*[KMB]\b/.test(o), o);
    }
  });
});

describe("41i card aria-label and pin label", () => {
  const cand = (tenures) => ({ id: "c3", name: "Deo Rich Ville", tenures });
  it("a KRW candidate reads full digits with no ₩", () => {
    const c = cand([{ tenure: "jeonse", median_won: 117000000, deals: 4 }]);
    const price = tagPriceLine(c, "jeonse", "en");
    assert.equal(price, "117,000,000 won");
    const p = { n: 3, id: "p3", lon: 127.05, lat: 37.4,
      picked: false, letter: null, commuteMin: 26, candidate: c };
    const label = pinAriaLabel(p, price, "en");
    assert.ok(label.includes("117,000,000 won"), label);
    assert.ok(!label.includes("₩"), label);
  });
  it("monthly over deposit spells both out", () => {
    const c = cand([{ tenure: "wolse", median_won: 960000,
      deposit_median_won: 10000000, deals: 3 }]);
    assert.equal(tagPriceLine(c, "wolse", "en"), "960,000 won / 10,000,000 won");
  });
});

describe("41i summary cleanup", () => {
  it("homeNameEn already reads the Pangyo officetel in English", () => {
    assert.equal(homeNameEn("판교역 근처 오피스텔"), "Officetel near Pangyo Stn");
  });
  it("a commute summary keeps the English name and loses the Hangul", () => {
    const s = "Finished living there. For your reference, the average one-way "
      + "commute is 5 minutes from Officetel near Pangyo Stn (판교역 근처 오피스텔) "
      + "and 24 minutes from Suseo Hyundai Venture Ville.";
    const out = cleanupEnglishAnswer(s, { lang: "en",
      names: { "판교역 근처 오피스텔": "Officetel near Pangyo Stn" } });
    assert.ok(!/[가-힣]/.test(out), out);
    assert.ok(out.includes("Officetel near Pangyo Stn"), out);
  });
  it("drops the salutation, tenure words and 원", () => {
    const s = "Dear customer, both Dongin Levant Officetel (동인 레반트 오피스텔) "
      + "and Row house near Wangsimni Stn (왕십리역 근처 연립·다세대) "
      + "averaged under 30 minutes. The jeonse deposit was 150,000원.";
    const out = cleanupEnglishAnswer(s, { lang: "en", names: {} });
    assert.ok(!/[가-힣]/.test(out), out);
    assert.ok(!/dear customer/i.test(out), out);
    assert.ok(out.includes("deposit lease"), out);
    assert.ok(out.includes("150,000 won"), out);
  });
  it("expands a ₩ billions form", () => {
    assert.equal(cleanupEnglishAnswer("saved ₩1.6B", { lang: "en" }),
      "saved 1,600,000,000 won");
  });
  it("the English fallback line uses English home names", () => {
    const line = diaryFallbackLine({ A: 5, B: 24 },
      { A: "판교역 근처 오피스텔", B: "수서 현대벤처빌" }, "en");
    assert.ok(!/[가-힣]/.test(line), line);
    assert.ok(line.includes("Officetel near Pangyo Stn"), line);
  });
});

describe("41i romanizeName hyphen N차/N단지", () => {
  it("정원스테이-4차 ends with Phase 4", () => {
    assert.ok(romanizeName("정원스테이-4차").endsWith("Phase 4"),
      romanizeName("정원스테이-4차"));
  });
  it("hyphen N단지 ends with Complex N", () => {
    assert.ok(romanizeName("휴먼시아-41단지").endsWith("Complex 41"),
      romanizeName("휴먼시아-41단지"));
  });
  it("trailing forms from 41a still read the same", () => {
    assert.equal(romanizeName("휴먼시아41단지"), "Humansia Complex 41");
  });
});

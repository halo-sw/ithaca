// Stage 41a: English money reads full digits and the word "won" — never
// ₩ abbreviations, never M/K. US dollars are untouched, Korean output is
// untouched, and no output carries ₩ followed by a digit and M/K.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTranslator, localizeNumbers } from "../src/i18n/translate.js";
import { phrases, patterns } from "../src/i18n/en.js";
import { WORDS } from "../src/i18n/en-words.js";
import { romanizeName } from "../src/i18n/romanize.js";

const tr = () => createTranslator({ phrases, patterns, words: WORDS });
const outputs = [];
const pin = (s) => { outputs.push(s); return s; };

describe("41a English money is full digits + won", () => {
  it("decimal eok", () => {
    assert.equal(pin(tr().translate("전세 1.7억")), "deposit lease 170,000,000 won");
  });
  it("eok + man", () => {
    assert.equal(pin(tr().translate("전세 2억 6,000만 원")), "deposit lease 260,000,000 won");
  });
  it("eok + cheon reads as money", () => {
    assert.equal(pin(localizeNumbers("1억 2천")), "120,000,000 won");
  });
  it("man + won across a joiner, zero stays spaced", () => {
    assert.equal(pin(tr().translate("필요 1,000만 원 · 가진 돈 0원")),
      "Needed 10,000,000 won · you have 0 won");
  });
  it("bare won after a count", () => {
    assert.equal(pin(tr().translate("출퇴근 88번 × 1,500원")), "commute 88 times × 1,500 won");
  });
  it("small man amounts keep every digit", () => {
    assert.equal(pin(localizeNumbers("15만 원")), "150,000 won");
    assert.equal(pin(localizeNumbers("3만 5,000원")), "35,000 won");
    assert.equal(pin(localizeNumbers("104만 원")), "1,040,000 won");
  });
  it("edit-conditions capture splits on · before money localizes", () => {
    assert.equal(
      pin(tr().translate("조건 수정: 디지털미디어시티 출근 · 1인 · 주 3일 출근 · 전세 3억 원 이하")),
      "Jogeon Sujeong: Digital Media City commute · 1 person · " +
      "office 3 days a week · deposit lease 300,000,000 won or less");
  });
  it("US dollars are untouched", () => {
    assert.equal(pin(tr().translate("$4,261/mo")), "$4,261/mo");
  });
  it("no output abbreviates won", () => {
    for (const o of outputs) assert.ok(!/₩[\d.,]*[MK]/.test(o), o);
  });
});

describe("41a home-name readings", () => {
  it("trailing N차 reads Phase N", () => {
    assert.equal(romanizeName("가락동 훼미리 오피스텔2차"),
      "Garak-dong Family Officetel Phase 2");
  });
  it("trailing N단지 reads Complex N", () => {
    assert.equal(romanizeName("휴먼시아41단지"), "Humansia Complex 41");
  });
  it("hyphen between Hangul parts keeps no spaces", () => {
    assert.equal(romanizeName("빌딩-에벤에셀"), "Building-Ebenesel");
  });
});

// Stage 29L6: English building names read like names (no letter-by-letter
// romanisation), 3D label boxes are sized from the shown English text,
// and the phone scene header shortens its actions.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { romanize, romanizeName } from "../src/i18n/romanize.js";
import { labelBoxW, placeLabels } from "../src/labels3d.js";
import { placeNameEn, sceneActionLabelFor } from "../src/ui/scene-chrome.js";

register("./jsx-loader.mjs", import.meta.url);

const EN_CASES = [
  ["대하빌딩", "Daeha Building"],
  ["엘리시아빌", "Ellisia Vill"],
  ["신일유토빌", "Sinilyuto Vill"],
  ["역삼우성아파트", "Yeoksamuseong Apt"],
  ["동아팰리스빌라", "Donga Palace Villa"],
  ["역삼동다세대주택", "Yeoksam-dong Multi-family house"],
  ["다세대주택", "Multi-family house"],
  ["팰리스", "Palace"],
  ["강남역", "Gangnam Stn"],
  ["잠실동", "Jamsil-dong"],
];

describe("29L6 building-type words read as English", () => {
  for (const [ko, en] of EN_CASES) {
    it(`${ko} -> ${en}`, () => {
      assert.equal(romanizeName(ko), en);
    });
  }

  it("no output keeps the letter-by-letter lr", () => {
    for (const [ko] of EN_CASES) {
      assert.ok(!romanizeName(ko).toLowerCase().includes("lr"), ko);
    }
    assert.ok(!romanize("팰리스").includes("lr"));
  });

  it("ㄹ+ㄹ assimilates to ll", () => {
    assert.equal(romanize("팰리스"), "Paelliseu");
    assert.equal(romanize("엘리시아"), "Ellisia");
    assert.equal(romanize("설렁"), "Seolleong");
  });

  it("complex English names and stations are untouched", () => {
    assert.equal(placeNameEn("레이크팰리스"), "Lake Palace");
    assert.equal(romanizeName("강남역"), "Gangnam Stn");
  });
});

describe("29L6 label box from the shown text", () => {
  it("English width covers the romanised title", () => {
    const shown = "Yeoksam-dong Multi-family house";
    assert.ok(labelBoxW("역삼동다세대주택", "en") >= shown.length * 7.5 + 24);
  });

  it("Korean width equals the old estimate", () => {
    assert.equal(labelBoxW("역삼동다세대주택", "ko"), [..."역삼동다세대주택"].length * 13 + 24);
  });

  it("English-width box on a 390 stage stays inside or drops", () => {
    const w = labelBoxW("역삼동다세대주택", "en");
    const placed = placeLabels(
      [{ id: "c1", level: "complex", title: "역삼동다세대주택", x: 340, y: 100, w, h: 22 }],
      390, 800, []);
    for (const p of placed) {
      assert.ok(p.x >= 4 && p.x + (p.w ?? w) <= 390 - 4, `outside: ${p.x}`);
    }
    const kept = placeLabels(
      [{ id: "h1", level: "always", title: "역삼동다세대주택", x: 340, y: 100, w, h: 22 }],
      390, 800, []);
    assert.equal(kept.length, 1);
    assert.ok(kept[0].x >= 4 && kept[0].x + w <= 390 - 4);
  });
});

describe("29L6 phone scene header labels", () => {
  it("shortens English actions on phones only", () => {
    assert.equal(sceneActionLabelFor("Homes map", { phone: true, lang: "en" }), "Homes");
    assert.equal(sceneActionLabelFor("Open in new window", { phone: true, lang: "en" }), "New window");
    assert.equal(sceneActionLabelFor("Homes map", { phone: false, lang: "en" }), "Homes map");
    assert.equal(
      sceneActionLabelFor("Open in new window", { phone: false, lang: "en" }), "Open in new window");
    assert.equal(sceneActionLabelFor("후보 지도", { phone: true, lang: "ko" }), "후보 지도");
    assert.equal(sceneActionLabelFor("새 창으로", { phone: true, lang: "ko" }), "새 창으로");
  });
});

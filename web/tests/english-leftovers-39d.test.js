// Stage 39d: English leftovers on the live run — " · "-joined chips,
// workplace stay rows, generated lot-number names.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTranslator } from "../src/i18n/translate.js";
import { phrases, patterns } from "../src/i18n/en.js";
import { WORDS } from "../src/i18n/en-words.js";
import { activityLine } from "../src/mapwalk.js";
import { workplaceLabel } from "../src/ui/scene-chrome.js";
import { romanizeName } from "../src/i18n/romanize.js";

const HANGUL = /[가-힣]/;

function translator() {
  return createTranslator({ phrases, patterns, words: WORDS });
}

describe("39d chip segments", () => {
  it("translates a · -joined profile chip piece by piece", () => {
    const tr = translator();
    const out = tr.translate("디지털미디어시티 출근 · 1인 · 주 3일 출근 · 전세 3억 원 이하");
    assert.ok(out.includes("office 3 days a week"), out);
    assert.ok(!out.includes("Ju"), out);
    assert.ok(!HANGUL.test(out), out);
  });

  it("keeps the old fallback when one segment stays Korean", () => {
    const tr = translator();
    // Pin without · behaves exactly as today (29a1 pin).
    assert.equal(tr.translate("확인한 것 1가지"), "1 thing checked");
    // One untranslatable segment keeps the old path: the generic
    // "{0} · {1}" pattern translates the first piece and keeps the
    // Korean sentence (no fake romanization), exactly as before.
    const mixed = tr.translate("주 3일 출근 · 어제 저녁에 집 근처 공원에서 강아지를 봤다");
    assert.equal(mixed, "office 3 days a week · 어제 저녁에 집 근처 공원에서 강아지를 봤다");
    assert.ok(HANGUL.test(mixed), mixed);
  });
});

describe("39d workplace stay rows", () => {
  it("reads a 근무 stay as the English workplace label", () => {
    const seg = { kind: "stay", label: "직장 (가정: 디지털미디어시티역 인근) 근무" };
    const want = `09:22 · ${workplaceLabel("디지털미디어시티", "en", "Digital Media City")}`;
    assert.equal(activityLine(seg, 562, "en"), want);
    const out = activityLine(seg, 562, "en");
    assert.ok(out.includes("Digital Media City"), out);
    assert.ok(!out.includes("Geunmu"), out);
    assert.ok(!HANGUL.test(out), out);
  });

  it("leaves the Korean stay line unchanged", () => {
    const seg = { kind: "stay", label: "직장 (가정: 디지털미디어시티역 인근) 근무" };
    assert.equal(activityLine(seg, 562, "ko"), "09:22 · 직장 (가정: 디지털미디어시티역 인근) 근무");
  });
});

describe("39d generated lot-number names", () => {
  it("reads the displayNameFor shapes as English", () => {
    assert.equal(
      romanizeName("산성역 근처 연립·다세대 (84-0)"),
      "Row house near Sanseong Stn (84-0)",
    );
    assert.equal(
      romanizeName("디지털미디어시티역 근처 오피스텔 (12)"),
      "Officetel near Digital Media City Stn (12)",
    );
    assert.equal(romanizeName("산성역 근처 (84-0)"), "Near Sanseong Stn (84-0)");
    assert.equal(
      romanizeName("대치동 연립·다세대 (242-4)"),
      "Daechi-dong row house (242-4)",
    );
    assert.equal(romanizeName("대치동 (242-4)"), "Daechi-dong (242-4)");
    assert.equal(romanizeName("아파트 (101)"), "Apartment (101)");
  });

  it("leaves ordinary complex names as today", () => {
    assert.equal(romanizeName("래미안대치팰리스"), "Raemian Daechi Palace");
  });
});

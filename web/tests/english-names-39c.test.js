// Stage 39c: English screens use official station names, translated
// loanwords / place terms, and homes show their road-name address in
// English. node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { romanizeName } from "../src/i18n/romanize.js";
import { roadAddressEn } from "../src/i18n/road-address.js";
import { labelBoxW, labelItemsFor } from "../src/labels3d.js";

register("./jsx-loader.mjs", import.meta.url);

const CASES = [
  ["강남구청역", "Gangnam-gu Office Stn"],
  ["디지털미디어시티", "Digital Media City"],
  ["구암어린이공원", "Guam Children's Park"],
  ["수지구청", "Suji-gu Office"],
  ["에스케이허브진", "SK Hub Jin"],
  ["하우징허브", "Housing Hub"],
  ["거성스타힐", "Geoseong Star Hill"],
  ["강동현대", "Gangdong Hyundai"],
  ["삼성동", "Samseong-dong"],
  ["천호동", "Cheonho-dong"],
  ["종로", "Jongno"],
];

describe("39c romanizeName: stations, loanwords, place terms", () => {
  for (const [ko, en] of CASES) {
    it(`${ko} -> ${en}`, () => {
      assert.equal(romanizeName(ko), en);
    });
  }

  it("no output contains Hangul", () => {
    for (const [ko] of CASES) {
      assert.ok(!/[가-힣]/.test(romanizeName(ko)), ko);
    }
  });
});

describe("39c roadAddressEn", () => {
  it("cheonho-daero form", () => {
    assert.equal(
      roadAddressEn({ road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" }),
      "45 Cheonho-daero 157-gil, Gangdong-gu, Seoul",
    );
  });
  it("beon-gil form", () => {
    assert.equal(
      roadAddressEn({ road: "시민로28번길 7", sigungu: "경기도 성남시 수정구 신흥동" }),
      "7 Simin-ro 28beon-gil, Sujeong-gu, Seongnam-si",
    );
  });
  it("plain ro form", () => {
    assert.equal(
      roadAddressEn({ road: "중앙공원로 17", sigungu: "경기도 성남시 분당구 서현동" }),
      "17 Junganggongwon-ro, Bundang-gu, Seongnam-si",
    );
  });
  it("missing road reads empty", () => {
    assert.equal(roadAddressEn({ road: null }), "");
  });
});

describe("39c HomeName address line", () => {
  const addr = { road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" };
  const addrEn = "45 Cheonho-daero 157-gil, Gangdong-gu, Seoul";

  it("English renders the English address once", async () => {
    const { HomeName } = await import("../src/ui/candidate-card.jsx");
    const el = HomeName({ name: "에스케이허브진", lang: "en", address: addr });
    const s = JSON.stringify(el);
    assert.equal(s.split(addrEn).length - 1, 1);
    assert.ok(s.includes("ui-home-address"));
  });

  it("Korean renders no address line", async () => {
    const { HomeName } = await import("../src/ui/candidate-card.jsx");
    const el = HomeName({ name: "에스케이허브진", lang: "ko", address: addr });
    const s = JSON.stringify(el);
    assert.ok(!s.includes("ui-home-address"));
    assert.ok(!s.includes(addrEn));
  });
});

describe("39c 3D home label address", () => {
  const s = 0.0002;
  const area = {
    complexes: [],
    buildings: [{
      id: "b1",
      geometry: { type: "Polygon", coordinates: [[[127.1, 37.35], [127.1 + s, 37.35], [127.1 + s, 37.35 + s], [127.1, 37.35 + s], [127.1, 37.35]] ] },
    }],
    pois: [],
  };
  const addr = { road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" };
  const addrEn = "45 Cheonho-daero 157-gil, Gangdong-gu, Seoul";

  it("home item carries sub (Korean road) and subEn (English road)", () => {
    const items = labelItemsFor(area, {
      homeBuildingId: "b1", homeCandidate: { address: addr }, cameraDistM: 100,
    });
    assert.equal(items[0].sub, "천호대로157길 45");
    assert.equal(items[0].subEn, addrEn);
  });

  it("English box width covers the English sub", () => {
    const home = labelItemsFor(area, {
      homeBuildingId: "b1", homeCandidate: { address: addr }, cameraDistM: 100,
    })[0];
    assert.ok(labelBoxW(home.title, "en", { sub: home.sub, subEn: home.subEn })
      >= addrEn.length * 7.5 + 24);
  });
});

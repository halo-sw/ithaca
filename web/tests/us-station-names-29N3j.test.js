// Stage 29N3j — US station names in sentences read like the map:
// 팔로알토역 / Palo Alto Stn. node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { usStationDisplay } from "../src/region-names.js";
import { lifeEventLines } from "../src/engine/life-events.js";
import { stationLabelName } from "../src/chatmap.js";
import { stationRideLabel } from "../src/labels3d.js";
import { createTranslator } from "../src/i18n/translate.js";
import { phrases, patterns } from "../src/i18n/en.js";
import { WORDS } from "../src/i18n/en-words.js";

register("./jsx-loader.mjs", import.meta.url);

const darkRow = (fromA, fromB) => ({
  kind: "dark_walk",
  a: { count: 44, avgMin: 4, avgM: 340, from: fromA, fromKind: "station" },
  b: { count: 44, avgMin: 10, avgM: 770, from: fromB, fromKind: "station" },
  sunset: "17:00",
});

describe("29N3j usStationDisplay", () => {
  it("normalises raw US station names, never touches Korean ones", () => {
    assert.equal(usStationDisplay("Redwood City Transit Center", "ko"), "레드우드시티");
    assert.equal(usStationDisplay("Palo Alto", "ko"), "팔로알토");
    assert.equal(usStationDisplay("Downtown Mountain View Transit Center", "en"), "Mountain View");
    assert.equal(usStationDisplay("2nd & King", "ko"), "샌프란시스코");
    assert.equal(usStationDisplay("선릉", "ko"), "선릉");
  });
});

describe("29N3j after-dark line on a US run", () => {
  const line = lifeEventLines([darkRow("Palo Alto", "Redwood City Transit Center")], ["A", "B"])[0];

  it("names the Caltrain stations in Korean", () => {
    assert.ok(line.includes("팔로알토역에서"), line);
    assert.ok(line.includes("레드우드시티역에서"), line);
    assert.ok(!line.includes("Transit Center"), line);
  });

  it("translates to English without Transit Center", () => {
    const { translate } = createTranslator({ phrases, patterns, words: WORDS });
    const en = translate(line);
    assert.ok(en.includes("from Redwood City Station"), en);
    assert.ok(en.includes("from Palo Alto Station"), en);
    assert.ok(!en.includes("Transit Center"), en);
  });

  it("a Korean-run line is byte-identical to before", () => {
    const ko = lifeEventLines([{
      kind: "dark_walk",
      a: { count: 44, avgMin: 12, avgM: 920, from: "잠실", fromKind: "station" },
      b: { count: 44, avgMin: 17, avgM: 1300, from: "판교", fromKind: "station" },
      sunset: "17:25",
    }], ["A", "B"])[0];
    assert.equal(ko,
      "해 진 뒤 걸어서 퇴근: A 44번 · 잠실역에서 평균 12분(920m) · B 44번 · 판교역에서 평균 17분(1.3km) · 해 지는 시각 17:25 기준");
  });
});

describe("29N3j map plates and 3D pill agree", () => {
  it("plate: 레드우드시티역 / Redwood City Stn", () => {
    assert.equal(stationLabelName("Redwood City Transit Center", "ko"), "레드우드시티역");
    assert.equal(stationLabelName("Redwood City Transit Center", "en"), "Redwood City Stn");
  });

  it("pill: 레드우드시티역 · 칼트레인 / Redwood City Stn · Caltrain", () => {
    assert.equal(stationRideLabel("Redwood City Transit Center", "ko", { caltrain: true }),
      "레드우드시티역 · 칼트레인");
    assert.equal(stationRideLabel("Redwood City Transit Center", "en", { caltrain: true }),
      "Redwood City Stn · Caltrain");
  });
});

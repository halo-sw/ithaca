// Stage 29N3d — US 30-day run polish: the platform wait counts door to
// door, Caltrain is not "subway", generic places read in English.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commuteOneWayMinutes } from "../src/verify/numbers.js";
import { pickMoments } from "../src/engine/moments.js";
import { stationRideLabel } from "../src/labels3d.js";
import { activityLabel, activityLabelEn, isCaltrainRun } from "../src/timeline.js";
import { placeNameEn, todayStepEn } from "../src/ui/scene-chrome.js";
import { createTranslator } from "../src/i18n/translate.js";
import { phrases, patterns } from "../src/i18n/en.js";
import { WORDS } from "../src/i18n/en-words.js";

// Walk 8 to the station, wait half the headway (8), ride 20 to Menlo
// Park. The Korean fixture has no wait away.
function caltrainRun({ waitMin, home }) {
  const aways = [];
  if (waitMin > 0) {
    aways.push({ agent: "h1", day: 0, kind: "wait",
      start_min: 458, end_min: 458 + waitMin, label: "열차 대기" });
  }
  const rideStart = 458 + waitMin;
  aways.push({ agent: "h1", day: 0, kind: "ride",
    start_min: rideStart, end_min: rideStart + 20, label: "Caltrain",
    detail: { ride: { minutesTotal: 20 } } });
  aways.push({ agent: "h1", day: 0, kind: "work",
    start_min: rideStart + 20, end_min: rideStart + 560,
    label: "Meta HQ 근무" });
  return {
    meta: { area: "us-st-palo-alto", home },
    agents: [{ key: "h1", household: true }],
    trips: [{ id: "t-out", agent: "h1", day: 0, purpose: "commute",
      from: { kind: "home" }, to: { kind: "station" },
      depart_min: 450, arrive_min: 458, minutes: 8 }],
    aways,
    decisions: [],
  };
}

describe("29N3d the one-way average and the longest day include the wait", () => {
  it("an 8 min wait lifts the average 28 -> 36", () => {
    assert.equal(commuteOneWayMinutes(caltrainRun({ waitMin: 8 }), "h1"), 36);
    assert.equal(commuteOneWayMinutes(caltrainRun({ waitMin: 0 }), "h1"), 28);
  });

  it("the longest-commute moment is the door-to-door span", () => {
    const moments = pickMoments(
      caltrainRun({ waitMin: 8, home: "A" }),
      caltrainRun({ waitMin: 0, home: "B" }));
    const commute = moments.find((m) => m.kind === "commute");
    assert.ok(commute, "a commute moment wins");
    assert.ok(commute.text_ko.includes("36분"), commute.text_ko);
  });
});

describe("29N3d Caltrain wording, never subway", () => {
  it("station pill reads Stn · Caltrain / 역 · 칼트레인", () => {
    assert.equal(
      stationRideLabel("Palo Alto", "en", { caltrain: true }),
      "Palo Alto Stn · Caltrain");
    assert.equal(
      stationRideLabel("Palo Alto", "ko", { caltrain: true }),
      "팔로알토역 · 칼트레인");
  });

  it("Korean runs keep the subway wording", () => {
    assert.equal(stationRideLabel("판교", "en"), "Pangyo · subway entrance");
    assert.equal(
      stationRideLabel("판교", "ko"), "판교역 · 지하철 타는 곳");
  });

  it("the ride legend reads Train / 열차 on a Caltrain run", () => {
    const us = { meta: { area: "us-st-palo-alto" }, aways: [] };
    const kr = { meta: { area: "gangnam" }, aways: [] };
    assert.equal(isCaltrainRun(us), true);
    assert.equal(isCaltrainRun(kr), false);
    assert.equal(activityLabelEn("subway", { train: true }), "Train");
    assert.equal(activityLabelEn("subway"), "Subway");
    assert.equal(activityLabel("subway", { train: true }), "열차");
    assert.equal(activityLabel("subway"), "지하철");
  });

  it("the English table reads · Caltrain and Train, never romanised", () => {
    const tr = createTranslator({ phrases, patterns, words: WORDS });
    assert.equal(tr.translate("Palo Alto역 · 칼트레인"), "Palo Alto Stn · Caltrain");
    assert.equal(tr.translate("열차"), "Train");
    assert.equal(tr.translate("칼트레인 타는 곳"), "Caltrain entrance");
  });
});

describe("29N3d generic places read in English", () => {
  it("an unnamed park is a park", () => {
    assert.equal(placeNameEn("공원"), "a park");
    assert.equal(todayStepEn({ kind: "place", label: "공원" }), "a park");
    for (const got of [placeNameEn("편의점"), placeNameEn("병원")]) {
      assert.ok(!/[가-힣]/.test(got), got);
      assert.ok(!/gongwon|pyeonuijeom|byeongwon/i.test(got), got);
    }
    assert.equal(placeNameEn("편의점"), "a convenience store");
  });

  it("named places keep their names", () => {
    assert.equal(placeNameEn("레이크팰리스"), "Lake Palace");
    assert.ok(!/a park/.test(placeNameEn("올림픽 공원")));
  });
});

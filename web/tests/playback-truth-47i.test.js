// Stage 47i — playback truth: current-leg remain wins over a stale
// journey hold, work camera stays at recorded coords, wait English.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

import { nowCardFor } from "../src/nowcard.js";
import { sampleAgent } from "../src/sim.js";
import { placeNameEn, todayStepEn, todayStepNoI18n, tripStatusEn } from "../src/ui/scene-chrome.js";

let heroBig;
before(async () => {
  ({ heroBig } = await import("../src/ui/app.jsx"));
});

const CAUSE = { text: "routine cause", type: "routine", criterion_ids: [], decision_id: null };

function setup(trips, aways, label = "나") {
  const run = { agents: [{ key: "A", label }], trips, aways, meta: { days: 30 } };
  const indexed = {
    tripsByAgent: new Map([["A", trips]]),
    awaysByAgent: new Map([["A", aways]]),
  };
  return { run, indexed };
}

function bikeTrip() {
  return { id: "t1", agent: "A", day: 0, depart_min: 480, arrive_min: 487,
    purpose: "commute", mode: "bike", from: { label: "집" }, to: { label: "직장" }, cause: CAUSE };
}

describe("47i current leg beats stale journey", () => {
  it("bike 7 min left wins over journey hold 0", () => {
    const { run, indexed } = setup([bikeTrip()], []);
    const card = nowCardFor({ run, indexed, agentKey: "A", day: 0, minute: 480 });
    assert.equal(card.state, "trip");
    assert.equal(card.remainingMinutes, 7);
    const got = heroBig({ now: card, journey: { minutesLeft: 0, where: "hold" }, clock: { minute: 480 } });
    assert.equal(got, "7분 남음");
  });

  it("work-until time uses actual remain, not stale journey 0", () => {
    const away = { agent: "A", day: 0, start_min: 540, end_min: 1020, kind: "work",
      label: "먼직장 근무", detail: { workplace: { name: "먼직장", lon: 127.1, lat: 37.6 } }, cause: CAUSE };
    const { run, indexed } = setup([], [away]);
    const card = nowCardFor({ run, indexed, agentKey: "A", day: 0, minute: 600 });
    assert.equal(card.state, "away");
    assert.equal(card.remainingMinutes, 420);
    const got = heroBig({ now: card, journey: { minutesLeft: 0, where: "hold" }, clock: { minute: 600 } });
    assert.equal(got, "420분 남음");
  });

  it("legacy ride card still reads journey minutes while riding", () => {
    const got = heroBig({ now: { state: "ride", now: "지하철 이동 중 · 경로 없음 · 9분 남음",
      ride: { minutesLeft: 9 } }, journey: { minutesLeft: 9, where: "ride" }, clock: null });
    assert.equal(got, "9분 남음");
  });

  it("unknown cards never fake 0; fractional remain ceils", () => {
    const blank = heroBig({ now: { state: "home", now: "집 · 아침 시간" },
      journey: { minutesLeft: 0 }, clock: { minute: 480 } });
    assert.equal(blank, "");
    const trip = { id: "t9", agent: "A", day: 3, depart_min: 1060.4, arrive_min: 1068.2,
      purpose: "errand", from: { label: "집" }, to: { label: "GS25" }, cause: CAUSE };
    const { run, indexed } = setup([trip], []);
    const card = nowCardFor({ run, indexed, agentKey: "A", day: 3, minute: 1068 });
    assert.equal(card.remainingMinutes, 1);
    assert.equal(heroBig({ now: card, journey: { minutesLeft: 0 }, clock: null }), "1분 남음");
  });

  it("at actual arrival the next activity shows, not the past trip", () => {
    const trip = { id: "t2", agent: "A", day: 0, depart_min: 480, arrive_min: 490,
      purpose: "commute", from: { label: "집" }, to: { label: "직장" }, cause: CAUSE };
    const away = { agent: "A", day: 0, start_min: 490, end_min: 900, kind: "work",
      label: "직장 근무", detail: {}, cause: CAUSE };
    const { run, indexed } = setup([trip], [away]);
    const card = nowCardFor({ run, indexed, agentKey: "A", day: 0, minute: 490 });
    assert.notEqual(card.state, "trip");
    assert.equal(card.state, "away");
  });
});

describe("47i work camera keeps recorded coords", () => {
  const nodes = new Map([["a", [0, 0]], ["b", [10, 0]]]);
  const home = [0, 0];
  function workAway(detail) {
    return { agent: "A", day: 0, start_min: 540, end_min: 1020, kind: "work",
      label: "먼직장 근무", detail, cause: CAUSE };
  }
  function idx(aways, trips = []) {
    return { tripsByAgent: new Map([["A", trips]]), awaysByAgent: new Map([["A", aways]]) };
  }

  it("work with valid coords retains dest, hidden, at seek and at boundary", () => {
    const a = workAway({ workplace: { name: "먼직장", lon: 127.1, lat: 37.6 } });
    for (const minute of [545, 540]) {
      const s = sampleAgent("A", idx([a]), 0, minute, nodes, home);
      assert.equal(s.visible, false);
      assert.equal(s.state, "away");
      assert.equal(s.lon, 127.1);
      assert.equal(s.lat, 37.6);
    }
  });

  it("invalid coords and legacy work keep the home fallback", () => {
    for (const detail of [{}, { workplace: { name: "x", lon: NaN, lat: 37.6 } }]) {
      const s = sampleAgent("A", idx([workAway(detail)]), 0, 600, nodes, home);
      assert.equal(s.visible, false);
      assert.deepEqual([s.lon, s.lat], home);
    }
  });

  it("ride stays journey-owned; trip movement unchanged", () => {
    const ride = { agent: "A", day: 0, start_min: 500, end_min: 530, kind: "ride",
      label: "지하철 이동", detail: {}, cause: CAUSE };
    const r = sampleAgent("A", idx([ride]), 0, 510, nodes, home);
    assert.equal(r.visible, false);
    assert.deepEqual([r.lon, r.lat], home);
    const trip = { id: "t3", agent: "A", day: 0, depart_min: 100, arrive_min: 110,
      purpose: "commute", from: { label: "집" }, to: { label: "직장" }, path: ["a", "b"], cause: CAUSE };
    const m = sampleAgent("A", idx([], [trip]), 0, 105, nodes, home);
    assert.equal(m.visible, true);
    assert.equal(m.state, "trip");
    assert.ok(Math.abs(m.lon - 5) < 1e-9);
  });
});

describe("47i wait English is a noun phrase", () => {
  it("wait away reads 'Waiting for the train · N min left'", () => {
    const away = { agent: "A", day: 0, start_min: 500, end_min: 505, kind: "wait",
      label: "열차 대기", detail: {}, cause: CAUSE };
    const { run, indexed } = setup([], [away]);
    const card = nowCardFor({ run, indexed, agentKey: "A", day: 0, minute: 502 });
    assert.equal(card.nowEn, "Me · Waiting for the train · 3 min left");
    assert.doesNotMatch(card.nowEn, /[가-힣]/);
    assert.doesNotMatch(card.nowEn, /Daegi/);
  });

  it("whole-string generic maps; proper nouns and bike English unchanged", () => {
    assert.equal(todayStepEn({ label: "열차 대기" }), "Waiting for the train");
    assert.equal(todayStepNoI18n({ label: "열차 대기" }), true);
    assert.equal(placeNameEn("열차 대기"), "Waiting for the train");
    const station = placeNameEn("판교역");
    assert.ok(/[A-Za-z]/.test(station));
    assert.doesNotMatch(station, /Waiting/);
    const bike = tripStatusEn({ member: "Me", activity: "Commuting",
      from: "집", to: "직장", remainMin: 7, bike: true });
    assert.match(bike, /bike ride/);
  });
});

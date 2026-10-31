// Stage 36d: honest per-part tags, real dwelling buildings, one photo
// per card, the price cap in either order. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

import { commuteLines } from "../src/evidence.js";
import { resolveHome } from "../src/engine/scenario.js";
import { Router } from "../src/engine/graph.js";
import { extract_profile } from "../src/profile.js";

let assignListPhotos;

before(async () => {
  ({ assignListPhotos } = await import("../src/ui/candidate-card.jsx"));
});

const STATIONS = ["강남", "판교", "잠실", "미금", "정자", "서현", "수내", "모란", "오리"];

function rideAway(day, start, rideMin, waitMin, rideSource) {
  return { agent: "h1", day, kind: "ride", label: "지하철",
    start_min: start, end_min: start + rideMin + waitMin,
    detail: {
      ride_minutes: rideMin + waitMin,
      ride_minutes_source: rideSource,
      ride: {
        minutesTotal: rideMin + waitMin,
        legs: [{ lineName: "2호선", from: "A", to: "B", minutes: rideMin,
          congestion: { valuePct: 120, source: "서울교통공사", hasData: true } }],
        transfers: [{ station: "B", minutes: waitMin }],
        transferMinutes: waitMin,
      },
    } };
}

function commuteRun(rideSource) {
  const trip = { id: "t1", agent: "h1", day: 1, purpose: "commute",
    depart_min: 480, arrive_min: 484, minutes: 4,
    from: { label: "집" }, to: { label: "A역" } };
  return {
    run: { meta: { days: 30 }, trips: [trip],
      aways: [rideAway(1, 484, 7, 2, rideSource)] },
    trip,
  };
}

describe("36d per-part commute tags", () => {
  it("an assumed ride is not tagged 측정; parts read walk 측정, subway/transfer 가정값", () => {
    const { run, trip } = commuteRun("user_assumption");
    const lines = commuteLines(run, "h1", trip, trip.depart_min);
    assert.notEqual(lines[0].tag, "측정");
    assert.equal(lines[0].tag, "가정값");
    const byLabel = new Map(lines[0].parts.map((p) => [p.label, p]));
    assert.equal(byLabel.get("걷기").tag, "측정");
    assert.equal(byLabel.get("지하철").tag, "가정값");
    assert.equal(byLabel.get("환승·기다림").tag, "가정값");
  });

  it("a schedule-sourced ride tags the subway 측정", () => {
    const { run, trip } = commuteRun("derived");
    const lines = commuteLines(run, "h1", trip, trip.depart_min);
    const byLabel = new Map(lines[0].parts.map((p) => [p.label, p]));
    assert.equal(byLabel.get("지하철").tag, "측정");
    assert.equal(byLabel.get("걷기").tag, "측정");
    assert.equal(byLabel.get("환승·기다림").tag, "가정값");
  });

  it("the English line says transfer & wait", () => {
    const { run, trip } = commuteRun("user_assumption");
    const lines = commuteLines(run, "h1", trip, trip.depart_min, "en");
    assert.ok(lines[0].parts.some((p) => p.label === "transfer & wait"),
      JSON.stringify(lines[0].parts));
    assert.ok(lines[0].parts.some((p) => p.text.includes("transfer & wait")),
      JSON.stringify(lines[0].parts));
  });
});

function square(lon, lat, s = 0.0001) {
  return { type: "Polygon",
    coordinates: [[[lon, lat], [lon + s, lat], [lon + s, lat + s], [lon, lat + s], [lon, lat]]] };
}

function dwellingArea(onlyGuard) {
  const buildings = [
    { id: "guard", name: "경비실5", levels: 1, area_m2: 16.8,
      register: null, geometry: square(127.0, 37.5) },
  ];
  if (!onlyGuard) {
    buildings.push({ id: "tower", name: "101동", levels: 20, area_m2: 8000,
      register: null, geometry: square(127.002, 37.5) });
  }
  return {
    complexes: [{ id: "cx", name: "백현마을",
      building_ids: buildings.map((b) => b.id) }],
    buildings,
    graph: { nodes: { g: [127.0, 37.5001], t: [127.002, 37.5003] },
      edges: { walk: [], bike: [], drive: [] } },
  };
}

describe("36d dwelling-first resolveHome", () => {
  it("skips the nearer guard booth for the farther dwelling tower", () => {
    const area = dwellingArea(false);
    const r = resolveHome(area, { label: "B", complex_name: "백현마을" },
      new Router(area.graph));
    assert.equal(r.buildingId, "tower");
    assert.equal(r.anchor.dwelling_filter, true);
  });

  it("falls back to the guard booth when it is all there is", () => {
    const area = dwellingArea(true);
    const r = resolveHome(area, { label: "B", complex_name: "백현마을" },
      new Router(area.graph));
    assert.equal(r.buildingId, "guard");
    assert.equal(r.anchor.dwelling_filter, false);
  });
});

describe("36d one photo per card", () => {
  it("two rows sharing a first photo get different photos", () => {
    const shared = { id: "m1", thumb_url: "https://cdn.example/1.jpg" };
    const alt = { id: "m2", thumb_url: "https://cdn.example/2.jpg" };
    const out = assignListPhotos([
      { id: "a", photos: [shared, alt] },
      { id: "b", photos: [shared, alt] },
    ]);
    assert.equal(out.get("a"), shared);
    assert.notEqual(out.get("b"), shared);
  });

  it("a row with no unused photo gets null", () => {
    const shared = { id: "m1", thumb_url: "https://cdn.example/1.jpg" };
    const out = assignListPhotos([
      { id: "a", photos: [shared] },
      { id: "b", photos: [shared] },
    ]);
    assert.equal(out.get("a"), shared);
    assert.equal(out.get("b"), null);
  });
});

describe("36d price cap in either order", () => {
  it("price-first, savings-after", () => {
    const { profile } = extract_profile("10억 이하 매매로 찾아 줘. 모은 돈 3억",
      null, { stations: STATIONS });
    assert.equal(profile.priceMax.value, 1000000000);
    assert.equal(profile.cash.value, 300000000);
  });

  it("savings-first, price-after", () => {
    const { profile } = extract_profile("모은 돈 3억, 10억 이하 매매",
      null, { stations: STATIONS });
    assert.equal(profile.priceMax.value, 1000000000);
    assert.equal(profile.cash.value, 300000000);
  });

  it("매매 anchor after the place", () => {
    const { profile } = extract_profile("강남 출근, 매매 9억 이하",
      null, { stations: STATIONS });
    assert.equal(profile.priceMax.value, 900000000);
  });

  it("deposit cap keeps its own money", () => {
    const { profile } = extract_profile("전세 4억 이하, 모은 돈 1억",
      null, { stations: STATIONS });
    assert.equal(profile.depositMax.value, 400000000);
  });

  it("joined Korean + English keeps the deposit cap, not a salary (36d2)", () => {
    // "income" inside "dual-income" is the household, not a salary cue:
    // the salary anchor must not claim 4억, which would also exclude
    // the 400M copy from the deposit by won value.
    const { profile } = extract_profile(
      "맞벌이 예비부부, 강남 출근, 전세 4억 이하, 59㎡ 이상\ndual-income engaged couple, commute to Gangnam, jeonse up to 400M, 59 m2+",
      null, { stations: STATIONS });
    assert.equal(profile.tenure.value, "jeonse");
    assert.equal(profile.depositMax.value, 400000000);
    assert.equal(profile.salaryAnnual.value, null);
  });
});

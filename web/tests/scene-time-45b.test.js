import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BAY_TZ, KOREA_TZ, sceneInstant, sceneTimeZone } from "../src/scene/time.js";
import { simInstant } from "../src/sim.js";
import { solarPosition } from "../src/lighting.js";
import { skyParams } from "../src/render/sky.js";

// 45b: regional daylight — the render clock keeps local household time.
const MENLO = { id: "us-menlo", country: "US", bbox: [-122.2, 37.44, -122.1, 37.52] };
const MENLO_LAT = 37.48485;
const MENLO_LON = -122.14823;

describe("scene time zones", () => {
  it("defaults to Asia/Seoul", () => {
    assert.equal(sceneTimeZone(undefined), KOREA_TZ);
    assert.equal(sceneTimeZone(null), KOREA_TZ);
    assert.equal(sceneTimeZone({}), KOREA_TZ);
    assert.equal(sceneTimeZone("songpa-jamsil"), KOREA_TZ);
  });

  it("maps Bay Area ids / country / bbox to Los Angeles", () => {
    assert.equal(sceneTimeZone(MENLO), BAY_TZ);
    assert.equal(sceneTimeZone("us-menlo"), BAY_TZ);
    assert.equal(sceneTimeZone("us-st-palo-alto"), BAY_TZ);
    assert.equal(sceneTimeZone({ country: "US", bbox: [-122.2, 37.4, -122.1, 37.5] }), BAY_TZ);
    assert.equal(sceneTimeZone({ area: "us-menlo" }), BAY_TZ);
  });

  it("a valid explicit zone wins; an invalid one falls back", () => {
    assert.equal(sceneTimeZone({ ...MENLO, timeZone: "Asia/Seoul" }), "Asia/Seoul");
    assert.equal(sceneTimeZone("America/New_York"), "America/New_York");
    assert.equal(sceneTimeZone({ ...MENLO, timeZone: "Mars/Olympus" }), BAY_TZ);
  });
});

describe("Korea render clock is exactly unchanged", () => {
  it("matches simInstant across dates, days and minutes", () => {
    const cases = [
      ["2026-11-02", 0, 450],
      ["2026-11-02", 0, 0],
      ["2026-11-02", 6, 0],
      ["2026-11-02", 29, 1439],
      ["2026-10-15", 0, 900],
    ];
    for (const [iso, day, min] of cases) {
      const want = simInstant(iso, day, min).toISOString();
      assert.equal(sceneInstant(iso, day, min, undefined).toISOString(), want);
      assert.equal(sceneInstant(iso, day, min, { id: "songpa-jamsil" }).toISOString(), want);
    }
  });

  it("rolls midnight over to 15:00Z the prior day", () => {
    assert.equal(sceneInstant("2026-11-02", 0, 0, undefined).toISOString(), "2026-11-01T15:00:00.000Z");
    assert.equal(sceneInstant("2026-11-02", 1, 0, undefined).toISOString(), "2026-11-02T15:00:00.000Z");
  });
});

describe("Menlo daylight respects Pacific DST", () => {
  it("July noon is 19:00Z (PDT)", () => {
    assert.equal(sceneInstant("2026-07-15", 0, 720, MENLO).toISOString(), "2026-07-15T19:00:00.000Z");
  });

  it("January noon is 20:00Z (PST)", () => {
    assert.equal(sceneInstant("2026-01-15", 0, 720, MENLO).toISOString(), "2026-01-15T20:00:00.000Z");
  });

  it("Nov 2 2026 noon uses the winter offset", () => {
    assert.equal(sceneInstant("2026-11-02", 0, 720, MENLO).toISOString(), "2026-11-02T20:00:00.000Z");
  });

  it("tour default Oct 15 15:00 is daylight time", () => {
    assert.equal(sceneInstant("2026-10-15", 0, 900, MENLO).toISOString(), "2026-10-15T22:00:00.000Z");
  });

  it("an area id string converts like the area object", () => {
    assert.equal(sceneInstant("2026-07-15", 0, 720, "us-menlo").toISOString(), "2026-07-15T19:00:00.000Z");
  });

  it("local noon is day and local midnight is night at Menlo", () => {
    const noon = sceneInstant("2026-07-15", 0, 720, MENLO);
    const midnight = sceneInstant("2026-07-15", 0, 0, MENLO);
    assert.ok(solarPosition(MENLO_LAT, MENLO_LON, noon).altitude > 0,
      `noon alt=${solarPosition(MENLO_LAT, MENLO_LON, noon).altitude}`);
    assert.equal(skyParams(MENLO_LAT, MENLO_LON, noon, 720).phase, "day");
    assert.ok(solarPosition(MENLO_LAT, MENLO_LON, midnight).altitude < 0,
      `midnight alt=${solarPosition(MENLO_LAT, MENLO_LON, midnight).altitude}`);
    assert.equal(skyParams(MENLO_LAT, MENLO_LON, midnight, 0).phase, "night");
  });

  it("rejects invalid dates, days and minutes", () => {
    assert.throws(() => sceneInstant("nope", 0, 720, MENLO), RangeError);
    assert.throws(() => sceneInstant("2026-13-01", 0, 720, MENLO), RangeError);
    assert.throws(() => sceneInstant("2026-07-15", -1, 720, MENLO), RangeError);
    assert.throws(() => sceneInstant("2026-07-15", 0, -1, MENLO), RangeError);
    assert.throws(() => sceneInstant("2026-07-15", 0, 1440, MENLO), RangeError);
    assert.throws(() => sceneInstant("2026-07-15", 0, 7.5, MENLO), RangeError);
  });

  it("fall-back ambiguity is deterministic (first occurrence)", () => {
    // 2026-11-01 is the PDT->PST changeover; 01:30 happens twice.
    const a = sceneInstant("2026-11-01", 0, 90, MENLO);
    const b = sceneInstant("2026-11-01", 0, 90, MENLO);
    assert.equal(a.toISOString(), b.toISOString());
    assert.equal(a.toISOString(), "2026-11-01T08:30:00.000Z");
  });
});

it("45c3 rejects Feb31/Apr31, accepts leap day", () => {
  assert.throws(() => sceneInstant("2026-02-31", 0, 720, null), RangeError);
  assert.throws(() => sceneInstant("2026-04-31", 0, 720, null), RangeError);
  const d = sceneInstant("2024-02-29", 0, 720, null);
  assert.ok(d instanceof Date);
});

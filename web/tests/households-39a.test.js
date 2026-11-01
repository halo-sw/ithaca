// Stage 39a: parents' 30-day run, two workplaces, English office days
// + Digital Media City, and the walk-only card row.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

import {
  extract_profile, guardProfileValues, scenarioFromProfile,
} from "../src/profile.js";
import { parseScenario } from "../src/engine/scenario.js";

let commuteRowLine;
let commuteShortLine;
before(async () => {
  ({ commuteRowLine, commuteShortLine } = await import("../src/ui/candidate-card.jsx"));
});

const PARENTS = "맞벌이 부부인데 부모님 모시고 같이 살아요. 남편은 광화문, 저는 강남역으로 출근해요.";
const STATIONS = ["광화문", "강남"];
const EN = "I live alone and go to the office in Digital Media City 3 days a week, otherwise I work from home.";

const home = (id, scene, station) => ({
  id, name: `집${id}`, pnu: `pnu${id}`, scene,
  station: station ? { station, walk_minutes: 8 } : null,
});
// Minimal homes fixture, same shape as the 38e test.
const homes = [home("home-000001", "st-정자", "정자")];

describe("39a parents run through parseScenario", () => {
  it("seniors keep work type none with a non-empty weekday list", () => {
    const r = extract_profile(PARENTS, null, { stations: STATIONS });
    const sc = scenarioFromProfile(r.profile, homes);
    const parsed = parseScenario(sc);
    const seniors = parsed.household.members.filter((m) => m.role === "senior");
    assert.equal(seniors.length, 2);
    for (const s of seniors) {
      assert.equal(s.work.type, "none");
      assert.ok(Array.isArray(s.workdays) && s.workdays.length > 0);
    }
  });
});

describe("39a two workplaces", () => {
  it("member 0 reads 강남 and member 1 reads 광화문", () => {
    const r = extract_profile(PARENTS, null, { stations: STATIONS });
    const wps = r.profile.workplaces.value;
    const m0 = wps.find((w) => w.member === 0);
    const m1 = wps.find((w) => w.member === 1);
    assert.equal(m0.resolved.station, "강남");
    assert.equal(m1.resolved.station, "광화문");
    const sc = scenarioFromProfile(r.profile, homes);
    assert.equal(sc.household.members[0].work.destination_station, "강남");
    assert.equal(sc.household.members[1].work.destination_station, "광화문");
    assert.deepEqual(guardProfileValues(r.profile, PARENTS), []);
  });
});

describe("39a office days", () => {
  it("dated cues beat remote words, in Korean and English", () => {
    assert.equal(
      extract_profile(EN, null, { stations: ["디지털미디어시티"] }).profile.officeDays.value, 3);
    assert.equal(
      extract_profile("주 3일 출근하고 나머지는 재택이에요", null, { stations: STATIONS })
        .profile.officeDays.value, 3);
    assert.equal(
      extract_profile("일주일에 두 번 출근해요", null, { stations: STATIONS })
        .profile.officeDays.value, 2);
    assert.equal(
      extract_profile("풀재택이에요", null, { stations: STATIONS }).profile.officeDays.value, 0);
  });
});

describe("39a English workplace", () => {
  it("resolves Digital Media City before the day count", () => {
    const r = extract_profile(EN, null, { stations: ["디지털미디어시티"] });
    assert.equal(r.profile.workplaces.value[0].resolved.station, "디지털미디어시티");
  });
});

describe("39a walk-only card row", () => {
  it("names the station walk, never a 총 total, without a ride", () => {
    const cand = {
      id: "c39a",
      commute: {
        walk: { known: true, station: "강남구청", minutes: 1 },
        ride: { known: false },
      },
    };
    const row = commuteRowLine(cand);
    assert.ok(row.text.includes("역까지 걸어서"), row.text);
    assert.ok(!row.text.includes("총"), row.text);
    const short = commuteShortLine(cand);
    assert.ok(short.text.includes("역까지 걸어서"), short.text);
    assert.ok(!short.text.includes("총"), short.text);
  });
});

// Stage 36h: pattern geometry is stored in travel order (stops[0] first),
// so the journey marker rides 8호선 석촌 → 복정 south instead of north.
// Goes green only after network.json is rebuilt with the 36h pipeline fix.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { legAt, trainPosition } from "../src/journey.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const NET = join(ROOT, "data", "build", "region", "network.json");
const DEMO = join(ROOT, "data", "build", "sim", "demo-two-homes-A.json");
const hasData = existsSync(NET) && existsSync(DEMO);

function haversineM(lon1, lat1, lon2, lat2) {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

describe("36h line geometry in travel order", () => {
  it("every non-circle pattern starts at its first stop", { skip: !hasData }, () => {
    const network = JSON.parse(readFileSync(NET, "utf8"));
    let checked = 0;
    for (const line of network.lines) {
      const stops = new Map(line.stops.map((s) => [s.id, s]));
      for (const p of line.patterns) {
        if (p.stops.length < 2 || p.geometry.length < 2) continue;
        if (p.direction === "inner" || p.direction === "outer") continue;
        if (p.stops[0] === p.stops[p.stops.length - 1]) continue;
        const first = stops.get(p.stops[0]);
        const d = haversineM(
          p.geometry[0][0], p.geometry[0][1], first.lon, first.lat);
        assert.ok(d <= 1000, `${p.id}: geometry[0] ${Math.round(d)} m from first stop`);
        checked += 1;
      }
    }
    assert.ok(checked > 0, "no patterns checked");
  });

  it("A's day-1 ride marker stays on the travelled legs", { skip: !hasData }, () => {
    const network = JSON.parse(readFileSync(NET, "utf8"));
    const demo = JSON.parse(readFileSync(DEMO, "utf8"));
    const ride = demo.aways
      .map((a) => (a.detail ? a.detail.ride : null))
      .find((r) => r && r.legs && r.legs[0] && r.legs[0].patternId);
    assert.ok(ride, "day-1 ride with patterned legs");
    const last = Math.floor(ride.minutesTotal);
    const idx8 = ride.legs.findIndex(
      (l) => l.line === "line8" && l.from === "석촌" && l.to === "복정");
    assert.ok(idx8 >= 0, "8호선 석촌 → 복정 leg");
    for (let e = 0; e <= last; e++) {
      const at = legAt(ride, e);
      if (at.legIndex !== idx8 || at.inTransfer) continue;
      const pos = trainPosition(network, ride, e);
      assert.ok(pos && pos.lat >= 37.465 && pos.lat <= 37.510,
        `elapsed ${e}: marker lat ${pos && pos.lat}`);
    }
    const idxG = ride.legs.findIndex((l) => l.line === "gyeonggang");
    assert.ok(idxG >= 0, "경강선 leg");
    for (let e = 0; e <= last; e++) {
      const at = legAt(ride, e);
      if (at.legIndex !== idxG || at.inTransfer) continue;
      const pos = trainPosition(network, ride, e);
      const d = haversineM(pos.lon, pos.lat, 127.1112, 37.3948);
      assert.ok(d <= 3000, `elapsed ${e}: ${Math.round(d)} m from 판교`);
    }
  });
});

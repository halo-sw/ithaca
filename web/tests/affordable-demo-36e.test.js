// Stage 36e: the demo couple buys what they can afford — officetel
// purchase costs, the new demo-two-homes scenario, derived_estimate
// evidence tags and demo copy. node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { purchaseCosts } from "../src/money/purchase.js";
import { commuteLines } from "../src/evidence.js";
import { parseScenario, resolveHome } from "../src/engine/scenario.js";
import { Router } from "../src/engine/graph.js";
import { DEMO_TOUR_STEPS, RECORDED_AGENT_REPLIES } from "../src/ui/demotour.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const byKey = (items, key) => items.find((it) => it.key === key);

function loadArea(areaId) {
  const dir = join(ROOT, "data", "build", areaId);
  const area = JSON.parse(readFileSync(join(dir, "area.json"), "utf8"));
  for (const [k, v] of Object.entries(area)) {
    if (v && typeof v === "object" && !Array.isArray(v)
      && Object.keys(v).join() === "$ref") {
      area[k] = JSON.parse(readFileSync(join(dir, v.$ref), "utf8"));
    }
  }
  return area;
}

describe("36e officetel purchase costs", () => {
  it("오피스텔 5.87억 61.18㎡: 취득세 4%, 교육세 0.4%, 농특세 0.2%, 중개보수 상한 0.5%", () => {
    const r = purchaseCosts({ priceWon: 587000000, areaM2: 61.18, kind: "오피스텔" });
    assert.equal(byKey(r.items, "acquisition_tax").won, 23480000);
    assert.equal(byKey(r.items, "acquisition_tax").rate_pct, 4);
    assert.equal(byKey(r.items, "education_tax").won, 2348000);
    assert.equal(byKey(r.items, "rural_tax").won, 1174000);
    const b = byKey(r.items, "brokerage_cap");
    assert.equal(b.won, 2935000);
    assert.equal(b.rate_pct, 0.5);
    assert.ok(r.notes.some((n) => n.includes("오피스텔은 주택이 아니라서 취득세가 4%예요")), "officetel note");
  });
  it("without kind, today's housing numbers are unchanged", () => {
    const r = purchaseCosts({ priceWon: 587000000, areaM2: 61.18 });
    assert.equal(byKey(r.items, "acquisition_tax").won, 5870000);
    assert.equal(byKey(r.items, "education_tax").won, 587000);
    assert.equal(byKey(r.items, "rural_tax"), undefined);
    const b = byKey(r.items, "brokerage_cap");
    assert.equal(b.won, 2348000);
    assert.equal(b.rate_pct, 0.4);
  });
});

describe("36e demo-two-homes scenario", () => {
  it("loadScenario parses the new file: homes, work, money", () => {
    const raw = JSON.parse(readFileSync(join(ROOT, "scenarios", "demo-two-homes.json"), "utf8"));
    const s = parseScenario(raw);
    const a = s.homes.find((h) => h.label === "A");
    const b = s.homes.find((h) => h.label === "B");
    assert.equal(a.area, "st-송파나루");
    assert.equal(a.complex_name, "효성올림픽카운티");
    assert.equal(b.area, "st-미금");
    assert.equal(b.complex_name, "분당 엠코 헤리츠");
    assert.equal(b.lon, 127.1082913);
    assert.equal(b.lat, 37.3493344);
    for (const m of s.household.members) {
      assert.equal(m.work.type, "station_ride");
      assert.deepEqual(m.work.station_name, { A: "송파나루", B: "미금" });
      assert.deepEqual(m.work.destination_station, { A: "판교", B: "판교" });
      assert.deepEqual(m.work.ride_minutes, { A: 32.2, B: 6.6 });
      assert.equal(m.work.ride_minutes_source, "derived_estimate");
      assert.equal(m.work.needs_user_input, false);
      assert.ok(typeof m.work.ride_minutes_note === "string" && m.work.ride_minutes_note.length > 0);
    }
    assert.equal(s.money.tenure.A, "매매");
    assert.equal(s.money.tenure.B, "매매");
    assert.equal(s.money.kind.A, "아파트");
    assert.equal(s.money.kind.B, "오피스텔");
    assert.equal(s.money.area_m2.A, 56.22);
    assert.equal(s.money.area_m2.B, 61.18);
    assert.equal(s.money.members.m1.annual_salary_won, 60000000);
    assert.equal(s.money.members.m2.annual_salary_won, 50000000);
    assert.equal(s.money.cash_won, 200000000);
  });
  it("resolveHome on the real boxes", (t) => {
    if (!existsSync(join(ROOT, "data", "build", "st-미금", "area.json"))) {
      t.skip("missing data/build/st-미금/area.json — data/ is gitignored; build it to run this check");
      return;
    }
    const songpa = loadArea("st-송파나루");
    const rA = resolveHome(songpa,
      { label: "A", area: "st-송파나루", complex_name: "효성올림픽카운티" },
      new Router(songpa.graph));
    assert.equal(rA.complex.name, "효성올림픽카운티");
    assert.equal(rA.anchor.method, "complex");
    assert.equal(rA.anchor.dwelling_filter, true);
    assert.ok(rA.buildingId, "building");
    assert.ok(rA.nodeId, "node");
    const migeum = loadArea("st-미금");
    const migeumRouter = new Router(migeum.graph);
    const rB = resolveHome(migeum,
      { label: "B", area: "st-미금", complex_name: "분당 엠코 헤리츠",
        lon: 127.1082913, lat: 37.3493344 },
      migeumRouter);
    const near = migeumRouter.nearestNode(127.1082913, 37.3493344);
    assert.ok(near.distM <= 150, `lon/lat node within 150 m (got ${near.distM} m)`);
    assert.equal(rB.nodeId, near.id);
  });
});

describe("36e derived_estimate evidence tag", () => {
  it("the subway part of a derived_estimate ride is 가정값", () => {
    const trip = { id: "t1", agent: "h1", day: 1, purpose: "commute",
      depart_min: 480, arrive_min: 484, minutes: 4,
      from: { label: "집" }, to: { label: "미금역" } };
    const run = { meta: { days: 30 }, trips: [trip],
      aways: [{ agent: "h1", day: 1, kind: "ride", label: "지하철",
        start_min: 484, end_min: 484 + 6.6 + 2,
        detail: { ride_minutes: 8.6, ride_minutes_source: "derived_estimate",
          ride: { minutesTotal: 8.6,
            legs: [{ lineName: "신분당선", from: "미금", to: "판교", minutes: 6.6,
              congestion: { valuePct: 120, source: "서울교통공사", hasData: true } }],
            transfers: [{ station: "정자", minutes: 2 }],
            transferMinutes: 2 } } }] };
    const lines = commuteLines(run, "h1", trip, trip.depart_min);
    const byLabel = new Map(lines[0].parts.map((p) => [p.label, p]));
    assert.equal(byLabel.get("지하철").tag, "가정값");
  });
});

describe("36e demo copy", () => {
  it("demotour has no 전세, 레이크팰리스 or 백현마을", () => {
    const texts = [
      ...DEMO_TOUR_STEPS.map((s) => s.caption),
      ...Object.values(RECORDED_AGENT_REPLIES).flatMap((r) => [r.q, ...(r.a || [])]),
    ];
    for (const text of texts) {
      assert.ok(!text.includes("전세"), `전세: ${text}`);
      assert.ok(!text.includes("레이크팰리스"), `레이크팰리스: ${text}`);
      assert.ok(!text.includes("백현마을"), `백현마을: ${text}`);
    }
  });
});

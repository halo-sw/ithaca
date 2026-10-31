// Stage 36h2: the home name once, the crowding line names its lines.
// node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { labelItemsFor } from "../src/labels3d.js";
import { commuteLines } from "../src/evidence.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function poly(lon, lat) {
  const s = 0.0002;
  return { type: "Polygon",
    coordinates: [[[lon, lat], [lon + s, lat], [lon + s, lat + s], [lon, lat + s], [lon, lat]]] };
}

function homeTitle(area, id) {
  const items = labelItemsFor(area, { homeBuildingId: id, cameraDistM: 600 });
  return items[0].title;
}

describe("36h2 home name said once", () => {
  it("skips sub_name equal to name", () => {
    const area = { complexes: [], pois: [],
      buildings: [{ id: "b1", geometry: poly(127.1, 37.35),
        register: { name: "분당 엠코 헤리츠", sub_name: "분당 엠코 헤리츠" } }] };
    assert.equal(homeTitle(area, "b1"), "우리 집 · 분당 엠코 헤리츠");
  });
  it("skips sub_name contained in name", () => {
    const area = { complexes: [], pois: [],
      buildings: [{ id: "b1", geometry: poly(127.1, 37.35),
        register: { name: "래미안 101동", sub_name: "101동" } }] };
    assert.equal(homeTitle(area, "b1"), "우리 집 · 래미안 101동");
  });
  it("keeps a sub_name that adds information", () => {
    const area = { complexes: [], pois: [],
      buildings: [{ id: "b1", geometry: poly(127.1, 37.35),
        register: { name: "래미안", sub_name: "101동" } }] };
    assert.equal(homeTitle(area, "b1"), "우리 집 · 래미안 101동");
  });
  it("real B building reads once (skip when no build)", () => {
    const p = join(HERE, "..", "..", "data", "build", "st-미금", "area.json");
    if (!existsSync(p)) return;
    const area = JSON.parse(readFileSync(p, "utf8"));
    const b = (area.buildings || []).find((x) => x && x.id === "w465862686");
    assert.ok(b, "w465862686 present");
    assert.equal(homeTitle(area, "w465862686"), "우리 집 · 분당 엠코 헤리츠");
  });
});

function leg(line, pct, source, hasData) {
  return { lineName: line, from: "A", to: "B", minutes: 10,
    congestion: { line, valuePct: pct, source, hasData } };
}

function fourLegRun() {
  const trip = { id: "t", agent: "A", day: 0, purpose: "commute",
    depart_min: 460, arrive_min: 464, minutes: 4,
    from: { label: "집" }, to: { label: "역" } };
  const run = { meta: { days: 30 }, trips: [trip],
    aways: [{ agent: "A", day: 0, kind: "ride", start_min: 464, end_min: 504,
      detail: { rides: { out: {
        legs: [
          leg("9호선", 70, "가정값", false),
          leg("8호선", 100.1, "서울교통공사", true),
          leg("수인·분당선", 70, "가정값", false),
          leg("경강선", 70, "가정값", false),
        ],
        transfers: [], transferMinutes: 0 } } } }] };
  return { run, trip };
}

describe("36h2 crowding lines name their lines", () => {
  it("Korean assumed line lists assumed lines; measured line names its line", () => {
    const { run, trip } = fourLegRun();
    const lines = commuteLines(run, "A", trip, trip.depart_min);
    const assumed = lines.find((l) => l.text.includes("가정값이에요 (실측 없음)"));
    assert.equal(assumed.text, "9호선·수인·분당선·경강선 혼잡 70%는 가정값이에요 (실측 없음)");
    assert.equal(assumed.tag, "가정값");
    const measured = lines.find((l) => l.tag === "측정" && l.text.includes("실측이에요"));
    assert.equal(measured.text, "8호선 혼잡 100%는 서울교통공사 실측이에요");
  });
  it("English lines carry the same split", () => {
    const { run, trip } = fourLegRun();
    const lines = commuteLines(run, "A", trip, trip.depart_min, "en");
    const assumed = lines.find((l) => l.text.includes("is assumed (not measured)"));
    assert.ok(assumed, JSON.stringify(lines.map((l) => l.text)));
    assert.match(assumed.text, /^Crowding 70% on .+ is assumed \(not measured\)$/);
    const measured = lines.find((l) => l.text.includes("is measured (Seoul Metro)"));
    assert.ok(measured, JSON.stringify(lines.map((l) => l.text)));
    assert.match(measured.text, /^Crowding 100% on .+ is measured \(Seoul Metro\)$/);
    const stripNames = (t) => t.split("9호선").join("").split("수인·분당선").join("")
      .split("경강선").join("").split("8호선").join("");
    for (const l of lines) {
      assert.doesNotMatch(stripNames(l.text), /[가-힣]/, l.text);
    }
  });
  it("real A day-0 morning has both lines (skip when no build)", () => {
    const p = join(HERE, "..", "..", "data", "build", "sim", "demo-two-homes-A.json");
    if (!existsSync(p)) return;
    const run = JSON.parse(readFileSync(p, "utf8"));
    const cands = ((run && run.aways) || []).filter((a) => a && a.day === 0
      && a.kind === "ride" && (a.start_min ?? a.end_min ?? 0) < 720);
    const withBoth = cands.find((a) => {
      const legs = (((a.detail || {}).rides || {}).out || {}).legs
        || ((a.detail || {}).ride || {}).legs || [];
      return legs.some((l) => l && l.congestion && l.congestion.hasData === true)
        && legs.some((l) => l && l.congestion && l.congestion.hasData !== true);
    });
    assert.ok(withBoth, "a mixed day-0 morning ride exists");
    const lines = commuteLines(run, withBoth.agent, { day: 0 },
      withBoth.start_min ?? withBoth.end_min ?? 464);
    assert.ok(lines.some((l) => l.text.includes("가정값이에요 (실측 없음)")),
      JSON.stringify(lines.map((l) => l.text)));
    assert.ok(lines.some((l) => l.tag === "측정" && l.text.includes("실측이에요")),
      JSON.stringify(lines.map((l) => l.text)));
  });
});

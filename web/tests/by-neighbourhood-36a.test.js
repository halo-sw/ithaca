// Stage 36a — candidates compare neighbourhoods: one home per origin
// station, spread from near to far within the commute cap.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

register("./jsx-loader.mjs", import.meta.url);

import {
  find_homes, pickByNeighbourhood,
  DEFAULT_HOME_SORT, HOME_SORTS,
} from "../src/homes.js";
import { SYSTEM_PROMPT, ENGLISH_NOTE } from "../src/consult/agent.js";
import { emptyProfile, field } from "../src/profile.js";

let commuteRowLine;

before(async () => {
  ({ commuteRowLine } = await import("../src/ui/candidate-card.jsx"));
});

function row(id, station, walkMin, rideMin) {
  return {
    id,
    thin_deal: null,
    deals_in_bucket: 5,
    commute: {
      walk: { known: true, station, minutes: walkMin },
      ride: { known: true, minutes: rideMin, lines: ["수인·분당선"], transfers: [] },
      destStation: "판교",
    },
  };
}

// Totals to 판교: 5 / 12 / (14 same station) / 20 / 28 / 41 / 55,
// in commute order.
const SPREAD = [
  row("h5", "오리", 5, 0),
  row("h12", "미금", 7, 5),
  row("h12b", "미금", 9, 5),
  row("h20", "정자", 8, 12),
  row("h28", "수내", 10, 18),
  row("h41", "잠실", 7, 34),
  row("h55", "강남", 10, 45),
];

describe("36a pickByNeighbourhood spread", () => {
  it("picks 4 distinct stations from near to far, ends included", () => {
    const out = pickByNeighbourhood(SPREAD, 4, null);
    assert.equal(out.length, 4);
    const stations = out.map((r) => r.origin.station);
    assert.equal(new Set(stations).size, 4, `distinct: ${stations}`);
    assert.ok(stations.includes("오리"), "nearest origin kept");
    assert.ok(stations.includes("강남"), "farthest origin kept");
    assert.deepEqual(out.map((r) => r.commute_total_min), [5, 20, 28, 55]);
    for (const r of out) {
      assert.match(r.origin.label_ko, / → 판교$/);
    }
    assert.deepEqual(out.commute_cap, { minutes: 60, source: "default" });
  });

  it("keeps one home per origin (first in commute order)", () => {
    const out = pickByNeighbourhood(SPREAD, 6, null);
    assert.equal(out.length, 6);
    const stations = out.map((r) => r.origin.station);
    assert.equal(new Set(stations).size, 6);
    assert.ok(!out.some((r) => r.id === "h12b"), "second 미금 home dropped");
    const migeum = out.find((r) => r.origin.station === "미금");
    assert.equal(migeum.id, "h12");
    assert.equal(migeum.commute_total_min, 12);
    assert.equal(migeum.origin.label_ko, "미금 → 판교");
  });
});

describe("36a pickByNeighbourhood cap", () => {
  it("drops rows over a customer cap and marks the source", () => {
    const out = pickByNeighbourhood(SPREAD, 6, 30);
    assert.ok(out.length > 0);
    assert.ok(out.every((r) => r.commute_total_min <= 30),
      `minutes: ${out.map((r) => r.commute_total_min)}`);
    assert.deepEqual(out.commute_cap, { minutes: 30, source: "customer" });
  });
});

describe("36a pickByNeighbourhood without origins", () => {
  it("returns rows.slice(0, limit) unchanged for US-style rows", () => {
    const us = [0, 1, 2].map((i) => ({
      id: `u${i}`,
      thin_deal: null,
      commute: {
        walk: { known: false, station: null, minutes: null },
        ride: { known: false, minutes: null, lines: [], transfers: [] },
        destStation: null,
        work: { target: "meta", name: "Meta HQ", minutes: 12, mode: "bike",
          walk_minutes: 40, bike_minutes: 12, source: "assumed_speed" },
      },
    }));
    const out = pickByNeighbourhood(us, 2, null);
    assert.deepEqual(out, us.slice(0, 2));
    assert.equal(out.commute_cap, undefined);
  });
});

describe("36a areas is the default sort", () => {
  it("DEFAULT_HOME_SORT is areas and HOME_SORTS starts with areas", () => {
    assert.equal(DEFAULT_HOME_SORT, "areas");
    assert.equal(HOME_SORTS[0], "areas");
  });
});

describe("36a commuteRowLine with an origin", () => {
  const base = () => ({
    id: "c1",
    commute: {
      walk: { known: true, station: "잠실", minutes: 7 },
      ride: { known: true, minutes: 34, lines: [], transfers: [],
        derived: { methodsUsed: ["schedule"] } },
    },
  });

  it("starts with the origin pair when origin exists", () => {
    const cand = { ...base(),
      origin: { station: "잠실", dest: "판교", label_ko: "잠실 → 판교" } };
    const line = commuteRowLine(cand, "판교");
    assert.ok(line.text.startsWith("잠실 → 판교 총"),
      `card line: ${line.text}`);
    assert.ok(line.text.includes("잠실역 걸어서 7분 + 지하철 34분"),
      `card line: ${line.text}`);
  });

  it("keeps today's text without an origin", () => {
    const line = commuteRowLine(base(), "판교");
    assert.equal(line.text, "총 41분 · 잠실역 걸어서 7분 + 지하철 34분");
  });
});

describe("36a agent text names the 동네별 rule", () => {
  it("Korean and English instructions fix the workplace, vary the area", () => {
    const ko = Array.isArray(SYSTEM_PROMPT) ? SYSTEM_PROMPT.join("\n") : String(SYSTEM_PROMPT);
    assert.ok(ko.includes("find_homes 기본 정렬 '동네별'"), "Korean areas rule");
    assert.ok(ko.includes("잠실 → 판교 41분"), "Korean example pair");
    assert.ok(ENGLISH_NOTE.includes("one home per neighbourhood"),
      "English areas rule");
    assert.ok(ENGLISH_NOTE.includes("Jamsil → Pangyo 41 min"),
      "English example pair");
  });
});

describe("36a real data spreads across origins", () => {
  it("판교 매매 9억 gives at least 3 distinct origin stations", () => {
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
    const homesDir = join(ROOT, "data/build/homes");
    const netPath = join(ROOT, "data/build/region/network.json");
    let files = [];
    try {
      files = readdirSync(homesDir).filter((f) => f.endsWith(".json"));
    } catch {
      files = [];
    }
    if (files.length === 0 || !existsSync(netPath)) {
      console.log("  (skip: no local data/build)");
      return;
    }
    const homes = [];
    for (const f of files) {
      const doc = JSON.parse(readFileSync(join(homesDir, f), "utf8"));
      homes.push(...(doc.homes || []));
    }
    const network = JSON.parse(readFileSync(netPath, "utf8"));
    const p = emptyProfile();
    p.tenure = field("trade", "customer", "");
    p.priceMax = field(900000000, "customer", "");
    p.workplaces = field(
      [{ member: 0, text: "판교", resolved: { station: "판교" } }],
      "customer", "");
    const r = find_homes(p, { homes }, { network, limit: 6 });
    assert.equal(r.sort, "areas");
    const stations = new Set(r.candidates
      .map((c) => c.origin && c.origin.station).filter(Boolean));
    assert.ok(stations.size >= 3, `origins: ${[...stations].join(", ")}`);
  });
});

// Stage 36b — 동네별 candidate fixes: buying-verb price cap, ridable
// origins only, workplace never a live-in region.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extract_profile, emptyProfile, field } from "../src/profile.js";
import { pickByNeighbourhood } from "../src/homes.js";
import { SEARCH_HANDLERS } from "../src/consult/tools-search.js";
import { parseInterstationCsv } from "../src/transit/schedule.js";

const STATIONS = ["강남", "판교", "잠실", "미금", "정자", "서현", "수내", "모란", "오리"];
const SENTENCE = "예비부부예요. 둘 다 판교로 출근해요. 모은 돈 3억, 9억 이하로 집을 사고 싶어요.";

describe("36b buying-verb price anchor", () => {
  it("verbs anchor priceMax, keep cash cash, set trade tenure", () => {
    const { profile, ok, errors } = extract_profile(SENTENCE, null, { stations: STATIONS });
    assert.equal(ok, true, JSON.stringify(errors));
    assert.equal(profile.priceMax.value, 900000000);
    assert.equal(profile.cash.value, 300000000);
    assert.equal(profile.tenure.value, "trade");
    assert.equal(profile.tenure.source, "customer");
  });

  it("살 집 alone never anchors a price", () => {
    const { profile } = extract_profile("혼자 살 집 찾아 줘, 모은 돈 1억",
      null, { stations: STATIONS });
    assert.equal(profile.priceMax.value, null);
  });

  it("매매 still anchors", () => {
    const { profile } = extract_profile("강남 출근, 매매 9억 이하",
      null, { stations: STATIONS });
    assert.equal(profile.priceMax.value, 900000000);
  });
});

describe("36b origins must ride", () => {
  function row(id, station, walkMin, rideKnown, rideMin) {
    return {
      id,
      thin_deal: null,
      deals_in_bucket: 5,
      commute: {
        walk: { known: true, station, minutes: walkMin },
        ride: rideKnown
          ? { known: true, minutes: rideMin, lines: ["수인·분당선"], transfers: [] }
          : { known: false, minutes: null, lines: [], transfers: [] },
        destStation: "판교",
      },
    };
  }

  it("leaves out a walk-only terminal row", () => {
    const rows = [
      row("hx", "X터미널", 2, false, null),
      row("h1", "미금", 7, true, 5),
      row("h2", "정자", 8, true, 12),
      row("h3", "수내", 10, true, 18),
    ];
    const out = pickByNeighbourhood(rows, 6, null);
    const stations = out.map((r) => r.origin.station);
    assert.ok(!stations.includes("X터미널"), `origins: ${stations}`);
    assert.equal(new Set(stations).size, 3);
  });
});

describe("36b workplace is not a region", () => {
  function tradeBucket(center, median) {
    return {
      center_m2: center, range_m2: [center - 5, center + 5],
      trade: { count: 8, median_won: median, min_won: median - 50000000, max_won: median + 50000000 },
      jeonse: null,
      wolse: null,
    };
  }

  const HOMES = {
    homes: [
      { id: "home-000001", name: "분당집", kind: "아파트", region: "bundang",
        lon: 127.1, lat: 37.39, build_year: 2010,
        buckets: [tradeBucket(60, 600000000)],
        station: { station: "정자", walk_minutes: 8, source: "graph" },
        scene: null, photos_700m: 0 },
      { id: "home-000002", name: "송파집", kind: "아파트", region: "songpa-gu",
        lon: 127.12, lat: 37.5, build_year: 2012,
        buckets: [tradeBucket(60, 600000000)],
        station: { station: "잠실", walk_minutes: 7, source: "graph" },
        scene: null, photos_700m: 0 },
    ],
  };

  const NETWORK = {
    lines: [{
      id: "bundang", name: "수인·분당선",
      stops: [
        { id: "s1", key: "정자", name: "정자" },
        { id: "s2", key: "판교", name: "판교" },
        { id: "s3", key: "잠실", name: "잠실" },
      ],
      patterns: [{ id: "p1", stops: ["s1", "s2", "s3"], chainage_km: [0, 2.0, 10.0] }],
    }],
  };

  function profile() {
    const p = emptyProfile();
    p.workplaces = field([{ member: 0, text: "판교", resolved: { station: "판교" } }],
      "customer", "");
    p.tenure = field("trade", "customer", "");
    p.priceMax = field(900000000, "customer", "");
    return p;
  }

  function session() {
    return {
      context: {},
      loadHomes: async () => HOMES,
      loadRegion: async () => ({ network: NETWORK, congestion: null }),
      loadTransit: async () => null,
    };
  }

  it("drops a workplace region and searches all regions", async () => {
    const r = await SEARCH_HANDLERS.find_homes(session(),
      { profile: profile(), regions: ["판교"] });
    assert.equal(r.ok, true);
    assert.ok((r.regions_ignored || []).includes("판교"),
      `regions_ignored: ${JSON.stringify(r.regions_ignored)}`);
    assert.equal(r.asked_for.regions, "all");
  });

  it("keeps a real live-in region", async () => {
    const r = await SEARCH_HANDLERS.find_homes(session(),
      { profile: profile(), regions: ["잠실"] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.asked_for.regions, ["songpa-gu"]);
    assert.equal("regions_ignored" in r, false);
  });
});

describe("36b real data caps price and spreads origins", () => {
  it("server path: all ≤ 9억, ≥ 3 origins, no 터미널/KCAT", async () => {
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const homesPath = join(ROOT, "data/build/homes-index.json");
    const netPath = join(ROOT, "data/build/region/network.json");
    if (!existsSync(homesPath) || !existsSync(netPath)) {
      console.log("  (skip: no local data/build)");
      return;
    }
    const index = JSON.parse(readFileSync(homesPath, "utf8"));
    const network = JSON.parse(readFileSync(netPath, "utf8"));
    const schedPath = join(ROOT, "scenarios", "transit", "seoul-metro-interstation.csv");
    if (!existsSync(schedPath)) {
      console.log("  (skip: no transit schedule)");
      return;
    }
    const schedule = parseInterstationCsv(readFileSync(schedPath, "utf8"));
    const session = {
      context: {},
      loadHomes: async () => index,
      loadRegion: async () => ({ network, congestion: null }),
      loadTransit: async () => schedule,
    };
    const ex = await SEARCH_HANDLERS.extract_profile(session, { text: SENTENCE });
    assert.equal(ex.ok, true);
    const r = await SEARCH_HANDLERS.find_homes(session, { profile: ex.profile });
    assert.equal(r.ok, true);
    assert.ok(r.candidates.length > 0, "has candidates");
    for (const c of r.candidates) {
      for (const t of c.tenures) {
        assert.ok(t.median_won <= 900000000,
          `${c.id} median ${t.median_won}`);
      }
      const label = c.origin ? `${c.origin.station} ${c.origin.label_ko}` : "";
      assert.ok(!label.includes("터미널") && !label.includes("KCAT"),
        `origin: ${label}`);
    }
    const stations = new Set(r.candidates
      .map((c) => c.origin && c.origin.station).filter(Boolean));
    assert.ok(stations.size >= 3, `origins: ${[...stations].join(", ")}`);
  });
});

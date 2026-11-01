import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { find_homes } from "../src/homes.js";
import { field, emptyProfile } from "../src/profile.js";

function bucket(center, trade, jeonse, wolse) {
  const stat = (count, median, min, max) => count === null ? null
    : { count, median_won: median, min_won: min, max_won: max };
  return {
    center_m2: center, range_m2: [center - 5, center + 5],
    trade: trade ? stat(...trade) : null,
    jeonse: jeonse ? stat(...jeonse) : null,
    wolse: wolse ? {
      count: wolse.count,
      deposit: wolse.deposit ? stat(wolse.count, ...wolse.deposit) : null,
      monthly: wolse.monthly ? stat(wolse.count, ...wolse.monthly) : null,
    } : null,
  };
}

function home(over = {}) {
  return {
    id: "home-000001", name: "테스트아파트", kind: "아파트",
    region: "bundang", lon: 127.1, lat: 37.39, build_year: 2010,
    buckets: [bucket(60, [8, 600000000, 550000000, 650000000],
      [5, 300000000, 280000000, 320000000], null)],
    station: { station: "정자", walk_minutes: 8, source: "graph" },
    scene: "st-정자", photos_700m: 3,
    ...over,
  };
}

function profile(over = {}) {
  const p = emptyProfile();
  p.tenure = field("jeonse", "customer", "");
  p.depositMax = field(500000000, "customer", "");
  for (const [k, v] of Object.entries(over)) p[k] = v;
  return p;
}

function candidatesOf(res) {
  if (Array.isArray(res)) return res;
  return res.candidates || res.rows || res.homes;
}

describe("homes address 39c2", () => {
  it("carries address through to the candidate", () => {
    const address = { road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" };
    const res = find_homes(profile(), { homes: [home({ address })] });
    const cands = candidatesOf(res);
    assert.equal(cands.length, 1);
    assert.deepEqual(cands[0].address, address);
  });

  it("omits the address key when the home has none", () => {
    const res = find_homes(profile(), { homes: [home()] });
    const cands = candidatesOf(res);
    assert.equal(cands.length, 1);
    assert.ok(!("address" in cands[0]));
  });
});

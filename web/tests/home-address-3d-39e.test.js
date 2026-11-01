import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { emptyProfile, field, scenarioFromProfile } from "../src/profile.js";
import { labelBoxW, labelItemsFor } from "../src/labels3d.js";

const s = 0.0002;
const area = {
  complexes: [],
  buildings: [{
    id: "b1",
    geometry: { type: "Polygon", coordinates: [[[127.1, 37.35], [127.1 + s, 37.35], [127.1 + s, 37.35 + s], [127.1, 37.35 + s], [127.1, 37.35]]] },
  }],
  pois: [],
};
const ADDR = { road: "천호대로157길 45", sigungu: "서울특별시 강동구" };
const ADDR_EN = "45 Cheonho-daero 157-gil, Gangdong-gu, Seoul";

const profile = () => {
  const p = emptyProfile();
  p.members = field([{ role: "adult" }], "customer", "");
  p.workplaces = field([{ member: 0, text: "판교", resolved: { station: "판교" } }],
    "customer", "");
  return p;
};

describe("39e scenarioFromProfile keeps the road-name address", () => {
  it("copies address when the picked home carries one", () => {
    const homes = [{
      id: "home-000001", name: "집home-000001", pnu: "pnuhome-000001",
      scene: "st-정자", station: { station: "정자", walk_minutes: 8 },
      address: { ...ADDR },
    }];
    const sc = scenarioFromProfile(profile(), homes);
    assert.deepEqual(sc.homes[0].address, ADDR);
  });

  it("adds no address key when the picked home has none", () => {
    const homes = [{
      id: "home-000001", name: "집home-000001", pnu: "pnuhome-000001",
      scene: "st-정자", station: { station: "정자", walk_minutes: 8 },
    }];
    const sc = scenarioFromProfile(profile(), homes);
    assert.ok(!("address" in sc.homes[0]));
  });
});

describe("39e 3D home pill road-name address", () => {
  it("home item carries sub and subEn", () => {
    const items = labelItemsFor(area, {
      homeBuildingId: "b1",
      homeCandidate: { address: { ...ADDR } },
      cameraDistM: 100,
    });
    assert.equal(items[0].sub, "천호대로157길 45");
    assert.equal(items[0].subEn, ADDR_EN);
  });

  it("english box width covers the english sub", () => {
    const w = labelBoxW("우리 집 · X", "en", { sub: ADDR.road, subEn: ADDR_EN });
    const subOnly = labelBoxW("", "en", { sub: ADDR.road, subEn: ADDR_EN });
    assert.ok(w >= subOnly);
    assert.ok(w >= ADDR_EN.length * 7.5 + 24);
  });

  it("main.js painter shows the home sub line (source pin)", () => {
    const src = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
    assert.ok(src.includes("home:") && src.includes("subEn"),
      "painter sub condition mentions home: and subEn");
    assert.ok(src.includes("data-no-i18n"), "english sub is marked data-no-i18n");
    assert.ok(src.includes("homeCandidate"), "paintLabels20b passes homeCandidate");
  });
});

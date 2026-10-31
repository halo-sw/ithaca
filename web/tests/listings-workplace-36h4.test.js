// 36h4: public rentals measure distance from the real workplace (판교),
// not the home boarding station (work.station_name).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkplace, workplaceNote } from "../scripts/money.mjs";

const WEB = dirname(fileURLToPath(new URL(".", import.meta.url)));
const REPO = join(WEB, "..");

describe("resolveWorkplace (36h4)", () => {
  it("prefers work.place with finite lon/lat", () => {
    const scenario = { household: { members: [{ work: {
      place: { name: "직장 (가정: 판교역 인근)", lon: 127.111187, lat: 37.394364 },
      destination_station: "송파나루",
      station_name: "송파나루",
    } }] } };
    const got = resolveWorkplace(scenario, {}, null);
    assert.equal(got.label, "직장 (가정: 판교역 인근)");
    assert.equal(got.lon, 127.111187);
    assert.equal(got.lat, 37.394364);
    assert.equal(got.area, null);
  });

  it("falls back to destination_station via the region network", () => {
    const scenario = { household: { members: [{ work: {
      destination_station: "판교",
      station_name: "송파나루",
    } }] } };
    const network = { lines: [{ stops: [{ name: "판교", lon: 127.1, lat: 37.39 }] }] };
    const got = resolveWorkplace(scenario, {}, network);
    assert.equal(got.label, "판교역");
    assert.equal(got.lon, 127.1);
    assert.equal(got.lat, 37.39);
  });

  it("never uses station_name alone", () => {
    const scenario = { household: { members: [{ work: {
      station_name: "송파나루",
    } }] } };
    assert.equal(resolveWorkplace(scenario, {}, null), null);
    assert.equal(workplaceNote(null), "직장 위치를 찾지 못해서 거리를 재지 못했어요.");
  });

  it("avoids double parenthesis for place labels", () => {
    const note = workplaceNote({ label: "직장 (가정: 판교역 인근)" });
    assert.ok(note.startsWith("직장 위치("));
    assert.ok(!note.includes("직장(직장"));
    assert.equal(workplaceNote({ label: "판교역" }),
      "직장(판교역)에서 직선 거리예요. 출퇴근 시간은 아니에요.");
  });
});

describe("demo scenario (36h4, real build)", () => {
  it("resolves to 판교, not 송파나루", async (t) => {
    let scenarioRaw;
    let network;
    try {
      scenarioRaw = JSON.parse(await readFile(
        join(REPO, "scenarios", "demo-two-homes.json"), "utf8"));
      network = JSON.parse(await readFile(
        join(REPO, "data", "build", "region", "network.json"), "utf8"));
    } catch {
      t.skip("missing data/build/region/network.json or scenarios/demo-two-homes.json");
      return;
    }
    const got = resolveWorkplace(scenarioRaw, {}, network);
    assert.equal(got.lon, 127.111187);
    assert.equal(got.lat, 37.394364);
    const note = workplaceNote(got);
    assert.ok(note.includes("판교"));
    assert.ok(!note.includes("송파나루"));
  });
});

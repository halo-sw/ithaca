// 47k: combined households keep combined report coverage (pure, node --test).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadGroundTruth } from "../src/verify/checklist.js";
import { personaFor, personaKeysFor, reportDigest,
  verifyComparison } from "../src/verify/compare.js";
import { verifyReport } from "../src/verify/loop.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));

// Household: 2 adults + child + senior + dog; adult m1 works from home.
const PROFILE = {
  members: [
    { id: "m1", role: "adult", home_office: true },
    { id: "m2", role: "adult" },
    { id: "c1", role: "child", school: { mode: "nearby", level: "elementary" } },
    { id: "s1", role: "senior" },
  ],
  officeDays: 5,
  pets: { kind: "dog", count: 1 },
};
const SCEN = {
  members: PROFILE.members,
  life_plan: { confirmed: true,
    observation_codes: ["commute", "school", "remote_days", "clinic", "pet_care"] },
};

function cmpRun(prefix) {
  return {
    meta: { start_date: "2026-11-01", area: "seoul-x" },
    agents: [
      { key: "m1", household: true }, { key: "m2", household: true },
      { key: "c1", household: true }, { key: "s1", household: true },
    ],
    trips: [
      { id: `${prefix}-am1`, agent: "m1", day: 11, purpose: "commute",
        minutes: 30, depart_min: 480,
        from: { kind: "home", label: "집" }, to: { kind: "work", label: "일터" } },
      { id: `${prefix}-late`, agent: "m1", day: 12, purpose: "commute",
        minutes: 13, depart_min: 1347, arrive_min: 1360,
        from: { kind: "work", label: "일터" }, to: { kind: "home", label: "집" } },
      { id: `${prefix}-am2`, agent: "m2", day: 11, purpose: "commute",
        minutes: 25, depart_min: 480,
        from: { kind: "home", label: "집" }, to: { kind: "work", label: "일터" } },
    ],
    aways: [],
    decisions: [],
  };
}
const HOME = { monthly_won: 500000, maintenance_won_month: 100000,
  utilities_won_month: 50000 };

describe("47k compositional persona", () => {
  it("combined family+remote+pet+senior keeps every family", () => {
    const keys = personaKeysFor(PROFILE, SCEN);
    assert.deepEqual(keys, ["multigen_family", "newlywed_couple",
      "pet_owner", "remote_worker", "young_family"]);
    assert.equal(personaFor(PROFILE, { scenario: SCEN }),
      "combined:multigen_family+newlywed_couple+pet_owner+remote_worker+young_family");
  });
  it("single key returns the ordinary key", () => {
    const solo = { members: [{ id: "m1", role: "adult" }] };
    assert.equal(personaFor(solo,
      { scenario: { life_plan: { confirmed: true, observation_codes: [] } } }),
      "single_firstjob");
  });
  it("legacy single-winner unchanged without scenario", () => {
    const legacy = { members: [{ role: "child" }, { role: "adult" }],
      officeDays: 2, pets: { kind: "dog", count: 1 } };
    assert.equal(personaFor(legacy), "young_family");
    assert.equal(personaFor({ members: [{ role: "adult" }] }), "single_firstjob");
    assert.equal(personaFor({ members: [{ role: "adult" }, { role: "adult" }] }),
      "newlywed_couple");
  });
});

describe("47k combined ground truth", () => {
  const persona = "combined:multigen_family+newlywed_couple+pet_owner+remote_worker+young_family";
  it("retains unique F/R/P/M/N ids and common items once", () => {
    const loaded = loadGroundTruth(GT, persona);
    const ids = loaded.items.map((it) => it.id);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ["F01", "R04", "P02", "M02", "N01"]) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
    assert.equal(ids.filter((id) => id === "C01").length, 1);
    assert.equal(ids.filter((id) => id.startsWith("C")).length, 9);
  });
  it("drops no persona: union covers every part", () => {
    const loaded = loadGroundTruth(GT, persona);
    const ids = new Set(loaded.items.map((it) => it.id));
    for (const k of ["multigen_family", "newlywed_couple", "pet_owner",
      "remote_worker", "young_family"]) {
      for (const it of GT.personas[k].items) assert.ok(ids.has(it.id));
    }
  });
  it("keeps engine:none items as unsupported, never zeroed", () => {
    const loaded = loadGroundTruth(GT, persona);
    const byId = new Map(loaded.items.map((it) => [it.id, it]));
    assert.equal(byId.get("F02").engine, "none");
    assert.equal(byId.get("R01").engine, "none");
    const res = verifyReport({ persona, sentences: [] }, cmpRun("z"), loaded,
      { groundTruth: GT });
    assert.equal(res.pass, false);
    const unsup = res.unsupported.map((u) => u.item_id);
    assert.ok(unsup.includes("F02") && unsup.includes("R01"));
  });
  it("malformed combined keys fail", () => {
    for (const bad of ["combined:", "combined:unknown", "combined:young_family+",
      "combined:young_family++pet_owner",
      "combined:young_family+young_family",
      "combined:young_family+remote_worker+newlywed_couple+multigen_family+pet_owner+single_firstjob+extra"]) {
      assert.throws(() => loadGroundTruth(GT, bad), /unknown|too many/i);
    }
  });
});

describe("47k digest and judge with combined", () => {
  const persona = "combined:multigen_family+newlywed_couple+pet_owner+remote_worker+young_family";
  it("digest holds school, cafe and clinic items together", () => {
    const runs = { A: cmpRun("a"), B: cmpRun("b") };
    const d = reportDigest({ runs, labels: ["A", "B"],
      homes: { A: HOME, B: HOME }, persona, groundTruth: GT });
    assert.equal(d.unsupported, false);
    const ids = d.items.map((it) => it.id);
    assert.ok(ids.includes("F01") && ids.includes("N01"));
    assert.ok(ids.includes("R04") && ids.includes("M02"));
  });
  it("fail-closed judge behavior unchanged with combined", async () => {
    const runs = { A: cmpRun("a"), B: cmpRun("b") };
    const report = { persona, sentences: [] };
    const res = await verifyComparison(report, { runs, labels: ["A", "B"],
      homes: { A: HOME, B: HOME }, persona, groundTruth: GT });
    assert.equal(res.pass, false);
    assert.equal(res.status, "failed");
    assert.ok(res.by_home.A.unsupported.length > 0);
  });
});

describe("47m production-shaped members count once", () => {
  it("one id-less adult plus scenario member stays single", () => {
    const keys = personaKeysFor({ members: [{ role: "adult" }] },
      { members: [{ id: "m1", role: "adult" }],
        life_plan: { confirmed: true, observation_codes: [] } });
    assert.deepEqual(keys, ["single_firstjob"]);
  });
  it("two adults remain a couple", () => {
    const keys = personaKeysFor({ members: [{ role: "adult" }, { role: "adult" }] },
      { members: [{ id: "m1", role: "adult" }, { id: "m2", role: "adult" }],
        life_plan: { confirmed: true, observation_codes: [] } });
    assert.deepEqual(keys, ["newlywed_couple"]);
  });
  it("one adult plus child is not a couple", () => {
    const keys = personaKeysFor(
      { members: [{ role: "adult" }, { role: "child", school: true }] },
      { members: [{ id: "m1", role: "adult" }, { id: "m2", role: "child", school: true }],
        life_plan: { confirmed: true, observation_codes: ["school"] } });
    assert.ok(!keys.includes("newlywed_couple"));
    assert.ok(keys.includes("single_firstjob") && keys.includes("young_family"));
  });
  it("mixed four-person keeps family, remote and pet keys", () => {
    const keys = personaKeysFor(
      { members: [{ role: "adult", home_office: true }, { role: "adult" },
        { role: "child", school: true }, { role: "senior" }],
        pets: { kind: "dog", count: 1 } },
      { members: [{ id: "m1", role: "adult", home_office: true },
        { id: "m2", role: "adult" }, { id: "c1", role: "child", school: true },
        { id: "s1", role: "senior" }],
        life_plan: { confirmed: true,
          observation_codes: ["commute", "school", "remote_days", "clinic", "pet_care"] } });
    for (const k of ["multigen_family", "newlywed_couple", "pet_owner",
      "remote_worker", "young_family"]) {
      assert.ok(keys.includes(k), `missing ${k}: ${keys}`);
    }
  });

  it("47l2 production household shape counts once and carries remote", () => {
    const nested = (members, codes = []) => ({ household: { members },
      life_plan: { confirmed: true, observation_codes: codes } });
    // Id-less profile adult + nested one adult: no double count.
    assert.deepEqual(
      personaKeysFor({ members: [{ role: "adult" }] },
        nested([{ id: "m1", role: "adult" }])),
      ["single_firstjob"]);
    // Confirmed home_office change in SCENARIO triggers remote coverage
    // even when the base profile has no home_office.
    const keys = personaKeysFor(
      { members: [{ role: "adult" }, { role: "adult" }] },
      nested([{ id: "m1", role: "adult", home_office: true },
        { id: "m2", role: "adult" }], ["remote_days"]));
    assert.ok(keys.includes("remote_worker"), `missing remote: ${keys}`);
    assert.ok(keys.includes("newlywed_couple"), `missing couple: ${keys}`);
  });
});

// Stage 38e: work-from-home, three-generation and dog-owning households.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  emptyProfile, extract_profile, field, guardProfileValues,
  scenarioFromProfile, runGate,
} from "../src/profile.js";
import { personaFor } from "../src/verify/compare.js";
import { verifyReport } from "../src/verify/loop.js";
import { loadGroundTruth } from "../src/verify/checklist.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));
const STATIONS = ["판교", "Gangnam"];

const roles = (r) => r.profile.members.value.map((m) => m.role);

describe("38e seniors", () => {
  it("reads cohabiting parents as two seniors after the adults", () => {
    const r = extract_profile("맞벌이 부부인데 부모님 모시고 살아요. 판교로 출근해요",
      null, { stations: STATIONS });
    assert.deepEqual(roles(r), ["adult", "adult", "senior", "senior"]);
    assert.deepEqual(guardProfileValues(r.profile,
      "맞벌이 부부인데 부모님 모시고 살아요. 판교로 출근해요"), []);
  });
  it("adds nobody for parents living nearby", () => {
    const r = extract_profile("부모님 댁 근처로 이사 가고 싶어요",
      null, { stations: STATIONS });
    assert.equal(r.profile.members.value, null);
  });
  it("reads English live-with mother as one senior", () => {
    const text = "My wife and I live with my mother. We work in Gangnam.";
    const r = extract_profile(text, null, { stations: STATIONS });
    assert.deepEqual(roles(r), ["adult", "adult", "senior"]);
    assert.deepEqual(guardProfileValues(r.profile, text), []);
  });
});

describe("38e officeDays", () => {
  it("reads N-day office cues, remote words and the 5-day null", () => {
    const t2 = "주 2일 출근하는 1인 가구예요. 판교로 출근";
    const r2 = extract_profile(t2, null, { stations: STATIONS });
    assert.equal(r2.profile.officeDays.value, 2);
    assert.deepEqual(guardProfileValues(r2.profile, t2), []);
    const remote = "풀재택이에요";
    const rr = extract_profile(remote, null, { stations: STATIONS });
    assert.equal(rr.profile.officeDays.value, 0);
    assert.deepEqual(guardProfileValues(rr.profile, remote), []);
    const en = "I work from home";
    const re = extract_profile(en, null, { stations: STATIONS });
    assert.equal(re.profile.officeDays.value, 0);
    assert.deepEqual(guardProfileValues(re.profile, en), []);
    const five = "주 5일 출근";
    const r5 = extract_profile(five, null, { stations: STATIONS });
    assert.equal(r5.profile.officeDays.value, null);
  });
});

describe("38e pets", () => {
  it("reads dog, two cats and the English dog", () => {
    const dog = "강아지 한 마리 키워요";
    const rd = extract_profile(dog, null, { stations: STATIONS });
    assert.deepEqual(rd.profile.pets.value, { kind: "dog", count: 1 });
    assert.deepEqual(guardProfileValues(rd.profile, dog), []);
    const cats = "고양이 두 마리";
    const rc = extract_profile(cats, null, { stations: STATIONS });
    assert.deepEqual(rc.profile.pets.value, { kind: "cat", count: 2 });
    assert.deepEqual(guardProfileValues(rc.profile, cats), []);
    const en = "We have a dog";
    const re = extract_profile(en, null, { stations: STATIONS });
    assert.deepEqual(re.profile.pets.value, { kind: "dog", count: 1 });
    assert.deepEqual(guardProfileValues(re.profile, en), []);
  });
});

describe("38e scenarioFromProfile", () => {
  const profile = () => {
    const p = emptyProfile();
    p.members = field([{ role: "adult" }], "customer", "");
    p.workplaces = field([{ member: 0, text: "판교", resolved: { station: "판교" } }],
      "customer", "");
    return p;
  };
  const home = (id, scene, station) => ({
    id, name: `집${id}`, pnu: `pnu${id}`, scene,
    station: station ? { station, walk_minutes: 8 } : null,
  });
  const homes = [home("home-000001", "st-정자", "정자")];

  it("maps officeDays 2 to Tue/Thu plus cafe trips", () => {
    const p = profile();
    p.officeDays = field(2, "customer", "");
    const sc = scenarioFromProfile(p, homes);
    assert.deepEqual(sc.household.members[0].workdays, ["Tue", "Thu"]);
    assert.equal(sc.household.members[0].cafe_visits_per_week, 2);
  });
  it("gives seniors daily park walks and monthly clinic, never a commute", () => {
    const p = profile();
    p.members = field([{ role: "adult" }, { role: "adult" },
      { role: "senior", relation: "부모", label: "부모님" },
      { role: "senior", relation: "부모", label: "부모님" }], "customer", "");
    const sc = scenarioFromProfile(p, homes);
    const senior = sc.household.members[2];
    assert.equal(senior.role, "senior");
    assert.equal(senior.work.type, "none");
    assert.equal(senior.park_walks_per_week, 7);
    assert.equal(senior.clinic_visits_per_month, 2);
  });
  it("gives the first adult the morning dog walk and a vet visit", () => {
    const p = profile();
    p.pets = field({ kind: "dog", count: 1 }, "customer", "");
    const sc = scenarioFromProfile(p, homes);
    assert.equal(sc.household.members[0].dog_walk_morning, true);
    assert.equal(sc.household.members[0].vet_visits_per_month, 1);
  });
  it("treats officeDays 0 as home office, no workplace needed", () => {
    const p = profile();
    p.officeDays = field(0, "customer", "");
    const sc = scenarioFromProfile(p, homes);
    assert.equal(sc.household.members[0].home_office, true);
    const gateOnly = emptyProfile();
    gateOnly.officeDays = field(0, "customer", "");
    assert.deepEqual(runGate(gateOnly), { ok: true, noCommute: true });
  });
});

describe("38e personaFor", () => {
  const adult = { role: "adult" };
  it("orders child over remote over senior over pet", () => {
    assert.equal(personaFor({ members: [adult, adult], officeDays: { value: 2 } }),
      "remote_worker");
    assert.equal(personaFor({ members: [adult, adult,
      { role: "senior" }, { role: "senior" }] }), "multigen_family");
    assert.equal(personaFor({ members: [adult, adult],
      pets: { value: { kind: "dog", count: 1 } } }), "pet_owner");
    assert.equal(personaFor({ members: [adult, { role: "child" }],
      pets: { value: { kind: "dog", count: 1 } } }), "young_family");
  });
});

describe("38e ground truth", () => {
  it("maps every persona and ships runnable templates", () => {
    for (const [key, path] of Object.entries(GT.persona_map)) {
      assert.notEqual(path, null, key);
    }
    for (const file of ["scenarios/personas/remote-worker.json",
      "scenarios/personas/multigen-family.json",
      "scenarios/personas/pet-owner.json"]) {
      const doc = JSON.parse(readFileSync(join(HERE, "..", "..", file), "utf-8"));
      assert.ok(Array.isArray(doc.household.members)
        && doc.household.members.length > 0, file);
    }
  });
  it("verifies pet_owner park and vet trips instead of 미지원", () => {
    const run = {
      agents: [{ key: "m1", household: true }],
      trips: [
        { id: "t1", agent: "m1", day: 0, purpose: "park", minutes: 8 },
        { id: "t2", agent: "m1", day: 1, purpose: "vet", minutes: 12 },
      ],
      aways: [],
    };
    const home = { monthly_won: 500000, maintenance_won_month: 100000,
      utilities_won_month: 50000 };
    const min = (value) => ({ field: "minutes", value, unit: "분" });
    const report = { persona: "pet_owner", home,
      sentences: [
        { id: "s1", text_ko: "산책로는 8분 거리예요", item_id: "P02",
          claims: [min(8)], evidence: [] },
        { id: "s2", text_ko: "동물병원은 12분 거리예요", item_id: "P04",
          claims: [min(12)], evidence: [] },
      ] };
    const loaded = loadGroundTruth(GT, "pet_owner");
    assert.equal(loaded.persona, "pet_owner");
    const res = verifyReport(report, run, "pet_owner", { groundTruth: GT });
    assert.notEqual(res.status, "미지원");
    assert.deepEqual(res.failures.filter((f) =>
      f.item_id === "P02" || f.item_id === "P04"), []);
  });
});

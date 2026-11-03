// 44a: explicit four-person family (two working parents + two schoolchildren).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extract_profile, guardProfileValues, scenarioFromProfile,
  memberLabelEn, memberLabelKo, memberLabelFor,
} from "../src/profile.js";
import { parseScenario } from "../src/engine/scenario.js";

const STATIONS = ["강남", "잠실", "판교", "선릉", "역삼", "정자"];
const KO = "맞벌이 부부와 초등학생 자녀 두 명인 4인 가족입니다. 판교로 출근합니다.";
const EN = "We are a family of four: two working parents and two elementary-school children. We work in Pangyo.";
const homes = [
  { id: "home-000001", name: "집1", pnu: "pnu1", scene: "st-정자", station: { station: "정자", walk_minutes: 8 } },
];

function roles(members) {
  return members.map((m) => m.role);
}

describe("44a explicit four-person family", () => {
  it("KO: 2 adults + 2 schoolchildren, clean guard", () => {
    const r = extract_profile(KO, null, { stations: STATIONS });
    assert.deepEqual(roles(r.profile.members.value), ["adult", "adult", "child", "child"]);
    for (const m of r.profile.members.value.filter((m) => m.role === "child")) {
      assert.equal(m.school, true);
    }
    assert.deepEqual(guardProfileValues(r.profile, KO), []);
  });

  it("EN: same counts, verbatim evidence, school true", () => {
    const r = extract_profile(EN, null, { stations: STATIONS });
    assert.deepEqual(roles(r.profile.members.value), ["adult", "adult", "child", "child"]);
    for (const m of r.profile.members.value.filter((m) => m.role === "child")) {
      assert.equal(m.school, true);
    }
    assert.deepEqual(guardProfileValues(r.profile, EN), []);
    const ev = r.profile.members.evidence;
    for (const part of ev.split("·")) {
      assert.ok(EN.includes(part), `evidence ${JSON.stringify(ev)} not verbatim`);
    }
    assert.ok(/two working parents/i.test(ev));
    assert.ok(/two elementary-school children/i.test(ev));
  });

  it("lone parents keep 1 adult + 2 children", () => {
    const a = extract_profile("I live alone with two children.", null, { stations: STATIONS });
    assert.deepEqual(roles(a.profile.members.value), ["adult", "child", "child"]);
    const b = extract_profile("혼자 아이 두 명을 키워요", null, { stations: STATIONS });
    assert.deepEqual(roles(b.profile.members.value), ["adult", "child", "child"]);
  });

  it("a bare family of four implies nothing", () => {
    const r = extract_profile("We are a family of four.", null, { stations: STATIONS });
    assert.equal(r.profile.members.value, null);
  });

  it("toddler/baby gains no school flag", () => {
    const ko = extract_profile("신혼부부와 돌쟁이 아기가 함께 살아요", null, { stations: STATIONS });
    const koKids = ko.profile.members.value.filter((m) => m.role === "child");
    assert.equal(koKids.length, 1);
    assert.notEqual(koKids[0].school, true);
    const en = extract_profile("We're a married couple with a toddler and we work in Pangyo.",
      null, { stations: STATIONS });
    const enKids = en.profile.members.value.filter((m) => m.role === "child");
    assert.equal(enKids.length, 1);
    assert.notEqual(enKids[0].school, true);
    const sc = scenarioFromProfile(en.profile, homes);
    const kids = sc.household.members.filter((m) => m.role === "child");
    assert.equal(kids.length, 1);
    assert.notEqual(kids[0].school, true);
    const parsed = parseScenario(sc);
    const pk = parsed.household.members.filter((m) => m.role === "child");
    assert.equal(pk[0].school, false);
  });

  it("scenario + parse retain school flags and distinct labels", () => {
    const r = extract_profile(KO, null, { stations: STATIONS });
    const sc = scenarioFromProfile(r.profile, homes);
    const kids = sc.household.members.filter((m) => m.role === "child");
    assert.equal(kids.length, 2);
    assert.deepEqual(kids.map((m) => m.label), ["아이 1", "아이 2"]);
    for (const k of kids) {
      assert.deepEqual(k.school, { mode: "unresolved", level: "unknown" });
      assert.equal(k.work.type, "none");
      assert.deepEqual(k.schooldays, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    }
    const parsed = parseScenario(sc);
    const pk = parsed.household.members.filter((m) => m.role === "child");
    assert.equal(pk.length, 2);
    assert.deepEqual(pk.map((m) => m.label), ["아이 1", "아이 2"]);
    for (const k of pk) assert.deepEqual(k.school, { mode: "unresolved", level: "unknown" });
  });

  it("explicit child label wins; single child keeps 아이", () => {
    assert.equal(memberLabelFor({ role: "child" }, 2), "아이");
    assert.equal(memberLabelEn("아이"), "Your child");
    assert.equal(memberLabelEn("아이 1"), "Your child 1");
    assert.equal(memberLabelKo("Your child 2"), "아이 2");
    assert.equal(memberLabelKo("your child 1"), "아이 1");
    const profile = {
      members: { value: [{ role: "adult" }, { role: "adult" },
        { role: "child", label: "민수", school: true }, { role: "child", school: true }] },
      workplaces: { value: [] },
    };
    const sc = scenarioFromProfile(profile, homes);
    assert.deepEqual(sc.household.members.slice(2).map((m) => m.label), ["민수", "아이 2"]);
  });
});

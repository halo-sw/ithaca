// 49g: concrete English intake errors from a public recording.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extract_profile, scenarioFromProfile } from "../src/profile.js";

const ST = { stations: ["Pangyo", "판교", "Gangnam"] };
const prof = (text) => extract_profile(text, null, ST).profile;

const FULL = "My wife and I both work in Pangyo onsite Monday through Friday"
  + " with zero remote days. Our annual salaries are 50 and 45 million won."
  + " We have 100M won saved and want to buy a home under 700M won."
  + " Use a 45-minute one-way commute limit.";

describe("49g full intake", () => {
  it("keeps both salaries, cash, budget, commute and onsite work", () => {
    const p = prof(FULL);
    assert.deepEqual(p.salaryAnnual.value, [50000000, 45000000]);
    assert.ok(String(p.salaryAnnual.evidence).includes("50 and 45 million won"));
    assert.equal(p.cash.value, 100000000);
    assert.equal(p.priceMax.value ?? p.depositMax.value, 700000000);
    assert.equal(p.commuteMax.value, 45);
    assert.equal(p.officeDays.value, null);
    assert.equal(p.members.value.length, 2);
  });

  it("scenario retains work when officeDays is not 0", () => {
    const p = prof(FULL);
    const homes = [{ id: "home-000001", name: "집home-000001", pnu: "pnu1", scene: "st-판교", station: { station: "판교", walk_minutes: 8 } }];
    const sc = scenarioFromProfile(p, homes);
    assert.notEqual(sc.household.members[0].home_office, true);
  });
});

describe("49g salaries", () => {
  it("reads 80 and 70 with a shared magnitude", () => {
    const p = prof("Our annual salaries are 80 and 70 million won.");
    assert.deepEqual(p.salaryAnnual.value, [80000000, 70000000]);
  });

  it("keeps fully qualified lists valid", () => {
    const p = prof("Our salaries are ₩60M and ₩50M, and we have ₩200M saved.");
    assert.deepEqual(p.salaryAnnual.value, [60000000, 50000000]);
    assert.equal(p.cash.value, 200000000);
  });

  it("never consumes dollars, savings-only or no-anchor numbers", () => {
    const dollars = prof("Our salaries are $50k and $45k.");
    assert.equal(dollars.salaryAnnual.value, null);
    const noAnchor = prof("We want 50 m2 or more on the 3rd floor, built 10 years ago, 2 rooms.");
    assert.equal(noAnchor.salaryAnnual.value, null);
    assert.equal(noAnchor.commuteMax.value, null);
    const savingsOnly = prof("We have 100M won saved and our budget is under 700M won.");
    assert.equal(savingsOnly.salaryAnnual.value, null);
    assert.equal(savingsOnly.cash.value, 100000000);
  });
});

describe("49g office days", () => {
  it("ignores negated remote English and Korean", () => {
    assert.equal(prof("Both parents work onsite Monday through Friday with zero remote days.").officeDays.value, null);
    assert.equal(prof("We have no WFH and work onsite every day.").officeDays.value, null);
    assert.equal(prof("주 5일 출근해요. 재택 안 해요.").officeDays.value, null);
    assert.equal(prof("주 5일 출근해요. 재택 없음.").officeDays.value, null);
  });

  it("keeps genuine full-remote and hybrid 2", () => {
    assert.equal(prof("I work from home.").officeDays.value, 0);
    assert.equal(prof("풀재택이에요.").officeDays.value, 0);
    assert.equal(prof("I am fully remote.").officeDays.value, 0);
    assert.equal(prof("주 2일 출근해요. 판교로 출근").officeDays.value, 2);
  });
});

describe("49g commute", () => {
  it("reads the hyphen limit form and keeps old cues", () => {
    assert.equal(prof("Use a 45-minute one-way commute limit.").commuteMax.value, 45);
    assert.equal(prof("within 30 minutes of Pangyo").commuteMax.value, 30);
  });
});

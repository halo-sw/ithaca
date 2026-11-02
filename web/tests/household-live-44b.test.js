import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tinyArea, tinyScenario, tinyRegion } from "./engine-fixture.js";
import { runHouseholdLoop } from "../src/judge/household.js";
import { simulate } from "../src/engine/simulate.js";
import { canon } from "../src/engine/canonical.js";
import { missingRouteHomes } from "../src/chat/engine.js";
import { rideMinutesForHome } from "../src/engine/scenario.js";

const REASON = { reason_ko: "테스트 이유", reason_en: "Test reason" };

function weekendEntry(shell, chosen_by, extra = {}) {
  const plan = shell.default_key === "home" ? [] : [shell.default_key];
  return { chosen_key: shell.default_key, plan, chosen_by, ...REASON, ...extra };
}

// Default-everything judge; with altOnce it takes the first valid
// non-default station_route option exactly once.
function makeJudge({ altOnce = false } = {}) {
  const calls = [];
  let altUsed = false;
  const judgeOne = async ({ shell }) => {
    calls.push(shell.id);
    if (shell.kind === "weekend_plan") return weekendEntry(shell, "model");
    if (altOnce && !altUsed && shell.kind === "station_route") {
      const alt = (shell.options || []).find((o) => o && o.key !== shell.default_key);
      if (alt) {
        altUsed = true;
        return { chosen_key: alt.key, chosen_by: "model", ...REASON };
      }
    }
    return { chosen_key: shell.default_key, chosen_by: "model", ...REASON };
  };
  return { judgeOne, calls, altWasUsed: () => altUsed };
}

const householdOf = (run) => run.decisions.filter((d) => String(d.agent).startsWith("h"));
const backgroundOf = (run) => run.decisions.filter((d) => !String(d.agent).startsWith("h"));
const tripsOf = (run, agent) => run.trips.filter((t) => t.agent === agent).map((t) => JSON.stringify(t));

describe("household live 44b", () => {
  it("judges with one alternative; replay is byte-identical", async () => {
    const judge = makeJudge({ altOnce: true });
    const result = await runHouseholdLoop({
      area: tinyArea(), scenarioRaw: tinyScenario(), homeLabel: "A",
      judgeOne: judge.judgeOne,
    });
    assert.ok(judge.altWasUsed(), "expected one non-default station_route choice");
    const hh = householdOf(result.run);
    assert.ok(hh.length > 10);
    assert.ok(hh.every((d) => d.chosen_by === "model"));
    assert.ok(backgroundOf(result.run).every((d) => d.chosen_by === "rule"));
    assert.equal(result.counts.model, hh.length);
    assert.equal(result.counts.fallback, 0);
    assert.ok(hh.some((d) => d.chosen_key !== d.default_key));
    // The alternative changed a real commute trip, not just the record.
    const base = simulate(tinyArea(), tinyScenario(), "A");
    assert.notDeepEqual(tripsOf(result.run, "h1"), tripsOf(base, "h1"));
    const replayed = simulate(tinyArea(), tinyScenario(), "A", {
      decisions: result.run.decisions,
    });
    assert.equal(canon(replayed), canon(result.run));
  });

  it("region run replays with the same region, no unjudged shells", async () => {
    const region = tinyRegion();
    const raw = tinyScenario();
    raw.household.members[0].work = {
      ...raw.household.members[0].work, destination_station: "직장역",
    };
    const judge = makeJudge({ altOnce: true });
    const result = await runHouseholdLoop({
      area: tinyArea(), scenarioRaw: raw, homeLabel: "A",
      region, judgeOne: judge.judgeOne,
    });
    const hh = householdOf(result.run);
    assert.ok(hh.length > 0 && hh.every((d) => d.chosen_by === "model"));
    const replayed = simulate(tinyArea(), structuredClone(raw), "A", {
      region, decisions: result.run.decisions,
    });
    assert.equal(canon(replayed), canon(result.run));
  });

  it("judge throw rejects; empty entry rejects", async () => {
    await assert.rejects(
      runHouseholdLoop({
        area: tinyArea(), scenarioRaw: tinyScenario(), homeLabel: "A",
        judgeOne: async () => { throw new Error("provider down"); },
      }),
      /provider down/,
    );
    await assert.rejects(
      runHouseholdLoop({
        area: tinyArea(), scenarioRaw: tinyScenario(), homeLabel: "A",
        judgeOne: async () => ({ chosen_by: "model" }),
      }),
      /no usable entry/,
    );
  });

  it("explicit rule_fallback retains its source and counts", async () => {
    const result = await runHouseholdLoop({
      area: tinyArea(), scenarioRaw: tinyScenario(), homeLabel: "A",
      judgeOne: async ({ shell }) => (shell.kind === "weekend_plan"
        ? weekendEntry(shell, "rule_fallback", { fallback_cause: "test-guard" })
        : { chosen_key: shell.default_key, chosen_by: "rule_fallback", fallback_cause: "test-guard", ...REASON }),
    });
    const hh = householdOf(result.run);
    assert.ok(hh.length > 0 && hh.every((d) => d.chosen_by === "rule_fallback"));
    assert.equal(result.counts.fallback, hh.length);
    assert.ok([...result.fixed.values()].every((e) => e.fallback_cause === "test-guard"));
  });

  it("missingRouteHomes flags missing B, accepts zeros, ignores rest", () => {
    const missing = tinyScenario();
    missing.household.members[0].work = {
      ...missing.household.members[0].work, ride_minutes: { A: 20 },
    };
    assert.deepEqual(missingRouteHomes(missing, ["A", "B"]), [{ member: "m1", home: "B" }]);
    // Missing is null, never a fake zero.
    assert.equal(rideMinutesForHome(missing.household.members[0].work, "B"), null);
    const zeros = tinyScenario();
    zeros.household.members[0].work = {
      ...zeros.household.members[0].work, ride_minutes: { A: 0, B: 0 },
    };
    assert.deepEqual(missingRouteHomes(zeros, ["A", "B"]), []);
    const ignored = tinyScenario();
    ignored.household.members = [
      { id: "s1", label: "시니어", role: "senior",
        work: { type: "station_ride", station_name: "중앙역", ride_minutes: {} } },
      { id: "c1", label: "아이", role: "child",
        work: { type: "station_ride", station_name: "중앙역", ride_minutes: {} } },
      { id: "a2", label: "재택", role: "adult", work: { type: "none" } },
      { id: "a3", label: "현장", role: "adult", work: { type: "place" } },
    ];
    assert.deepEqual(missingRouteHomes(ignored, ["A", "B"]), []);
  });
});

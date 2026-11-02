import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tinyArea, tinyScenario } from "./engine-fixture.js";
import { createSession, callTool } from "../src/consult/tools.js";
import { runTurn } from "../src/consult/agent.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

async function realTable() {
  return JSON.parse(await readFile(join(REPO, "scenarios", "assumptions", "kr-payroll.json"), "utf8"));
}

function moneySession(over = {}) {
  return createSession({
    scenario: tinyScenario({ days: 7, background: 0, seed: 7,
      homes: [
        { label: "A", area: "pangyo", complex_name: "알파" },
        { label: "B", area: "pangyo", complex_name: "베타" },
      ] }),
    loadArea: async () => tinyArea(),
    ...over,
  });
}

describe("money tools", () => {
  it("set_money patches salary/cash/tenure/assumptions", async () => {
    const s = moneySession({ loadPayroll: realTable });
    const r = await callTool(s, "set_money", { patch: {
      members: { m1: { annual_salary_won: 60000000 } },
      cash_won: 200000000,
      tenure: { A: "전세" },
      assumptions: { transit_fare_won: 1400 },
      burden_threshold_pct: 25,
    } });
    assert.equal(r.ok, true);
    assert.equal(r.money.members.m1.annual_salary_won, 60000000);
    assert.equal(r.money.cash_won, 200000000);
    assert.equal(r.money.tenure.A, "전세");
    assert.equal(r.money.assumptions.transit_fare_won, 1400);
    assert.equal(r.money.burden_threshold_pct, 25);
    assert.ok(r.household_monthly_net_preview.household_monthly_net_won > 0);
    const bad = await callTool(s, "set_money", { patch: { tenure: { A: "lease" } } });
    assert.equal(bad.ok, false);
  });

  it("estimate_net_pay estimates and resolves members", async () => {
    const s = moneySession({ loadPayroll: realTable });
    const est = await callTool(s, "estimate_net_pay", { annual_salary_won: 60000000 });
    assert.equal(est.ok, true);
    assert.equal(est.estimated, true);
    assert.match(est.formatted, /월/);
    await callTool(s, "set_money", { patch: { members: { m1: { monthly_net_won: 4100000 } } } });
    const mem = await callTool(s, "estimate_net_pay", { member: "m1" });
    assert.equal(mem.monthly_net_won, 4100000);
    assert.equal(mem.estimated, false);
  });

it("price_reference matches real rows (real data)", async (t) => {
    let area;
    try {
      const dir = join(REPO, "data", "build", "songpa-jamsil");
      area = JSON.parse(await readFile(join(dir, "area.json"), "utf8"));
      for (const [key, value] of Object.entries(area)) {
        if (value && typeof value === "object" && !Array.isArray(value)
            && Object.keys(value).join() === "$ref") {
          area[key] = JSON.parse(await readFile(join(dir, value.$ref), "utf8"));
        }
      }
      await readFile(join(REPO, "data", "raw", "rtms", "apt_trade_songpa_2510-2610.csv"));
    } catch {
      return t.skip("no real data");
    }
    const { createCsvBackend } = await import("../src/money/rtms.js");
    const backend = createCsvBackend({
      rawDir: join(REPO, "data", "raw", "rtms"), readFile: (p) => readFile(p),
    });
    const s = moneySession({ loadArea: async () => area, loadRtms: (d) => backend.loadAll(d) });
    const r = await callTool(s, "price_reference", {
      area: "songpa-jamsil", complex: "레이크팰리스", area_m2: 60,
    });
    assert.equal(r.ok, true);
    assert.equal(r.match_method, "parcel+name");
    assert.ok(r.reference.trade.count > 5);
    assert.ok(r.reference.trade.median > 1000000000);
    assert.ok(r.reference.jeonse.count > 10);
    assert.ok(r.reference.wolse.count > 10);
    assert.match(r.reference.disclaimer, /계약일 기준/);
  });
});

describe("consult agent (money)", () => {
  it("answers a forecast question politely with a fake provider", async () => {
    // Fake provider: first replies with an invented forecast (guard
    // rejects), then with 반말 + invented number (guard rejects again),
    // so the turn ends at the polite forecast fallback.
    const script = [
      { content: "집값이 오를 것 같습니다. 30억까지 갑니다." },
      { content: "몰라. 알아서 해. 99억이야." },
    ];
    let n = 0;
    const completeFn = async () => ({
      message: { content: (script[Math.min(n++, script.length - 1)] || {}).content, tool_calls: [] },
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });
    const out = await runTurn({
      provider: "meta",
      messages: [{ role: "user", content: "잠실 집값이 오를까?" }],
      scenario: tinyScenario({ days: 2, background: 0 }),
      loadArea: async () => tinyArea(),
      completeFn,
    });
    assert.equal(out.ok, true);
    assert.equal(out.fallback, true);
    assert.match(out.reply, /미리 맞히지 않아요/);
    assert.match(out.reply, /최근 12개월에 실제로 거래된 값/);
  });

  it("system prompt demands 존댓말 and the money flow", async () => {
    const { SYSTEM_PROMPT } = await import("../src/consult/agent.js");
    assert.match(SYSTEM_PROMPT, /존댓말/);
    assert.match(SYSTEM_PROMPT, /반말/);
    assert.match(SYSTEM_PROMPT, /living_cost/);
    assert.match(SYSTEM_PROMPT, /전망을 하지 않습니다/);
    assert.match(SYSTEM_PROMPT, /LTV/);
  });
});

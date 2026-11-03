// 47h2 — controlled browser QA of the real life-plan flow (QA script only).
// QA fixture: provider calls are stubbed in-page; the worker/data/engine
// run for real. Every output is labelled controlled QA, never live evidence.
// Usage: node web/scripts/life-plan-audit.mjs <outDir> <case...: desktop|mobile|error>
// The orchestrator runs this with network permission; Muse never launches it.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { buildLifePlanInput, validateLifePlan } from "../src/life/plan.js";

const PW_PATH = process.env.ITHACA_PLAYWRIGHT_PATH ||
  "/Users/halo.axz-pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const BASE_URL = process.env.ITHACA_BASE_URL || "http://127.0.0.1:48953";
const FIXTURE_PATH = process.env.ITHACA_QA_FIXTURE ||
  "/Users/halo.axz-pc/Documents/Codex/2026-11-02/dl/work/v8-capture/muse-couple-picks-storage.json";
// Only these session fields are reused; never any stored key/judge material.
const ALLOWED_FIELDS = new Set(["messages", "profile", "candidatesData", "picks",
  "scenario", "intake", "household", "overrides", "exampleId"]);

const M1_PREF = "QA SYNTHETIC example: member one prefers quiet mornings with coffee (controlled QA, not the user's household).";
const M2_PREF = "QA SYNTHETIC example: member two prefers evening park walks after dinner (controlled QA, not the user's household).";
const M1_WORK_EVIDENCE = "Member one works Mon Wed Fri onsite";
const M2_WORK_EVIDENCE = "Member two works Tue Thu onsite";
const SHARED_WORK_EVIDENCE = "shares member one's workplace";
const MOBILE_SCHOOL_QUESTION = "Which schools will the 9-year-old and 15-year-old actually attend? (controlled QA)";
const MOBILE_UNMODELED_SCHOOL = "School: not confirmed \u2014 awaiting details. (controlled QA)";

function redactUrl(u) {
  try {
    const x = new URL(u, BASE_URL);
    for (const k of [...x.searchParams.keys()]) {
      if (/key|token|secret|session|judge|byok/i.test(k)) x.searchParams.set(k, "[redacted]");
    }
    return x.toString();
  } catch { return String(u).split("?")[0]; }
}

async function loadFixture() {
  const raw = JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
  const session = raw.session || raw;
  const doc = typeof session["sim.chat.v1"] === "string"
    ? JSON.parse(session["sim.chat.v1"]) : session["sim.chat.v1"];
  const seeded = {};
  for (const k of ALLOWED_FIELDS) if (doc[k] !== undefined) seeded[k] = doc[k];
  return seeded;
}

function syntheticMessages() {
  return [
    { id: "qa-desktop-m1", role: "user", kind: "text",
      content: `Controlled QA synthetic conditions (EXAMPLE household, not real): ${M1_PREF} ${M1_WORK_EVIDENCE}.` },
    { id: "qa-desktop-m2", role: "user", kind: "text",
      content: `Controlled QA synthetic conditions (EXAMPLE household, not real): ${M2_PREF} ${M2_WORK_EVIDENCE} and ${SHARED_WORK_EVIDENCE}.` },
  ];
}

function mobileMessages() {
  return [
    { id: "qa-mobile-m1", role: "user", kind: "text",
      content: "Controlled QA synthetic 4-person example (2 adults 2 children, NOT a real household): QA adult1 and QA adult2 keep distinct routines; schools not confirmed for either child." },
    { id: "qa-mobile-m2", role: "user", kind: "text",
      content: "Controlled QA synthetic: QA adult1 works Mon Wed Fri onsite; QA adult2 works Tue Thu onsite; QA child9 is 9 and QA child15 is 15, both schools unconfirmed." },
  ];
}

// Build + validate a fixture plan with the REAL project modules so the
// signature/contract matches. Source stays "muse" (the UI requires it)
// but the fixture documents provider qa_fixture in usage.
function fixturePlan({ scenario, profile, messages, lang, mode }, state) {
  const input = buildLifePlanInput({ scenario, profile, messages, lang });
  if (mode === "mobile4") {
    if (input.members.length !== 4) {
      throw new Error(`fixture: mobile4 needs 4 input members, got ${input.members.length}`);
    }
    const members = input.members.map((m) => ({ id: m.id, changes: [] }));
    members[2].changes.push({ field: "schooldays", value: ["Mon", "Tue", "Wed", "Thu", "Fri"], basis: "proposal", evidence: "" });
    members[3].changes.push({ field: "schooldays", value: ["Mon", "Tue", "Wed", "Thu", "Fri"], basis: "proposal", evidence: "" });
    const raw = {
      members,
      observations: [{ code: "school", member_ids: [members[2].id, members[3].id],
        reason: "Both children may need weekday school legs once schools are known. (controlled QA)" }],
      questions: [MOBILE_SCHOOL_QUESTION],
      unmodeled: [MOBILE_UNMODELED_SCHOOL],
    };
    const plan = validateLifePlan(raw, input);
    return { input, plan };
  }
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const target = byId.get("m1") || input.members[0];
  const copier = byId.get("m2") || input.members[1];
  if (!target || !copier) throw new Error("fixture: desktop needs 2 input members");
  const w = target.work;
  const targetResolved = w !== null && w !== undefined
    && (typeof w !== "object" || w.type !== "none")
    && target.work_unresolved !== true;
  if (!targetResolved) {
    throw new Error(`fixture: target ${target.id} work is not resolved; cannot copy commute`);
  }
  const members = input.members.map((m) => ({ id: m.id, changes: [] }));
  const byEntry = new Map(members.map((m) => [m.id, m]));
  byEntry.get(target.id).changes.push(
    { field: "preferences", value: M1_PREF, basis: "stated", evidence: M1_PREF },
    { field: "workdays", value: ["Mon", "Wed", "Fri"], basis: "stated", evidence: M1_WORK_EVIDENCE });
  byEntry.get(copier.id).changes.push(
    { field: "preferences", value: M2_PREF, basis: "stated", evidence: M2_PREF },
    { field: "workdays", value: ["Tue", "Thu"], basis: "stated", evidence: M2_WORK_EVIDENCE },
    { field: "commute", value: `member:${target.id}`, basis: "stated", evidence: SHARED_WORK_EVIDENCE });
  const raw = {
    members,
    observations: [{ code: "commute", member_ids: [target.id, copier.id],
      reason: "Controlled QA fixture: distinct synthetic routines split the commute load." }],
    questions: [],
    unmodeled: [],
    review: ["Controlled QA fixture plan with fake provider qa_fixture — not live evidence."],
  };
  const plan = validateLifePlan(raw, input);
  state.expectedPrefs = { [target.id]: M1_PREF, [copier.id]: M2_PREF };
  return { input, plan };
}

function decisionEntry(context) {
  const shell = (context && (context.shell || context.decision || context.branch)) || {};
  const member = (shell && typeof shell.member === "object" && shell.member)
    || (context && typeof context.member === "object" && context.member) || {};
  const def = shell.default_key;
  const isWeekend = shell.kind === "weekend_plan";
  const entry = {
    ...shell,
    chosen_key: def,
    chosen_by: "rule_fallback",
    fallback_cause: "qa_fixture",
    reason_en: "Controlled QA fixture; not a live model choice",
    decided_by: "일정",
  };
  if (isWeekend) entry.plan = def === "home" ? [] : [def];
  const pref = typeof member.preferences === "string" ? member.preferences
    : typeof (context && context.preferences) === "string" ? context.preferences : "";
  const planCtx = typeof member.plan_context === "string" ? member.plan_context : "";
  entry.context_preferences = String(pref).slice(0, 500);
  entry.context_plan_context = String(planCtx).slice(0, 1200);
  return entry;
}

async function installFixture(page, state, opts = {}) {
  const counts = { plan: 0, decision: 0, diaryReport: 0, consult: 0, unexpectedNormal: 0 };
  const trace = [];
  await page.route("**/api/model/status", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, meta: { hasServerKey: true },
        voice: { hasServerKey: false }, baseten: { hasServerKey: false },
        recorded: { hasServerKey: true }, relay: false }) });
  });
  await page.route("**/api/consult", async (route) => {
    const req = route.request();
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch { body = {}; }
    const task = body.task || "normal";
    if (task === "life_plan" && opts.lifePlan503) {
      counts.plan += 1; counts.consult += 1;
      trace.push({ task, at: Date.now(), forced503: true });
      await route.fulfill({ status: 503, contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Life plan could not be prepared. Please retry." }) });
      return;
    }
    if (task === "life_plan") {
      counts.plan += 1; counts.consult += 1;
      try {
        const scenario = body.scenario && typeof body.scenario === "object" ? body.scenario : state.scenarioHint;
        const { input, plan } = fixturePlan({ scenario, profile: body.profile || {}, messages: body.messages || [], lang: "en", mode: opts.planMode }, state);
        const planOut = { ...plan, source: "muse", input_signature: input.input_signature, confirmed: false };
        trace.push({ task, at: Date.now(), input_signature: input.input_signature,
          member_ids: input.members.map((m) => m.id), questions: plan.questions || [], unmodeled: plan.unmodeled || [] });
        state.lastInputSignature = input.input_signature;
        await route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, plan: planOut, input_signature: input.input_signature, usage: { provider: "qa_fixture" } }) });
      } catch (err) {
        trace.push({ task, at: Date.now(), error: String((err && err.message) || err).slice(0, 300) });
        await route.fulfill({ status: 503, contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "Life plan could not be prepared. Please retry." }) });
      }
      return;
    }
    if (task === "decision") {
      counts.decision += 1; counts.consult += 1;
      const entry = decisionEntry(body.context || {});
      trace.push({ task, at: Date.now(), kind: entry.kind, agent: entry.agent, day: entry.day,
        chosen_key: entry.chosen_key, default_key: entry.default_key, chosen_by: entry.chosen_by,
        member_id: (body.context && body.context.member && body.context.member.id) || "",
        pref: entry.context_preferences, ctx_len: entry.context_plan_context.length,
        plan: Array.isArray(entry.plan) ? entry.plan.slice(0, 4) : null });
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, entry, usage: { provider: "qa_fixture" } }) });
      return;
    }
    if (task === "diary" || task === "report") {
      counts.diaryReport += 1; counts.consult += 1;
      trace.push({ task, at: Date.now(), expected503: true });
      await route.fulfill({ status: 503, contentType: "application/json",
        body: JSON.stringify({ ok: false, error: `${task} unavailable in controlled QA` }) });
      return;
    }
    counts.consult += 1; counts.unexpectedNormal += 1;
    trace.push({ task, at: Date.now(), unexpected: true });
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, messages: [], usage: { provider: "qa_fixture" }, uiActions: [] }) });
  });
  return { counts, trace };
}

function seedScript(doc) {
  const safe = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `try { sessionStorage.setItem("sim.chat.v1", ${JSON.stringify(safe)}); } catch (e) {}`;
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return Math.max(0, de.scrollWidth - de.clientWidth);
  });
}

async function waitSimulationDone(page, timeoutMs) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await page.evaluate(() => {
      try {
        const raw = sessionStorage.getItem("sim.chat.v1");
        if (!raw) return { found: false };
        const doc = JSON.parse(raw);
        const msgs = Array.isArray(doc.messages) ? doc.messages : [];
        const sims = msgs.filter((m) => m && m.kind === "simulation" && m.data && typeof m.data === "object");
        if (!sims.length) return { found: false };
        const d = sims[sims.length - 1].data;
        return { found: true, status: d.status,
          customId: typeof d.customId === "string" ? d.customId : "",
          message: typeof d.message === "string" ? d.message : "",
          hasSummary: d.lifePlanSummary != null };
      } catch (e) { return { found: false, parseError: String((e && e.message) || e).slice(0, 120) }; }
    });
    if (last && last.found && last.status === "done" && last.customId) return last;
    if (last && last.found && (last.status === "error" || last.message)) {
      throw new Error(`simulation error: ${(last.message || last.status || "unknown").slice(0, 300)}`);
    }
    await page.waitForTimeout(2000);
  }
  throw new Error(`simulation not done: ${JSON.stringify(last).slice(0, 200)}`);
}

async function runCase(browser, def, outDir, seed) {
  const started = Date.now();
  const errors = [];
  const netErrors = [];
  const result = { case: def.name, controlled_qa: true, live_model: false, ok: false,
    elapsed_ms: 0, assertions: [], captures: [], counts: null, trace: [], errors };
  const viewport = def.viewport;
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${String(m.text()).slice(0, 300)}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String((e && e.message) || e).slice(0, 300)}`));
  page.on("requestfailed", (r) => netErrors.push(`reqfail: ${redactUrl(r.url()).slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 500) netErrors.push(`${r.status()}: ${redactUrl(r.url()).slice(0, 200)}`); });
  const check = (name, cond, detail = "") => {
    result.assertions.push({ name, pass: !!cond, detail: String(detail).slice(0, 300) });
    if (!cond) throw new Error(`assertion failed: ${name}${detail ? ` — ${detail}` : ""}`);
  };
  try {
    const state = {};
    if (def.name === "mobile") {
      const doc = { ...seed,
        messages: mobileMessages(),
        exampleId: "qa-controlled-4p-example",
        savedAt: Date.now(),
        profile: { ...((seed && seed.profile) || {}),
          members: { value: [
            { role: "adult", label: "QA adult1" },
            { role: "adult", label: "QA adult2" },
            { role: "child", label: "QA child9", age: 9, school: { mode: "unresolved", level: "unknown" } },
            { role: "child", label: "QA child15", age: 15, school: { mode: "unresolved", level: "unknown" } },
          ], source: "customer" } } };
      await page.addInitScript(seedScript(doc));
      state.planMode = "mobile4";
    } else {
      const doc = { ...seed, messages: syntheticMessages(), exampleId: "qa-controlled-couple-example", savedAt: Date.now() };
      await page.addInitScript(seedScript(doc));
    }
    const { counts, trace } = await installFixture(page, state,
      { ...((def.fixtureOpts) || {}), ...(state.planMode ? { planMode: state.planMode } : {}) });
    result.trace = trace;
    await page.goto(`${BASE_URL}/?chat=&lang=en`, { waitUntil: "domcontentloaded" });
    const runBtn = page.locator("button:visible").filter({ hasText: /^(Live 30 days|30일 살아 보기)$/ }).first();
    await runBtn.waitFor({ timeout: 60000 });
    check("run-button-visible", true);
    const decisionsBefore = counts.decision;
    await runBtn.click();
    const cards = page.locator("[data-plan-card]");
    const card = cards.last();
    if (def.name === "error") {
      const retry = page.getByRole("button", { name: /retry|다시 시도/i }).first();
      await retry.waitFor({ timeout: 30000 });
      check("error-retry-visible", true);
      check("error-plan-requested-before-503", counts.plan >= 1, `plan=${counts.plan}`);
      check("error-decisions-0", counts.decision === 0, `decisions=${counts.decision}`);
      const simCount = await page.evaluate(() => {
        try {
          const doc = JSON.parse(sessionStorage.getItem("sim.chat.v1") || "{}");
          const msgs = Array.isArray(doc.messages) ? doc.messages : [];
          return msgs.filter((m) => m && (m.kind === "simulation"
            || (m.data && typeof m.data === "object" && m.data.status === "done"))).length;
        } catch { return -1; }
      });
      check("error-no-simulation-in-transcript", simCount === 0, `simCount=${simCount}`);
      check("error-no-unexpected-normal", counts.unexpectedNormal === 0, `unexpectedNormal=${counts.unexpectedNormal}`);
      await page.screenshot({ path: path.join(outDir, `${def.name}-error.png`) });
      result.captures.push(`${def.name}-error.png`);
      const pageErrs = errors.filter((e) => e.startsWith("pageerror"));
      check("error-no-unexpected-pageerror", pageErrs.length === 0, pageErrs.slice(0, 2).join(" | "));
      result.counts = counts;
      result.ok = result.assertions.every((a) => a.pass);
      result.elapsed_ms = Date.now() - started;
      return result;
    }
    await card.getByTestId("life-plan-confirm").waitFor({ timeout: 60000 });
    check("review-card-appears", true);
    check("plan-request-1", counts.plan === 1, `plan=${counts.plan}`);
    check("decisions-0-before-confirm", counts.decision === decisionsBefore, `decisions=${counts.decision}`);
    check("no-unexpected-normal", counts.unexpectedNormal === 0, `unexpectedNormal=${counts.unexpectedNormal}`);
    await page.screenshot({ path: path.join(outDir, `${def.name}-review.png`) });
    result.captures.push(`${def.name}-review.png`);
    const overflow = await noOverflow(page);
    check(def.name === "mobile" ? "overflow-<=2px" : "no-horizontal-overflow",
      def.name === "mobile" ? overflow <= 2 : overflow === 0, `overflow=${overflow}px`);
    if (def.name === "mobile") {
      const planTrace = trace.find((t) => t.task === "life_plan" && Array.isArray(t.member_ids));
      check("mobile-plan-trace-4-members", !!planTrace && planTrace.member_ids.length === 4,
        planTrace ? `members=${planTrace.member_ids.length}` : "no plan trace");
      check("mobile-unmodeled-strings", !!planTrace && Array.isArray(planTrace.unmodeled)
        && planTrace.unmodeled.length >= 1 && planTrace.unmodeled.every((u) => typeof u === "string"),
        planTrace ? JSON.stringify(planTrace.unmodeled).slice(0, 120) : "no plan trace");
      const cardText = await card.innerText().catch(() => "");
      check("review-exact-school-question", cardText.includes("9-year-old and 15-year-old"), cardText.slice(0, 120));
      check("review-school-unconfirmed", /not confirmed|미확인/i.test(cardText), cardText.slice(0, 120));
      const confirmBtn = card.getByTestId("life-plan-confirm");
      check("confirm-present", (await confirmBtn.count()) === 1);
      check("confirm-disabled-with-questions", await confirmBtn.isDisabled(), "confirm must stay disabled while questions pending");
      const pageErrs = errors.filter((e) => e.startsWith("pageerror"));
      check("mobile-no-unexpected-pageerror", pageErrs.length === 0, pageErrs.slice(0, 2).join(" | "));
      result.counts = counts;
      result.ok = result.assertions.every((a) => a.pass);
      result.elapsed_ms = Date.now() - started;
      return result;
    }
    const confirmBtn = card.getByTestId("life-plan-confirm");
    check("confirm-enabled", await confirmBtn.isEnabled());
    await confirmBtn.click();
    const sim = await waitSimulationDone(page, 180000);
    check("simulation-finished", true, `customId=${sim.customId}`);
    const decisions = trace.filter((t) => t.task === "decision");
    check("decisions-captured", decisions.length >= 1, `traced=${decisions.length}`);
    const expected = state.expectedPrefs || {};
    const expectedIds = Object.keys(expected);
    check("decision-two-expected-members", expectedIds.length === 2, `members=${expectedIds.join(",")}`);
    for (const id of expectedIds) {
      const hit = decisions.some((d) => d.member_id === id && d.pref === expected[id] && d.ctx_len > 0);
      check(`decision-carries-own-preference-${id}`, hit,
        `member=${id} pref_match=${decisions.some((d) => d.member_id === id && d.pref === expected[id])}`);
    }
    const weekendBad = decisions.filter((d) => d.kind === "weekend_plan" && Array.isArray(d.plan)
      && ((d.chosen_key === "home") !== (d.plan.length === 0)
        || (d.chosen_key !== "home" && !(d.plan.length === 1 && d.plan[0] === d.chosen_key))));
    check("weekend-plan-matches-judge-contract", weekendBad.length === 0, `bad=${weekendBad.length}`);
    const idbSummary = await page.evaluate(async (customId) => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("sim-chat-12b", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("idb open failed"));
      });
      try {
        const record = await new Promise((resolve, reject) => {
          const tx = db.transaction("custom-runs", "readonly");
          const g = tx.objectStore("custom-runs").get(customId);
          g.onsuccess = () => resolve(g.result);
          g.onerror = () => reject(g.error || new Error("idb get failed"));
        });
        if (!record) return { found: false };
        const labels = Array.isArray(record.labels) ? record.labels : [];
        const runs = record.runs && typeof record.runs === "object" ? record.runs : {};
        const per = labels.map((lb) => {
          const r = runs[lb];
          const meta = r && r.meta && typeof r.meta === "object" ? r.meta : null;
          const trips = r && Array.isArray(r.trips) ? r.trips.length
            : r && Array.isArray(r.moments) ? r.moments.length : -1;
          return { days30: !!(meta && meta.days === 30), trips };
        });
        return { found: true, labelCount: labels.length, per };
      } finally { try { db.close(); } catch (e) {} }
    }, sim.customId);
    check("custom-run-stored", !!idbSummary.found, `customId=${sim.customId}`);
    check("custom-run-both-labels-days30-trips", !!idbSummary.found && idbSummary.labelCount === 2
      && idbSummary.per.every((p) => p.days30 && p.trips > 0),
      JSON.stringify({ labelCount: idbSummary.labelCount, per: idbSummary.per }).slice(0, 200));
    check("life-plan-summary-present", sim.hasSummary === true);
    result.result_counts = { labels: idbSummary.labelCount || 0,
      trips: (idbSummary.per || []).map((p) => p.trips),
      days30: (idbSummary.per || []).map((p) => p.days30) };
    const heading = page.getByText(/After 30 days of living|30일 살아 보기 결과/).first();
    await heading.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: path.join(outDir, `${def.name}-result.png`) });
    result.captures.push(`${def.name}-result.png`);
    const pageErrs = errors.filter((e) => e.startsWith("pageerror"));
    check("no-unexpected-pageerror", pageErrs.length === 0, pageErrs.slice(0, 2).join(" | "));
    result.counts = counts;
    result.ok = result.assertions.every((a) => a.pass);
    result.elapsed_ms = Date.now() - started;
    return result;
  } catch (err) {
    result.errors.push(String((err && err.message) || err).slice(0, 500));
    try {
      await page.screenshot({ path: path.join(outDir, `${def.name}-failure.png`) });
      result.captures.push(`${def.name}-failure.png`);
    } catch (e) {}
    result.elapsed_ms = Date.now() - started;
    return result;
  } finally {
    const isConsult503 = (e) => /503/.test(e) && String(e).includes("/api/consult");
    result.network_errors = netErrors.filter((e) => !isConsult503(e));
    result.expected_503 = netErrors.filter(isConsult503);
    result.expected_503_by_task = { life_plan: result.trace.filter((t) => t.task === "life_plan" && t.forced503).length,
      diary: result.trace.filter((t) => t.task === "diary" && t.expected503).length,
      report: result.trace.filter((t) => t.task === "report" && t.expected503).length };
    result.console_errors = errors;
    await ctx.close().catch(() => {});
  }
}

const CASES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 } },
  error: { viewport: { width: 1440, height: 900 }, fixtureOpts: { lifePlan503: true } },
};

async function main() {
  const [outDir, ...names] = process.argv.slice(2);
  if (!outDir || !names.length) {
    console.error("usage: node web/scripts/life-plan-audit.mjs <outDir> <case...: desktop|mobile|error>");
    process.exit(2);
  }
  await fs.mkdir(outDir, { recursive: true });
  const seed = await loadFixture();
  const require = createRequire(import.meta.url);
  const { chromium } = require(PW_PATH);
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const report = { controlled_qa: true, live_model: false, provider: "qa_fixture",
    base_url: BASE_URL, cases: {}, started_at: new Date().toISOString() };
  let failed = 0;
  try {
    for (const n of names) {
      if (!CASES[n]) { report.cases[n] = { error: `unknown case ${n}` }; failed += 1; continue; }
      const r = await runCase(browser, { name: n, ...CASES[n] }, outDir, seed);
      report.cases[n] = r;
      console.log(JSON.stringify({ case: n, ok: r.ok, elapsed_ms: r.elapsed_ms }));
      if (!r.ok) failed += 1;
    }
  } finally {
    await browser.close().catch(() => {});
    report.finished_at = new Date().toISOString();
    await fs.writeFile(path.join(outDir, "life-plan-audit.json"), JSON.stringify(report, null, 2));
  }
  if (failed) process.exit(1);
}

await main();

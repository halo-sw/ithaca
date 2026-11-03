// 47q — real-provider planning checks for varied illustrative households.
// Muse Code only. No product changes, browser launch, git, or full suite.
// The orchestrator runs this after deploying the reviewed backend:
//   node web/scripts/live-plan-matrix.mjs <outDir> [caseId...]
// All households are hypothetical (see plan-examples.mjs); no personal claims.
// Planning only: never confirms a plan and never claims 30-day execution.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile as execFileCb } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildLifePlanInput } from "../src/life/plan.js";
import { buildReviewInput, requestPlanReview } from "../src/chat/life-plan-flow.js";
import { CASE_IDS, buildCases } from "./plan-examples.mjs";

const API_BASE = (process.env.ITHACA_API_BASE || "https://ithaca-relay.vercel.app").replace(/\/+$/, "");
const PROVIDER = "meta";
const TIMEOUT_MS = 90000;
const VERCEL_DEPLOYMENT = (process.env.ITHACA_VERCEL_DEPLOYMENT || "").trim();
const VERCEL_SCOPE = "halos-projects-24428129";
const VERCEL_TIMEOUT_MS = 100000;
const VERCEL_MAX_OUTPUT = 2000000;
const STATUS_MARKER = "\n__ITHACA_HTTP_STATUS:";

function execFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    execFileCb(file, args, options, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const USAGE = `usage: node web/scripts/live-plan-matrix.mjs <outDir> [caseId...]\n`
  + `cases: ${CASE_IDS.join(" ")} (default: all, sequential, one request each)\n`
  + `env: ITHACA_API_BASE (default https://ithaca-relay.vercel.app)`;

function isGateStatus(status, payload) {
  return status === 429 || status === 401 || status === 403
    || (payload && (payload.error === "server_key_used" || payload.error === "open_limit"));
}

function gateMessage(status, payload) {
  const err = payload && payload.error ? String(payload.error) : `HTTP ${status}`;
  return `server access/rate gate (${err}); stopping — no session rotation, no retry under another identity`;
}

async function loadSessionId(outDir) {
  const p = path.join(outDir, "session-id.txt");
  try {
    const v = (await fs.readFile(p, "utf8")).trim();
    if (/^[A-Za-z0-9_-]{8,64}$/.test(v)) return { id: v, path: p, reused: true };
  } catch { /* mint below */ }
  const id = crypto.randomBytes(16).toString("hex");
  await fs.writeFile(p, `${id}\n`, "utf8");
  return { id, path: p, reused: false };
}

async function postLifePlanVercelCurl({ scenario, profile, messages }) {
  const started = Date.now();
  const body = JSON.stringify({ task: "life_plan", provider: PROVIDER, scenario, profile, messages, lang: "en" });
  const tmpPath = path.join(postLifePlan.outDir, `.consult-body-${crypto.randomBytes(8).toString("hex")}.json`);
  await fs.writeFile(tmpPath, body, "utf8");
  try {
    const args = [
      "curl", "/api/consult",
      "--deployment", VERCEL_DEPLOYMENT,
      "--scope", VERCEL_SCOPE,
      "--",
      "--silent", "--show-error",
      "--request", "POST",
      "--header", "Content-Type:application/json",
      "--header", `x-ithaca-session:${postLifePlan.sessionId}`,
      "--data-binary", `@${tmpPath}`,
      "--write-out", `${STATUS_MARKER}%{http_code}`,
    ];
    let stdout;
    try {
      ({ stdout } = await execFileAsync("vercel", args, {
        timeout: VERCEL_TIMEOUT_MS,
        maxBuffer: VERCEL_MAX_OUTPUT,
      }));
    } catch (err) {
      if (typeof err.stdout !== "string") throw err;
      stdout = err.stdout;
    }
    const out = String(stdout || "");
    const idx = out.lastIndexOf(STATUS_MARKER);
    if (idx < 0) throw new Error("vercel curl output missing status marker");
    const status = Number(out.slice(idx + STATUS_MARKER.length).trim());
    const text = out.slice(0, idx);
    let payload = null;
    try { payload = JSON.parse(text); } catch { payload = null; }
    return { status, payload, latencyMs: Date.now() - started };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

async function postLifePlan({ scenario, profile, messages }) {
  if (VERCEL_DEPLOYMENT) return postLifePlanVercelCurl({ scenario, profile, messages });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const r = await fetch(`${API_BASE}/api/consult`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ithaca-session": postLifePlan.sessionId },
      body: JSON.stringify({ task: "life_plan", provider: PROVIDER, scenario, profile, messages, lang: "en" }),
      signal: ctrl.signal,
    });
    let payload = null;
    try { payload = await r.json(); } catch { payload = null; }
    return { status: r.status, payload, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function effectiveMembers(scenario, plan) {
  const out = {};
  for (const m of scenario.household.members) out[m.id] = { ...m };
  for (const entry of plan.members || []) {
    for (const c of entry.changes || []) out[entry.id][c.field] = c.value;
  }
  return out;
}

function sameDays(a, b) {
  const x = [...(a || [])].sort().join(",");
  const y = [...(b || [])].sort().join(",");
  return x === y;
}

function visibleText(plan) {
  return [...(plan.questions || []), ...(plan.unmodeled || []), ...(plan.observations || []).map((o) => o.reason || "")]
    .join("\n").toLowerCase();
}

// Semantic assertions on the validated plan. Returns {pass, notes[]}.
function checkBehavior(caseId, expect, scenario, plan) {
  const notes = [];
  const fail = (t) => { notes.push(t); return false; };
  let pass = true;
  const eff = effectiveMembers(scenario, plan);

  // Exact member coverage is enforced by schema validation; restate it.
  const wantIds = scenario.household.members.map((m) => m.id).sort().join(",");
  const gotIds = (plan.members || []).map((m) => m.id).sort().join(",");
  if (wantIds !== gotIds) pass = fail(`member coverage mismatch: want [${wantIds}] got [${gotIds}]`) && false;

  for (const [mid, days] of Object.entries(expect.workdays || {})) {
    if (!sameDays(eff[mid] && eff[mid].workdays, days)) {
      pass = fail(`${mid}.workdays not preserved: want [${days}] got [${(eff[mid] && eff[mid].workdays) || "—"}]`);
    } else notes.push(`${mid}.workdays preserved [${days}]`);
  }
  for (const [mid, days] of Object.entries(expect.schooldays || {})) {
    if (!sameDays(eff[mid] && eff[mid].schooldays, days)) {
      pass = fail(`${mid}.schooldays not preserved: want [${days}] got [${(eff[mid] && eff[mid].schooldays) || "—"}]`);
    } else notes.push(`${mid}.schooldays preserved`);
  }
  for (const [mid, subs] of Object.entries(expect.preferencesContain || {})) {
    const v = eff[mid] && typeof eff[mid].preferences === "string" ? eff[mid].preferences.toLowerCase() : "";
    for (const s of subs) {
      if (!v.includes(s.toLowerCase())) pass = fail(`${mid}.preferences missing ${JSON.stringify(s)}`);
      else notes.push(`${mid}.preferences keeps ${JSON.stringify(s)}`);
    }
  }
  if (expect.errands) {
    for (const [mid, e] of Object.entries(expect.errands)) {
      const v = eff[mid] && eff[mid].errands_per_week;
      if (!v || v.supermarket !== e.supermarket) {
        pass = fail(`${mid}.errands_per_week.supermarket: want ${e.supermarket} got ${v ? v.supermarket : "—"}`);
      } else notes.push(`${mid}.supermarket ${e.supermarket}/week preserved`);
    }
  }
  if (expect.noCommute) {
    for (const entry of plan.members || []) {
      for (const c of entry.changes || []) {
        if (c.field === "commute" && c.value !== "none") {
          pass = fail(`${entry.id}.commute invented travel (${JSON.stringify(c.value)}) for a no-commute household`);
        }
        if (c.field === "workdays") pass = fail(`${entry.id}.workdays added to a no-commute household`) && false;
      }
    }
    if (pass) notes.push("no commute fabricated");
  }
  // No unasked clinic/cafe/vet routines in any case in this matrix.
  for (const entry of plan.members || []) {
    for (const c of entry.changes || []) {
      if ((c.field === "clinic_visits_per_month" || c.field === "cafe_visits_per_week"
        || c.field === "vet_visits_per_month") && Number(c.value) > 0) {
        pass = fail(`${entry.id}.${c.field}=${c.value} without an explicit request`);
      }
    }
  }
  if (expect.dogWalkMorning) {
    for (const [mid, want] of Object.entries(expect.dogWalkMorning)) {
      if (eff[mid] && eff[mid].dog_walk_morning !== want) {
        pass = fail(`${mid}.dog_walk_morning: want ${want} got ${eff[mid].dog_walk_morning}`);
      } else notes.push(`${mid}.dog_walk_morning=${want} preserved`);
    }
  }
  const text = visibleText(plan);
  if (expect.schoolUnresolvedVisible) {
    const hasSchoolText = /school|enroll|attend/.test(text);
    const statedSchool = (plan.members || []).some((e) => (e.changes || [])
      .some((c) => c.field === "school" && c.basis === "stated"
        && typeof c.value === "object" && c.value && c.value.mode === "nearby"));
    if (!hasSchoolText) pass = fail("unresolved schooling not visible (no school mention in questions/unmodeled)");
    else notes.push("unresolved schooling visible");
    if (statedSchool) pass = fail("school assignment claimed as stated fact (nearby-as-stated)");
  }
  if (expect.pickupVisible) {
    if (!/pickup|coordination/.test(text)) {
      pass = fail("pickup coordination not identified as unmodeled (missing from questions/unmodeled)");
    } else notes.push("pickup coordination identified as unmodeled, not fabricated");
  }
  if (expect.noRetirementInference) {
    if (/retire|diagnos|dementia|frail/.test(text)) pass = fail("inferred retirement/medical need in plan text");
    else notes.push("no retirement/medical inference");
  }
  if (expect.sharedOffice) {
    const missing = scenario.household.members.filter((m) => !m.work || m.work.type === "none");
    if (missing.length > 0) pass = fail(`shared office missing for ${missing.map((m) => m.id).join(",")}`);
    else notes.push("shared known office carried for both adults");
  }
  return { pass, notes };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { console.log(USAGE); return 0; }
  const [outDir, ...only] = args;
  if (!outDir) { console.error(USAGE); return 2; }
  const wanted = only.length > 0 ? only : CASE_IDS;
  for (const id of wanted) {
    if (!CASE_IDS.includes(id)) { console.error(`unknown case ${JSON.stringify(id)}\n${USAGE}`); return 2; }
  }
  await fs.mkdir(outDir, { recursive: true });
  const session = await loadSessionId(outDir);
  postLifePlan.sessionId = session.id;
  postLifePlan.outDir = outDir;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const demo = JSON.parse(await fs.readFile(path.join(here, "..", "..", "scenarios", "demo-two-homes.json"), "utf8"));
  const base = {
    homes: demo.homes,
    start_date: demo.start_date,
    days: demo.days,
    seed: demo.seed,
    workday_minutes: demo.workday_minutes,
    schoolday_minutes: demo.schoolday_minutes,
    work: demo.household.members[0].work,
  };
  const cases = buildCases(base).filter((c) => wanted.includes(c.id));

  const summary = {
    tool: "live-plan-matrix",
    live_model: true,
    illustrative_households: true,
    note: "Hypothetical households only; planning checks, never 30-day execution claims.",
    provider: PROVIDER,
    lang: "en",
    api_base: API_BASE,
    transport: VERCEL_DEPLOYMENT ? "vercel-curl" : "fetch",
    mode: VERCEL_DEPLOYMENT ? "staged-deployment" : "public-alias",
    deployment: VERCEL_DEPLOYMENT || null,
    cases: {},
  };
  let failed = false;
  let stopped = null;

  for (const c of cases) {
    const { scenario, profile, messages } = c.build();
    const input = buildLifePlanInput({ scenario, profile, messages, lang: "en" });
    const reviewInput = buildReviewInput({ scenario, profile, messages, lang: "en" });
    await fs.writeFile(path.join(outDir, `${c.id}.input.json`),
      `${JSON.stringify({ scenario, profile, messages }, null, 2)}\n`, "utf8");

    const row = { id: c.id, title: c.title, schema: "not-run", behavior: "not-run", notes: [] };
    let rawPlan = null;
    let transport;
    try {
      transport = await postLifePlan({ scenario, profile, messages });
    } catch (err) {
      row.schema = "transport-fail";
      row.notes.push(`transport failure (${err && err.name === "AbortError" ? "timeout" : String((err && err.message) || err)})`);
      row.latencyMs = TIMEOUT_MS;
      failed = true;
      summary.cases[c.id] = row;
      await fs.writeFile(path.join(outDir, `${c.id}.status.json`), `${JSON.stringify(row, null, 2)}\n`, "utf8");
      continue;
    }
    row.latencyMs = transport.latencyMs;
    row.httpStatus = transport.status;
    const payload = transport.payload;
    row.provider = payload && payload.usage && payload.usage.provider ? String(payload.usage.provider) : null;

    if (!transport.status || transport.status < 200 || transport.status >= 300
      || !payload || payload.ok !== true || !payload.plan) {
      if (isGateStatus(transport.status, payload)) {
        row.schema = "gate-stop";
        row.notes.push(gateMessage(transport.status, payload));
        summary.cases[c.id] = row;
        stopped = row.notes[0];
        break;
      }
      row.schema = "fail";
      row.notes.push(`provider error (HTTP ${transport.status}): ${String((payload && payload.error) || "no plan")}`);
      failed = true;
      summary.cases[c.id] = row;
      await fs.writeFile(path.join(outDir, `${c.id}.status.json`), `${JSON.stringify(row, null, 2)}\n`, "utf8");
      continue;
    }
    rawPlan = payload.plan;
    await fs.writeFile(path.join(outDir, `${c.id}.plan.json`),
      `${JSON.stringify({ plan: rawPlan, usage: payload.usage || null, input_signature: payload.input_signature || null }, null, 2)}\n`, "utf8");

    let plan;
    try {
      // Normalized-envelope validation via the real review helper:
      // signature match, muse source, never pre-confirmed, then schema.
      ({ plan } = await requestPlanReview(
        { postPlan: async () => ({ plan: rawPlan, input_signature: payload.input_signature, usage: payload.usage }) },
        { input: reviewInput, provider: PROVIDER }));
      row.schema = "pass";
      row.notes.push(`normalized envelope ok (source ${plan.source}, signature match)`);
    } catch (err) {
      row.schema = "fail";
      row.notes.push(`schema: ${String((err && err.message) || err)}`);
      failed = true;
      summary.cases[c.id] = row;
      await fs.writeFile(path.join(outDir, `${c.id}.status.json`), `${JSON.stringify(row, null, 2)}\n`, "utf8");
      continue;
    }

    if ((plan.questions || []).length > 0 && (plan.confirmed === true)) {
      row.behavior = "fail";
      row.notes.push("plan arrived pre-confirmed despite open questions");
      failed = true;
    } else if ((plan.questions || []).length > 0) {
      // A legitimate question is review-needed, not a provider failure.
      // Never auto-confirm; still run the no-fabrication subset of checks.
      row.behavior = "review-needed";
      row.notes.push(`review needed (${plan.questions.length} question(s)); not confirmed`);
      const sub = checkBehavior(c.id, c.expect, scenario, plan);
      row.notes.push(...sub.notes.map((n) => `with-questions: ${n}`));
      if (!sub.pass) { row.behavior = "fail"; failed = true; }
    } else {
      const sub = checkBehavior(c.id, c.expect, scenario, plan);
      row.notes.push(...sub.notes);
      row.behavior = sub.pass ? "pass" : "fail";
      if (!sub.pass) failed = true;
    }
    summary.cases[c.id] = row;
    await fs.writeFile(path.join(outDir, `${c.id}.status.json`), `${JSON.stringify(row, null, 2)}\n`, "utf8");
  }

  for (const id of wanted) {
    if (!summary.cases[id]) summary.cases[id] = { id, schema: "not-run", behavior: "not-run", notes: [stopped || "not reached"] };
  }
  summary.stoppedEarly = stopped;
  await fs.writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const counts = Object.values(summary.cases).map((r) => `${r.id}:${r.schema}/${r.behavior}`).join(" ");
  console.log(`live-plan-matrix: ${counts}`);
  if (stopped) { console.error(`live-plan-matrix stopped: ${stopped}`); return 2; }
  return failed ? 1 : 0;
}

process.exit(await main());

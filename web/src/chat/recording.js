import { assetUrl } from "../paths.js";
import { stableStringify } from "../life/plan.js";

export const RECORDINGS = [
  { id: "menlo-month", title: "Meta 본사 출근 · 두 사람의 한 달", titleEn: "Commuting to Meta HQ · a month for two" },
  { id: "seoul-couple", title: "판교 출근 예비부부 · 집 사기 · 30일", titleEn: "Engaged couple buying a home, Pangyo commute · 30 days" },
];

export function recordingUrl(id) {
  return assetUrl("recorded/" + String(id) + ".json");
}

export function validateRecording(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") return { ok: false, errors: ["not an object"] };
  const messages = doc.messages;
  if (!Array.isArray(messages) || messages.length === 0) errors.push("messages empty");
  else {
    messages.forEach((m, i) => {
      if (!m || typeof m !== "object") errors.push("message " + i + " not an object");
      else {
        if (!m.role) errors.push("message " + i + " missing role");
        if (!m.kind) errors.push("message " + i + " missing kind");
      }
    });
  }
  const meta = doc.meta;
  if (!meta || typeof meta !== "object") errors.push("missing meta");
  else {
    if (typeof meta.id !== "string" || !/^[a-z0-9-]+$/.test(meta.id)) errors.push("bad meta.id");
    if (typeof meta.model !== "string" || meta.model === "") errors.push("bad meta.model");
  }
  return { ok: errors.length === 0, errors };
}

function labelsEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length
    && a.every((l, i) => l === b[i]);
}

function scenarioKey(scenario) {
  if (!scenario || typeof scenario !== "object") return null;
  try {
    return stableStringify(scenario);
  } catch {
    return null;
  }
}

// 47n: moneyDoc null is allowed only with an explicit string missing
// reason; old valid docs (moneyDoc object + moneyMissing string) behave
// as before.
function moneyOk(moneyDoc, moneyMissing) {
  if (typeof moneyMissing !== "string") return false;
  if (moneyDoc === null || moneyDoc === undefined) return moneyMissing.length > 0;
  return typeof moneyDoc === "object";
}

// 47n: a record needs its exact saved run (never a rule recompute) when
// the simulation carries real Muse/recorded choices — decisionMode
// 'muse', any model/fallback provenance, any model/rule_fallback house
// decision, or a confirmed life_plan. Never inferred from doc.meta.model
// (old Muse conversations used rules for daily choices).
export function replayRequiresStrict(data, scenario) {
  try {
    if (data && data.decisionMode === "muse") return true;
    const prov = data && data.provenance;
    if (prov && typeof prov === "object") {
      for (const k of Object.keys(prov)) {
        const p = prov[k] || {};
        if ((Number(p.model) || 0) > 0 || (Number(p.fallback) || 0) > 0) return true;
      }
    }
    const hd = data && data.houseDecisions;
    if (Array.isArray(hd)) {
      for (const h of hd) {
        const items = h && h.items;
        if (Array.isArray(items)
          && items.some((d) => d && (d.chosen_by === "model" || d.chosen_by === "rule_fallback"))) return true;
      }
    }
    if (scenario && scenario.life_plan
      && typeof scenario.life_plan === "object"
      && scenario.life_plan.confirmed === true) return true;
  } catch {
    // A data error never forces the strict path by itself.
  }
  return false;
}

// 47n: the optional doc.runBundle is the exact custom-run artifact from
// idb. Validated all-or-nothing against the LAST done simulation's
// customId, exact labels, exact scenario (canonical stable stringify),
// and every run's meta.home/seed/start_date/days plus trips/decisions/
// daily arrays. Missing/malformed/mismatched snapshots are not accepted
// (returns null) — never merge A from one artifact and B from another.
export function validateRunBundle(bundle, { customId, labels, scenario }) {
  try {
    if (!bundle || typeof bundle !== "object") return null;
    if (typeof bundle.id !== "string" || !bundle.id || bundle.id !== customId) return null;
    if (!labelsEqual(bundle.labels, labels)) return null;
    const want = scenarioKey(scenario);
    const got = scenarioKey(bundle.scenario);
    if (!want || !got || want !== got) return null;
    if (!bundle.runs || typeof bundle.runs !== "object") return null;
    for (const label of labels) {
      const run = bundle.runs[label];
      if (!run || typeof run !== "object") return null;
      const meta = run.meta;
      if (!meta || typeof meta !== "object") return null;
      if (meta.home !== label) return null;
      if (meta.seed !== scenario.seed) return null;
      if (meta.start_date !== scenario.start_date) return null;
      if (meta.days !== scenario.days) return null;
      if (!Array.isArray(run.trips) || !Array.isArray(run.decisions) || !Array.isArray(run.daily)) return null;
    }
    if (!bundle.names || typeof bundle.names !== "object") return null;
    if (!moneyOk(bundle.moneyDoc ?? null, bundle.moneyMissing ?? "")) {
      // Mirror the card rule exactly: object doc, or null only with a
      // non-empty string reason.
      if (!(bundle.moneyDoc && typeof bundle.moneyDoc === "object"
        && typeof bundle.moneyMissing === "string")) return null;
    }
    for (const k of ["lifePlan", "lifePlanSummary", "summary"]) {
      if (bundle[k] !== undefined && (typeof bundle[k] !== "object" || bundle[k] === null)) return null;
    }
    return bundle;
  } catch {
    return null;
  }
}

// 36i2/47n: the plan to rebuild a replay's 3D run in the browser. The
// last done simulation card carries the run's id, labels, names and
// money doc; doc.runBundle (when valid) carries the exact saved runs.
export function replayRunPlan(doc) {
  if (!doc || typeof doc !== "object") return null;
  if (!doc.scenario || typeof doc.scenario !== "object") return null;
  const messages = Array.isArray(doc.messages) ? doc.messages : null;
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const data = m && m.kind === "simulation" ? m.data : null;
    if (!data || data.status !== "done" || !data.customId) continue;
    const { customId, labels, names, moneyDoc, moneyMissing } = data;
    if (typeof customId !== "string" || !customId) return null;
    if (!Array.isArray(labels) || labels.length === 0) return null;
    if (!names || typeof names !== "object") return null;
    if (!moneyOk(moneyDoc ?? null, moneyMissing ?? "")) {
      if (!(moneyDoc && typeof moneyDoc === "object" && typeof moneyMissing === "string")) return null;
    }
    const requiresStrict = replayRequiresStrict(data, doc.scenario);
    const runBundle = validateRunBundle(doc.runBundle,
      { customId, labels, scenario: doc.scenario });
    return { customId, scenario: doc.scenario, labels, names, moneyDoc, moneyMissing, runBundle, requiresStrict };
  }
  return null;
}

// 47n: dependency-injected restore actually called by the chat replay
// boot (load/save/rule-run supplied). With a valid bundle the exact
// runs are saved — no re-simulation, no API. With strict required and
// no valid existing record it returns false — no rule worker, never
// faked equal homes. The legacy rule-only path alone uses the worker.
// Returns boolean, catches data errors, never mutates chat messages.
export async function restoreReplayRun(plan, deps) {
  try {
    if (!plan || typeof plan !== "object") return false;
    const { customId, labels, scenario } = plan;
    if (typeof customId !== "string" || !customId) return false;
    if (!Array.isArray(labels) || labels.length === 0) return false;
    if (!scenario || typeof scenario !== "object") return false;
    const { loadCustomRun, saveCustomRun, runWorker } = deps || {};
    if (plan.runBundle) {
      const valid = validateRunBundle(plan.runBundle, { customId, labels, scenario });
      if (!valid) return false;
      if (typeof saveCustomRun !== "function") return false;
      const record = { id: valid.id, scenario: valid.scenario, runs: valid.runs,
        labels: valid.labels, names: valid.names,
        moneyDoc: valid.moneyDoc ?? plan.moneyDoc,
        moneyMissing: valid.moneyMissing ?? plan.moneyMissing };
      for (const k of ["lifePlan", "lifePlanSummary", "summary"]) {
        if (valid[k] !== undefined) record[k] = valid[k];
      }
      await saveCustomRun(record);
      return true;
    }
    if (typeof loadCustomRun === "function") {
      const existing = await loadCustomRun(customId);
      if (existing && validateRunBundle({
        id: existing.id, scenario: existing.scenario, runs: existing.runs,
        labels: existing.labels, names: existing.names,
        moneyDoc: existing.moneyDoc, moneyMissing: existing.moneyMissing,
        ...(existing.lifePlan !== undefined ? { lifePlan: existing.lifePlan } : {}),
        ...(existing.lifePlanSummary !== undefined ? { lifePlanSummary: existing.lifePlanSummary } : {}),
        ...(existing.summary !== undefined ? { summary: existing.summary } : {}),
      }, { customId, labels, scenario })) return true;
      if (plan.requiresStrict) return false;
    } else if (plan.requiresStrict) return false;
    if (typeof runWorker !== "function" || typeof saveCustomRun !== "function") return false;
    const runs = await runWorker(scenario, labels);
    if (!runs || typeof runs !== "object") return false;
    await saveCustomRun({ id: customId, scenario, runs, labels,
      names: plan.names, moneyDoc: plan.moneyDoc, moneyMissing: plan.moneyMissing });
    return true;
  } catch {
    return false;
  }
}

export function replaySchedule(messages) {
  const list = Array.isArray(messages) ? messages : [];
  return list.map((m, index) => {
    if (m && m.role === "user") return { index, delayMs: 700 };
    if (m && (m.kind === "text" || m.kind === "system")) return { index, delayMs: 1200 };
    return { index, delayMs: 1600 };
  });
}

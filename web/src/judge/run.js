// Judge runner: decide the household's branches with a Meta model.
//
// The engine is synchronous but provider calls are async, and a choice
// can shift the rest of the member's day (decision ids carry minutes),
// so judging runs iteratively: simulate with everything fixed so far,
// judge the earliest unfixed household shell with its exact context
// (today's trips so far are final at that point), fix it, repeat.
// Agents are independent and household agents run first, so the
// background count never changes a household shell — judging iterations
// run with background 0 for speed, the final run with the full
// background. Call order is deterministic: members in agent order,
// each in day/minute order, strictly sequential.
//
// Only household shells reach the provider; background branches resolve
// by rule inside the same runs. Every fixed entry carries its
// provenance (chosen_by model|rule_fallback, reasons, provider, model,
// tokens, latency, and the refused reply as `rejected` on guard
// fallbacks), so the judged run and its --decisions replay are
// byte-identical.

import { simulate, ENGINE_VERSION } from "../engine/simulate.js";
import { parseScenario } from "../engine/scenario.js";
import { complete, providerConfig } from "./providers.js";
import { buildPrompt, estimateTokens, COMPLETION_TOKENS_EST } from "./context.js";
import { checkOutput, ruleReason } from "./guards.js";
// 44b: the iterative household loop lives in the browser-safe
// household.js; judgeHome keeps its API and delegates to it.
import {
  householdKeysOf, shellContext, defaultWeekend, entryToAnswer,
  runHouseholdLoop,
} from "./household.js";

export { entryToAnswer };

// Price per 1 M tokens: [input, cached input, output]. Baseten reports
// tokens only (no USD estimate).
export const PRICING = {
  meta: { input: 1.25, cached: 0.15, output: 4.25 },
  baseten: null,
};

export function costUsd(provider, usage) {
  const p = PRICING[provider];
  if (!p) return null;
  const prompt = usage.prompt_tokens || 0;
  const cached = usage.cached_tokens || 0;
  // completion_tokens already include reasoning_tokens — never add both.
  const completion = usage.completion_tokens || 0;
  return ((prompt - cached) * p.input + cached * p.cached + completion * p.output) / 1e6;
}

export function emptyUsage() {
  return {
    calls: 0, errors: 0, fallbacks: 0,
    prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, reasoning_tokens: 0, latency_ms: 0,
  };
}

function addUsage(usage, u) {
  usage.prompt_tokens += u.prompt_tokens || 0;
  usage.completion_tokens += u.completion_tokens || 0;
  usage.cached_tokens += u.cached_tokens || 0;
  usage.reasoning_tokens += u.reasoning_tokens || 0;
}

function clone(value) {
  return structuredClone(value);
}

// (householdKeysOf/shellContext now live in ./household.js; judgeHome
// delegates to runHouseholdLoop.)

// Judge one shell through the provider (or fail soft to the rule).
// Returns the replay-style entry to fix for this id. ctx is the prompt
// context the guard checks cited numbers against; guard rejections
// keep the refused reply as `rejected` (parsed fields only, never raw).
export async function judgeSingle({ provider, prompt, shell, ctx = null, usage, fetchImpl, providerOpts = {} }) {
  const rule = ruleReason(shell);
  const fallback = (cause, extra = {}) => ({
    ...(shell.kind === "weekend_plan"
      ? defaultWeekend(shell)
      : { chosen_key: shell.default_key }),
    chosen_by: "rule_fallback",
    reason_ko: rule.reason_ko,
    reason_en: rule.reason_en,
    fallback_cause: cause,
    ...extra,
  });
  let res;
  try {
    res = await complete({
      provider, system: prompt.system, user: prompt.user,
      schema: prompt.schema, schemaName: prompt.schemaName,
      fetchImpl, ...(providerOpts || {}),
    });
  } catch (err) {
    usage.errors++;
    usage.fallbacks++;
    const code = err && err.code;
    const cause = code === "bad_json" ? "bad_json" : code === "truncated" ? "truncated" : "provider_error";
    if (cause === "truncated" && err.usage) {
      // The budget cut the reply, but the tokens (mostly reasoning) were
      // spent and reported — count them and keep them on the entry.
      addUsage(usage, err.usage);
      return fallback(cause, {
        provider, model: providerConfig(provider).model, usage: err.usage,
      });
    }
    return fallback(cause);
  }
  usage.calls++;
  addUsage(usage, res.usage);
  usage.latency_ms += res.latency_ms || 0;
  const check = checkOutput(shell, res.json, ctx);
  if (!check.ok) {
    usage.fallbacks++;
    return fallback(check.cause, {
      provider, model: res.model, usage: res.usage, latency_ms: res.latency_ms,
      ...(check.rejected ? { rejected: check.rejected } : {}),
    });
  }
  return {
    chosen_key: check.chosen_key,
    ...(check.plan !== null ? { plan: check.plan } : {}),
    chosen_by: "model",
    reason_ko: check.reason_ko,
    reason_en: check.reason_en,
    provider,
    model: res.model,
    usage: res.usage,
    latency_ms: res.latency_ms,
  };
}

// (defaultWeekend/entryToAnswer now live in ./household.js and are
// re-exported above.)

// Full judging pass for one home. judgeOne defaults to the live
// provider path; tests inject a fake.
export async function judgeHome({
  area, scenarioRaw, homeLabel, provider,
  fetchImpl = null, providerOpts = {}, judgeOne = null,
  region = null, destArea = null,
}) {
  providerConfig(provider); // unknown provider throws before any work
  const usage = emptyUsage();
  const judge = judgeOne || ((args) => judgeSingle({ provider, fetchImpl, providerOpts, usage, ...args }));
  // The iterative loop (member/day order, short memory, guards,
  // deterministic replay) lives in ./household.js; usage and the
  // per-kind counts keep the exact semantics they always had.
  const { run: finalRun, fixed } = await runHouseholdLoop({
    area, scenarioRaw, homeLabel, region, destArea, judgeOne: judge,
  });
  const household = householdKeysOf(parseScenario(clone(scenarioRaw)).household.members);
  const byKind = {};
  for (const d of finalRun.decisions) {
    if (!household.has(d.agent)) continue;
    byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  }
  return {
    run: finalRun,
    decisions: finalRun.decisions,
    usage: { ...usage, by_kind: byKind },
    fixed: [...fixed.keys()],
  };
}

// Dry run: the exact call list (one rule pass, no network) plus token
// and cost estimates. Memory is empty here, so input tokens are a
// slight underestimate — noted in the output.
export function planCalls(area, scenarioRaw, homeLabel, opts = {}) {
  const scenario = parseScenario(clone(scenarioRaw));
  const members = scenario.household.members;
  const household = householdKeysOf(members);
  const lean = clone(scenarioRaw);
  lean.background = 0;
  const shells = [];
  const run = simulate(area, lean, homeLabel, {
    ...(opts.destArea ? { destArea: opts.destArea } : {}),
    decide: (shell) => {
      if (household.has(shell.agent)) shells.push(shell);
      return shell.kind === "weekend_plan"
        ? { ...defaultWeekend(shell), chosen_by: "rule" }
        : { chosen_key: shell.default_key, chosen_by: "rule" };
    },
  });
  let estInput = 0;
  const calls = shells.map((shell) => {
    const ctx = shellContext({ scenario, run, shell, members, memory: new Map() });
    const prompt = buildPrompt(ctx);
    const tokens = estimateTokens(prompt.system) + estimateTokens(prompt.user);
    estInput += tokens;
    return { id: shell.id, agent: shell.agent, day: shell.day, minute: shell.minute, kind: shell.kind, est_input_tokens: tokens };
  });
  const estCompletion = calls.length * COMPLETION_TOKENS_EST;
  return {
    home: homeLabel,
    calls: calls.length,
    by_kind: calls.reduce((m, c) => ({ ...m, [c.kind]: (m[c.kind] || 0) + 1 }), {}),
    est_input_tokens: estInput,
    est_completion_tokens: estCompletion,
    est_usd_meta: ((estInput * PRICING.meta.input + estCompletion * PRICING.meta.output) / 1e6),
    note: "input tokens exclude short memory (empty here); add ~10 % headroom",
    engine: ENGINE_VERSION,
    call_list: calls,
  };
}

export function decisionsFile({ scenarioName, homeLabel, provider, decisions, usage }) {
  return {
    meta: {
      scenario: scenarioName,
      home: homeLabel,
      provider,
      model: providerConfig(provider).model,
      engine: ENGINE_VERSION,
      choices: "mixed",
      usage: { ...usage, est_usd: costUsd(provider, usage) },
    },
    decisions,
  };
}

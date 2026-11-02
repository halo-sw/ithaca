// Household judge loop (browser-safe): the reusable core of run.js.
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
// Browser-safe: no network, no env, no provider imports. The caller
// injects `judgeOne({prompt, shell, ctx})` — the live provider path,
// one guarded /api/consult call per branch, or a test fake — and an
// optional `onProgress` sink. Only household shells reach the judge;
// background branches resolve by rule inside the same runs.
//
// Region/destArea ride EVERY pass (lean, final): decision shells carry
// minutes, so a missing destination graph would shift the lean
// timeline away from the final one (shell drift). Unjudged household
// shells never survive silently: the final pass throws when a
// household branch has no fixed entry.

import { simulate } from "../engine/simulate.js";
import { dateOf, weekdayOf, WEEKDAYS, parseScenario } from "../engine/scenario.js";
import { buildPrompt } from "./context.js";

function clone(value) {
  return structuredClone(value);
}

// Household agent keys (h1, h2, …) in member order; background keys
// never collide (b01, …).
export function householdKeysOf(members) {
  return new Set(members.map((_, i) => `h${i + 1}`));
}

function agentIndex(key) {
  const n = Number.parseInt(String(key).slice(1), 10);
  return Number.isInteger(n) ? n - 1 : 0;
}

function slimTrip(t) {
  return {
    depart_min: t.depart_min, arrive_min: t.arrive_min, purpose: t.purpose,
    from_label: (t.from && (t.from.label || t.from.id)) || "",
    to_label: (t.to && (t.to.label || t.to.id)) || "",
    minutes: t.minutes, distance_m: t.distance_m,
  };
}

export function shellContext({ scenario, run, shell, members, memory }) {
  const idx = agentIndex(shell.agent);
  const agent = run.agents.find((a) => a.key === shell.agent) || {};
  const tripsToday = run.trips
    .filter((t) => t.agent === shell.agent && t.day === shell.day && t.depart_min < shell.minute)
    .map(slimTrip);
  return {
    member: members[idx] || { role: agent.role || "adult", preferences: "" },
    agentLabel: agent.label || shell.agent,
    date: dateOf(scenario.start_date, shell.day),
    weekday: WEEKDAYS[weekdayOf(scenario.start_date, shell.day)],
    minute: shell.minute,
    tripsToday,
    memory: (memory.get(shell.agent) || []).slice(-3),
    shell,
  };
}

export function defaultWeekend(shell) {
  if (shell.default_key === "home") return { chosen_key: "home", plan: [] };
  return { chosen_key: shell.default_key, plan: [shell.default_key] };
}

export function entryToAnswer(entry) {
  const answer = { chosen_key: entry.chosen_key, chosen_by: entry.chosen_by };
  for (const k of ["plan", "reason_ko", "reason_en", "provider", "model",
      "usage", "latency_ms", "fallback_cause", "rejected"]) {
    if (entry[k] !== undefined) answer[k] = entry[k];
  }
  return answer;
}

// Full judging pass for one home. Returns the final run, the fixed
// entries (id -> entry, model or explicit rule_fallback), the short
// memory, and provenance counts. A judge failure rejects — the caller
// stops the run instead of quietly continuing a month by rules.
export async function runHouseholdLoop({
  area, scenarioRaw, homeLabel, region = null, destArea = null,
  judgeOne, onProgress = null,
}) {
  if (typeof judgeOne !== "function") throw new Error("judgeOne is required");
  const scenario = parseScenario(clone(scenarioRaw));
  const members = scenario.household.members;
  const household = householdKeysOf(members);
  const lean = clone(scenarioRaw);
  lean.background = 0; // household shells are identical either way
  const fixed = new Map(); // id -> entry
  const memory = new Map(); // agent -> [{day, minute, kind, chosen, reason_ko}]
  // The SAME graphs on every pass — lean, final — so fixed shells
  // land on the same timeline in both.
  const sharedOpts = {
    ...(region ? { region } : {}),
    ...(destArea ? { destArea } : {}),
  };
  let modelCount = 0;
  let fallbackCount = 0;
  const report = (shell, entry) => {
    if (typeof onProgress !== "function") return;
    const agent = shell.agent;
    const labelOf = (() => {
      const m = members[agentIndex(agent)];
      return (m && m.label) || agent;
    })();
    onProgress({
      home: homeLabel, agent, agentLabel: labelOf,
      day: shell.day, kind: shell.kind,
      completed: fixed.size, modelCount, fallbackCount,
      reason_en: (entry && entry.reason_en) || "",
      reason_ko: (entry && entry.reason_ko) || "",
    });
  };
  for (;;) {
    const pending = [];
    const run = simulate(area, clone(lean), homeLabel, {
      ...sharedOpts,
      decide: (shell) => {
        if (fixed.has(shell.id)) return entryToAnswer(fixed.get(shell.id));
        if (!household.has(shell.agent)) {
          return { chosen_key: shell.default_key, chosen_by: "rule" };
        }
        pending.push(shell);
        return shell.kind === "weekend_plan"
          ? { ...defaultWeekend(shell), chosen_by: "rule" }
          : { chosen_key: shell.default_key, chosen_by: "rule" };
      },
    });
    if (pending.length === 0) break;
    const shell = pending[0];
    const ctx = shellContext({ scenario, run, shell, members, memory });
    // A rejection here (provider down, timeout, malformed answer the
    // caller will not fix) aborts the whole pass: the caller must
    // stop, never fill the month with silent rules.
    const entry = await judgeOne({ prompt: buildPrompt(ctx), shell, ctx });
    if (!entry || typeof entry.chosen_key !== "string") {
      throw new Error(`judge returned no usable entry for ${shell.id}`);
    }
    fixed.set(shell.id, entry);
    if (entry.chosen_by === "model") modelCount++;
    else if (entry.chosen_by === "rule_fallback") fallbackCount++;
    if (!memory.has(shell.agent)) memory.set(shell.agent, []);
    memory.get(shell.agent).push({
      day: shell.day, minute: shell.minute, kind: shell.kind,
      chosen: entry.plan !== undefined
        ? (entry.plan.length === 0 ? "home" : entry.plan.join("+"))
        : entry.chosen_key,
      reason_ko: entry.reason_ko,
    });
    report(shell, entry);
  }

  // Final run: full background, household fixed, background by rule.
  const finalRun = simulate(area, clone(scenarioRaw), homeLabel, {
    ...sharedOpts,
    decide: (shell) => {
      if (fixed.has(shell.id)) return entryToAnswer(fixed.get(shell.id));
      return { chosen_key: shell.default_key, chosen_by: "rule" };
    },
  });
  // No silent shells: every household branch in the final run must
  // carry a saved model entry or an explicit guarded rule_fallback.
  const missing = finalRun.decisions
    .filter((d) => household.has(d.agent) && !fixed.has(d.id))
    .map((d) => d.id);
  if (missing.length > 0) {
    throw new Error(`unjudged household shells in final run: ${missing.join(", ")}`);
  }
  return {
    run: finalRun,
    fixed,
    memory,
    counts: { model: modelCount, fallback: fallbackCount },
  };
}

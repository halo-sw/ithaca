// 47g: pure life-plan review -> confirm -> run orchestration.
// All side effects (planner call, worker run) are injected so tests
// drive the full sequence with fakes: first click calls the planner
// once and never the worker; the worker runs only after an explicit
// confirmation against an identical input signature + provider + picks.
import {
  buildLifePlanInput,
  validateLifePlan,
  confirmLifePlan,
  applyLifePlan,
  summarizePlanRun,
} from "../life/plan.js";

export function userHistory(messages) {
  return (Array.isArray(messages) ? messages : []).filter(
    (m) => m && m.role === "user" && typeof m.content === "string" && m.content.length > 0,
  );
}

// Snapshot of the live conditions a review was requested under. The
// input signature covers scenario/profile/message content; the snapshot
// additionally pins the provider, the picked homes, and how many user
// turns existed, so a late model response is dropped when anything moved.
export function reviewSnapshot({ profileText, pickedIds, provider, messages }) {
  return {
    profileText: String(profileText || ""),
    picks: [...(Array.isArray(pickedIds) ? pickedIds : [])].sort().join(","),
    provider: String(provider || ""),
    userCount: userHistory(messages).length,
  };
}

export function sameSnapshot(a, b) {
  return !!a && !!b
    && a.profileText === b.profileText
    && a.picks === b.picks
    && a.provider === b.provider
    && a.userCount === b.userCount;
}

export function reviewKey({ inputSignature, provider, pickedIds }) {
  const picks = [...(Array.isArray(pickedIds) ? pickedIds : [])].sort().join(",");
  return `${String(inputSignature)}|${String(provider)}|${picks}`;
}

// Latest-first search for a review card that is still usable for the
// current inputs. Anything else (stale signature, provider or home
// change, error/stale status) must regenerate, never run old conditions.
export function findFreshReview(messages, { inputSignature, provider, snapshot }) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.kind !== "life_plan" || !m.data) continue;
    if (m.data.status !== "review" || !m.data.plan || !m.data.input) continue;
    if (m.data.input.input_signature !== inputSignature) continue;
    if (m.data.provider !== provider) continue;
    if (!sameSnapshot(m.data.snapshot, snapshot)) continue;
    return m;
  }
  return null;
}

export function buildReviewInput({ scenario, profile, messages, lang }) {
  return buildLifePlanInput({ scenario, profile, messages, lang });
}

// Exactly one planner call, no worker. Throws on transport failure or
// malformed model output — the caller shows a retry card, never a run.
//
// The real endpoint returns a NORMALIZED plan (input_signature, source,
// confirmed, days). validateLifePlan rejects those extra top-level keys,
// so the schema fields are projected out first, then the normalized
// envelope is checked: the signature must match the current input, the
// source must be muse, and a pre-confirmed plan is always forged.
export async function requestPlanReview({ postPlan }, { input, provider }) {
  if (typeof postPlan !== "function") throw new Error("life-plan: postPlan must be a function");
  if (!input || typeof input.input_signature !== "string") {
    throw new Error("life-plan: input must carry input_signature");
  }
  const res = await postPlan({ input, provider });
  const raw = res && res.plan;
  if (!raw || typeof raw !== "object") throw new Error("life-plan: empty plan response");
  if (raw.confirmed === true) throw new Error("life-plan: a review plan is never pre-confirmed");
  if (raw.source !== "muse") {
    throw new Error(`life-plan: unexpected plan source ${JSON.stringify(raw.source)}`);
  }
  if (typeof raw.input_signature !== "string" || raw.input_signature !== input.input_signature) {
    throw new Error("life-plan: stale plan: profile, homes, dates, criteria, seed, or household changed since this plan was made");
  }
  if (res.input_signature !== undefined && res.input_signature !== input.input_signature) {
    throw new Error("life-plan: stale plan: profile, homes, dates, criteria, seed, or household changed since this plan was made");
  }
  // Schema-only projection: extra top-level keys are never trusted or
  // silently carried; validateLifePlan re-checks every member/change.
  const schema = {
    members: raw.members,
    observations: raw.observations,
    questions: raw.questions,
    unmodeled: raw.unmodeled,
  };
  if (raw.review !== undefined) schema.review = raw.review;
  const plan = validateLifePlan(schema, input);
  const usage = res.usage && typeof res.usage === "object" ? res.usage : null;
  return { plan, usage };
}

// Explicit confirmation only: re-validates the plan against the current
// input (stale/forged/question-blocked plans throw here), applies it to a
// fresh scenario copy, then runs the worker on the applied scenario.
// Missing routes are checked by the caller AFTER apply, on this scenario.
export async function confirmReviewAndRun({ runWorker }, { plan, input, scenario, labels }) {
  if (typeof runWorker !== "function") throw new Error("life-plan: runWorker must be a function");
  const confirmed = confirmLifePlan(plan, input);
  const applied = applyLifePlan(scenario, confirmed, input);
  const runs = await runWorker(applied, Array.isArray(labels) ? labels : []);
  const summaries = {};
  for (const l of (Array.isArray(labels) ? labels : [])) {
    summaries[l] = summarizePlanRun(runs[l], confirmed);
  }
  return { confirmed, applied, runs, summaries };
}

// Single-flight guard: double clicks and duplicate automatic tool actions
// must not start a second plan or run while one is in flight. This guard
// is independent of the chat composer's busy flag so a legitimate
// internal handoff (send -> agent tool run action -> plan flow) is never
// suppressed merely because the chat turn is busy.
export function createPlanGuard() {
  let busy = false;
  return {
    get busy() { return busy; },
    tryAcquire() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() { busy = false; },
  };
}

// Freshness check for an explicit confirmation: the stored review matches
// the CURRENT input signature + provider + snapshot (picks, profile,
// provider, user-turn count) and has no unresolved questions. Anything
// else is stale — the caller builds a fresh review for the current
// inputs and never runs the old conditions.
export function isConfirmFresh({ stored, input, snapshot, provider }) {
  const s = stored || {};
  const questions = (s.plan && s.plan.questions) || [];
  const fresh = !!(s.plan && s.input
    && input && s.input.input_signature === input.input_signature
    && s.provider === provider
    && sameSnapshot(s.snapshot, snapshot)
    && questions.length === 0);
  return { fresh, questionCount: questions.length };
}

// Worker-body freshness: after the run body awaited its data loads, the
// freshly rebuilt input + snapshot + provider must still match the
// confirmed review payload — never the applied scenario's signature
// (the base input was signed before apply). Any move means stale retry,
// never an invented stale success, never the worker.
export function isConfirmedWorkerFresh({ extras, input, snapshot, provider }) {
  if (!extras || !extras.input || !extras.snapshot || !extras.provider) return false;
  return !!input && !!snapshot
    && input.input_signature === extras.input.input_signature
    && extras.provider === provider
    && sameSnapshot(extras.snapshot, snapshot);
}

// Explicit holder for one staged confirmed execution payload. The payload
// is staged only after confirm + apply succeed and is consumed exactly
// once by the run body; every other path (stale review, preparation or
// confirmation failure) leaves nothing staged, so no old applied scenario
// is ever reused by a later run and double confirmed runs are refused.
export function createConfirmedTransaction() {
  let pending = null;
  return {
    get pending() { return pending; },
    stage(payload) {
      if (pending) return false;
      pending = payload;
      return true;
    },
    consume() {
      const p = pending;
      pending = null;
      return p;
    },
    clear() { pending = null; },
  };
}

// 49b: saved Muse decision examples (pure, SSR-safe).
//
// makeHouseholdDecisionExamples(run, members) selects at most 4 saved
// decision records for display. Selection never reads reason text:
// per household member (in run.agents household order) it prefers the
// first changed-default example, else the first recorded choice, in
// stable chronological order; remaining slots add a different decision
// kind and/or a non-default choice. Inputs are never mutated and no
// values are invented for missing data (unknown minutes are null,
// never 0; an absent chosen_key is never treated as a default change).

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function copyOption(o) {
  if (!o || typeof o !== "object") return null;
  const key = typeof o.key === "string" ? o.key : null;
  const label = typeof o.label === "string" ? o.label : null;
  const minutes = isFiniteNumber(o.minutes) ? o.minutes : null;
  const distance_m = isFiniteNumber(o.distance_m) ? o.distance_m : null;
  const out = { key, label, minutes, distance_m };
  if (typeof o.poi_id === "string" && o.poi_id) out.poi_id = o.poi_id;
  return out;
}

function optionByKey(options, key) {
  if (typeof key !== "string") return null;
  for (const o of options) {
    if (o && o.key === key) return o;
  }
  return null;
}

// Same label rule as the transcript payload (44b2): chosen option's
// saved label, never a raw key. Stay-home (empty plan array) resolves
// through the saved "home" option; unknown labels stay "" so the
// display layer can fall back language-aware without inventing names.
function chosenLabelFor(d, options) {
  const nameOf = (key) => {
    const o = optionByKey(options, key);
    return (o && typeof o.label === "string" && o.label) || null;
  };
  if (Array.isArray(d.plan)) {
    if (d.plan.length === 0) return nameOf("home") || "";
    return d.plan.map((k) => nameOf(k) || k).join("+");
  }
  return nameOf(d.chosen_key) || "";
}

function defaultLabelFor(d, options) {
  if (typeof d.default_key !== "string") return null;
  const o = optionByKey(options, d.default_key);
  return (o && typeof o.label === "string" && o.label) || null;
}

function exampleIdFor(d, fallback) {
  if (d && typeof d.id === "string" && d.id) return d.id;
  return fallback;
}

function memberAt(members, idx, householdAgent) {
  const cand = Array.isArray(members) ? members[idx] : null;
  if (!cand || typeof cand !== "object") return null;
  // Verify positional mapping against run.agents: when both sides carry
  // an id they must agree, otherwise the scenario row is not ours.
  if (
    typeof cand.id === "string" && cand.id &&
    householdAgent && typeof householdAgent.id === "string" && householdAgent.id &&
    cand.id !== householdAgent.id
  ) {
    return null;
  }
  return cand;
}

function memberLabelFor(member, householdAgent) {
  if (member && typeof member.label === "string" && member.label) return member.label;
  if (householdAgent && typeof householdAgent.label === "string" && householdAgent.label) {
    return householdAgent.label;
  }
  return null;
}

function memberPreferencesFor(member) {
  if (!member || typeof member !== "object") return null;
  const v = member.preferences !== undefined ? member.preferences : member.preference;
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

export function makeHouseholdDecisionExamples(run, members) {
  const agents = run && Array.isArray(run.agents) ? run.agents : [];
  const householdAgents = agents.filter((a) => a && a.household);
  const householdKeys = householdAgents.map((a) => a.key);
  const raw = run && Array.isArray(run.decisions) ? run.decisions : [];
  if (householdKeys.length === 0 || raw.length === 0) return [];

  // Stable chronological order: day, minute, then record order.
  // Missing day/minute sort last; never invented for the payload.
  const ordered = raw
    .map((d, origIndex) => ({ d, origIndex }))
    .filter(({ d }) => d && typeof d === "object"
      && typeof d.agent === "string"
      && householdKeys.includes(d.agent))
    .sort((a, b) => {
      const da = isFiniteNumber(a.d.day) ? a.d.day : Number.MAX_SAFE_INTEGER;
      const db = isFiniteNumber(b.d.day) ? b.d.day : Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      const ma = isFiniteNumber(a.d.minute) ? a.d.minute : Number.MAX_SAFE_INTEGER;
      const mb = isFiniteNumber(b.d.minute) ? b.d.minute : Number.MAX_SAFE_INTEGER;
      if (ma !== mb) return ma - mb;
      return a.origIndex - b.origIndex;
    });

  const isDefaultChangeOf = (d) =>
    typeof d.chosen_key === "string"
    && typeof d.default_key === "string"
    && d.chosen_key !== d.default_key;

  // Distinct IDs: keep the first record per saved id; records without
  // an id get a stable positional fallback id (identifier only).
  const seen = new Set();
  const unique = [];
  for (const { d, origIndex } of ordered) {
    const fallback = `${d.agent}:${String(d.day)}:${String(d.minute)}:${String(d.kind)}:${origIndex}`;
    const id = exampleIdFor(d, fallback);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push({ d, origIndex, id, changed: isDefaultChangeOf(d) });
  }

  const byAgent = new Map();
  for (const e of unique) {
    if (!byAgent.has(e.d.agent)) byAgent.set(e.d.agent, []);
    byAgent.get(e.d.agent).push(e);
  }

  // One representative per member, household order first.
  const picked = [];
  const pickedKeys = new Set();
  for (const key of householdKeys) {
    if (picked.length >= 4) break;
    const list = byAgent.get(key) || [];
    if (list.length === 0) continue;
    const changed = list.find((e) => e.changed);
    const rep = changed || list[0];
    picked.push(rep);
    pickedKeys.add(rep.id);
  }

  // Fill remaining slots (at most 4 total) only with records that add
  // a different decision kind and/or a non-default choice, chronology
  // tiebreak. Records adding neither are left out (no padding).
  if (picked.length < 4) {
    const kinds = new Set(picked.map((e) => e.d.kind));
    const rest = unique.filter((e) => !pickedKeys.has(e.id));
    for (const e of rest) {
      if (picked.length >= 4) break;
      if (kinds.has(e.d.kind) && !e.changed) continue;
      picked.push(e);
      pickedKeys.add(e.id);
      kinds.add(e.d.kind);
    }
  }

  // Build display-ready examples without mutating raw records.
  const out = picked.map(({ d, id }) => {
    const idx = householdKeys.indexOf(d.agent);
    const householdAgent = idx >= 0 ? householdAgents[idx] : null;
    const member = memberAt(members, idx, householdAgent);
    const options = (Array.isArray(d.options) ? d.options : []).map(copyOption).filter(Boolean);
    const plan = Array.isArray(d.plan) ? [...d.plan] : undefined;
    const default_key = typeof d.default_key === "string" ? d.default_key : null;
    let chosen_minutes = null;
    let chosen_distance_m = null;
    let chosen_legs = [];
    if (Array.isArray(plan)) {
      if (plan.length === 0) {
        const home = optionByKey(options, "home");
        chosen_minutes = home && isFiniteNumber(home.minutes) ? home.minutes : null;
        chosen_distance_m = home && isFiniteNumber(home.distance_m) ? home.distance_m : null;
        chosen_legs = home ? [home] : [];
      } else {
        chosen_legs = plan.map((k) => optionByKey(options, k)).filter(Boolean);
        chosen_minutes = null;
        chosen_distance_m = null;
      }
    } else {
      const o = optionByKey(options, d.chosen_key);
      chosen_minutes = o && isFiniteNumber(o.minutes) ? o.minutes : null;
      chosen_distance_m = o && isFiniteNumber(o.distance_m) ? o.distance_m : null;
      chosen_legs = o ? [o] : [];
    }
    const example = {
      id,
      agent: d.agent,
      follow: idx >= 0 ? idx + 1 : 1,
      memberLabel: memberLabelFor(member, householdAgent),
      memberPreferences: memberPreferencesFor(member),
      day: d.day,
      minute: d.minute,
      kind: typeof d.kind === "string" ? d.kind : null,
      options,
      default_key,
      default_label: defaultLabelFor(d, options),
      chosen_label: chosenLabelFor(d, options),
      chosen_minutes,
      chosen_distance_m,
      chosen_legs,
      isDefaultChange: isDefaultChangeOf(d),
    };
    if (d.chosen_key !== undefined) example.chosen_key = d.chosen_key;
    if (plan !== undefined) example.plan = plan;
    if (d.chosen_by !== undefined) example.chosen_by = d.chosen_by;
    if (d.reason_ko !== undefined) example.reason_ko = d.reason_ko;
    if (d.reason_en !== undefined) example.reason_en = d.reason_en;
    example.provider = typeof d.provider === "string" ? d.provider : null;
    example.model = typeof d.model === "string" ? d.model : null;
    return example;
  });

  // Stable output order: chronological, not selection order.
  out.sort((a, b) => {
    const da = isFiniteNumber(a.day) ? a.day : Number.MAX_SAFE_INTEGER;
    const db = isFiniteNumber(b.day) ? b.day : Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    const ma = isFiniteNumber(a.minute) ? a.minute : Number.MAX_SAFE_INTEGER;
    const mb = isFiniteNumber(b.minute) ? b.minute : Number.MAX_SAFE_INTEGER;
    if (ma !== mb) return ma - mb;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  });
  return out.slice(0, 4);
}

// 47q — synthetic illustrative households for the live planning matrix.
// Optional companion to web/scripts/live-plan-matrix.mjs (orchestrator runs it).
// All households are explicitly hypothetical; no personal family claims.
// Each case carries ONE explicit user message with every stated condition,
// plus production-shaped profile/scenario builders on stable m1/m2/... ids.
export const CASE_IDS = ["solo", "couple", "family4", "remote", "working_senior", "dog_owner", "combined"];

const FULL_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// Baseline: clinic/vet/cafe/park frequencies cleared to zero unless the
// case explicitly states them; errands default to zero and each case opts in.
function baseMember(id, label, role, extra = {}) {
  return {
    id, label, role,
    clinic_visits_per_month: 0,
    cafe_visits_per_week: 0,
    vet_visits_per_month: 0,
    park_walks_per_week: 0,
    errands_per_week: { supermarket: 0, convenience: 0 },
    ...clone(extra),
  };
}

function profileFor(entries) {
  return { members: { value: entries, source: "customer" } };
}

function userMsg(text) {
  return [{ role: "user", content: text }];
}

const MSG = {
  solo: "Hypothetical household check (not a real family). I live alone. I work at the known Pangyo office five weekdays, Mon to Fri. I go to the supermarket once a week. I prefer quiet mornings.",
  couple: "Hypothetical household check (not a real family). Two adults sharing the known Pangyo office. Member one works onsite Mon, Wed and Fri and prefers quiet mornings. Member two works onsite Tue and Thu and prefers evening walks.",
  family4: "Hypothetical household check (not a real family). Two adults plus two children aged 9 and 15. The children follow weekday school routines, but their actual schools are not confirmed and no enrollment is decided. Weekday school attendance Mon to Fri is assumed only.",
  remote: "Hypothetical household check (not a real family). One adult working remotely with no commute. I never work from cafes. I buy groceries once a week.",
  working_senior: "Hypothetical household check (not a real family). One senior who still works at the known Pangyo office on Mon, Wed and Fri. There are no clinic appointments and no medical needs stated.",
  dog_owner: "Hypothetical household check (not a real family). One adult living with a dog. I walk the dog every morning. There are no scheduled vet visits.",
  combined: "Hypothetical household check (not a real family). One hybrid adult working at the known Pangyo office Mon and Wed and from home other weekdays, one working senior at the same office Mon, Wed and Fri, one school-age child whose actual school is unknown, and a family dog walked every morning by the hybrid adult. Can school pickup coordination be checked?",
};

export function buildCases(base) {
  const work = clone(base.work);
  const homes = clone(base.homes);
  const head = { start_date: base.start_date, days: base.days, seed: base.seed };
  if (base.workday_minutes !== undefined) head.workday_minutes = base.workday_minutes;
  if (base.schoolday_minutes !== undefined) head.schoolday_minutes = base.schoolday_minutes;

  return [
    {
      id: "solo",
      title: "Solo adult, known Pangyo office, five weekdays",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [baseMember("m1", "Member 1", "adult",
            { workdays: [...FULL_WEEK], work, preferences: "I prefer quiet mornings." })] } };
        const profile = profileFor([
          { role: "adult", label: "Member 1", preferences: "I prefer quiet mornings.",
            workdays: [...FULL_WEEK], errands_per_week: { supermarket: 1, convenience: 0 } },
        ]);
        return { scenario, profile, messages: userMsg(MSG.solo) };
      },
      expect: { workdays: { m1: [...FULL_WEEK] },
        preferencesContain: { m1: ["quiet morning"] }, errands: { m1: { supermarket: 1 } } },
    },
    {
      id: "couple",
      title: "Two adults, shared office, split onsite days",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [
            baseMember("m1", "Member 1", "adult",
              { workdays: ["Mon", "Wed", "Fri"], work, preferences: "I prefer quiet mornings." }),
            baseMember("m2", "Member 2", "adult",
              { workdays: ["Tue", "Thu"], work, preferences: "I prefer evening walks." }),
          ] } };
        const profile = profileFor([
          { role: "adult", label: "Member 1", preferences: "I prefer quiet mornings.", workdays: ["Mon", "Wed", "Fri"] },
          { role: "adult", label: "Member 2", preferences: "I prefer evening walks.", workdays: ["Tue", "Thu"] },
        ]);
        return { scenario, profile, messages: userMsg(MSG.couple) };
      },
      expect: { workdays: { m1: ["Mon", "Wed", "Fri"], m2: ["Tue", "Thu"] },
        preferencesContain: { m1: ["quiet morning"], m2: ["evening walk"] }, sharedOffice: true },
    },
    {
      id: "family4",
      title: "Two adults plus children 9 and 15, schools unconfirmed",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [
            baseMember("m1", "Adult 1", "adult", { workdays: [...FULL_WEEK], work }),
            baseMember("m2", "Adult 2", "adult", { workdays: [...FULL_WEEK], work }),
            baseMember("m3", "Child age 9", "child",
              { schooldays: [...FULL_WEEK], school: { mode: "unresolved", level: "elementary" } }),
            baseMember("m4", "Child age 15", "child",
              { schooldays: [...FULL_WEEK], school: { mode: "unresolved", level: "high" } }),
          ] } };
        const profile = profileFor([
          { role: "adult", label: "Adult 1", workdays: [...FULL_WEEK] },
          { role: "adult", label: "Adult 2", workdays: [...FULL_WEEK] },
          { role: "child", label: "Child age 9", schooldays: [...FULL_WEEK] },
          { role: "child", label: "Child age 15", schooldays: [...FULL_WEEK] },
        ]);
        return { scenario, profile, messages: userMsg(MSG.family4) };
      },
      expect: { schoolUnresolvedVisible: true, schooldays: { m3: [...FULL_WEEK], m4: [...FULL_WEEK] } },
    },
    {
      id: "remote",
      title: "Remote adult, no commute, no cafe work",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [baseMember("m1", "Member 1", "adult",
            { home_office: true, preferences: "I work remotely with no commute." })] } };
        const profile = profileFor([
          { role: "adult", label: "Member 1", home_office: true,
            preferences: "I work remotely with no commute.",
            errands_per_week: { supermarket: 1, convenience: 0 } },
        ]);
        return { scenario, profile, messages: userMsg(MSG.remote) };
      },
      expect: { noCommute: true, preferencesContain: { m1: ["no commute"] } },
    },
    {
      id: "working_senior",
      title: "Working senior, Mon/Wed/Fri office, no clinic needs",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [baseMember("m1", "Senior 1", "senior",
            { workdays: ["Mon", "Wed", "Fri"], work, preferences: "I still work and keep office days." })] } };
        const profile = profileFor([
          { role: "senior", label: "Senior 1", workdays: ["Mon", "Wed", "Fri"],
            preferences: "I still work and keep office days." },
        ]);
        return { scenario, profile, messages: userMsg(MSG.working_senior) };
      },
      expect: { workdays: { m1: ["Mon", "Wed", "Fri"] },
        preferencesContain: { m1: ["still work"] }, noRetirementInference: true },
    },
    {
      id: "dog_owner",
      title: "Adult with dog, daily morning walks, no vet schedule",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [baseMember("m1", "Member 1", "adult",
            { workdays: [...FULL_WEEK], work, dog_walk_morning: true,
              preferences: "I walk the dog every morning." })] } };
        const profile = profileFor([
          { role: "adult", label: "Member 1", workdays: [...FULL_WEEK],
            dog_walk_morning: true, preferences: "I walk the dog every morning." },
        ]);
        profile.pets = { value: [{ species: "dog", walker: "m1" }], source: "customer" };
        return { scenario, profile, messages: userMsg(MSG.dog_owner) };
      },
      expect: { dogWalkMorning: { m1: true }, preferencesContain: { m1: ["walk the dog"] } },
    },
    {
      id: "combined",
      title: "Hybrid adult plus senior plus child plus dog, pickup asked",
      build() {
        const scenario = { ...clone(head), homes,
          household: { members: [
            baseMember("m1", "Hybrid adult", "adult",
              { workdays: ["Mon", "Wed"], work, home_office: true, dog_walk_morning: true,
                preferences: "I work at the office Mon and Wed, from home other weekdays, and walk the dog every morning." }),
            baseMember("m2", "Working senior", "senior",
              { workdays: ["Mon", "Wed", "Fri"], work, preferences: "I still work and keep office days." }),
            baseMember("m3", "School-age child", "child",
              { schooldays: [...FULL_WEEK], school: { mode: "unresolved", level: "unknown" } }),
            baseMember("m4", "Family dog", "pet", { dog_walk_morning: false }),
          ] } };
        const profile = profileFor([
          { role: "adult", label: "Hybrid adult", workdays: ["Mon", "Wed"], home_office: true,
            dog_walk_morning: true,
            preferences: "I work at the office Mon and Wed, from home other weekdays, and walk the dog every morning." },
          { role: "senior", label: "Working senior", workdays: ["Mon", "Wed", "Fri"],
            preferences: "I still work and keep office days." },
          { role: "child", label: "School-age child", schooldays: [...FULL_WEEK] },
          { role: "pet", label: "Family dog" },
        ]);
        profile.pets = { value: [{ species: "dog", walker: "m1" }], source: "customer" };
        return { scenario, profile, messages: userMsg(MSG.combined) };
      },
      expect: { workdays: { m1: ["Mon", "Wed"], m2: ["Mon", "Wed", "Fri"] },
        dogWalkMorning: { m1: true }, schoolUnresolvedVisible: true, pickupVisible: true },
    },
  ];
}

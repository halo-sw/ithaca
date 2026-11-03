# Household planning and the 30-day comparison

Muse reads each member's stated preferences and schedules, proposes supported routines, and identifies unresolved conditions. The user sees stated inputs, proposals, questions and unsupported constraints before confirming. Changing the homes, household or relevant conversation invalidates the old plan. No simulation starts with an unconfirmed or stale plan.

This is one compositional flow for solo workers, couples, families with children, remote workers, working older adults, pet owners and combinations. These are illustrative test cases, not claims about the builder's family. Age alone does not establish retirement, clinic visits, school assignment or a shared workplace. A nearby school is an explicitly confirmed route proxy, never an enrollment or school-quality claim. Pickup coordination and other unsupported constraints remain visible.

## Why 30 days?

Thirty days is a chosen comparison window: it includes about four weekly cycles and weekends, exposing repeated travel and accumulated burden under the same inputs in both homes. It is not a scientifically validated minimum or a prediction of the household's future. The result compares the first seven days with the whole recorded window; if additional days add little information, the record should show that. Monthly housing cost comes from separate financial assumptions, not from counting repeated trips.

## Division of work

- Muse proposes the plan and selects from bounded daily options with a saved reason.
- Code validates the plan, runs fixed schedules and computes route, time and cost values. Background residents remain rule-based.
- The report cites the saved run. Numeric checks compare values; a separate model call checks the meaning of eligible cited statements.
- A missing, malformed or failed semantic check is **unverified**, never PASS. A user acknowledgment does not turn it into a successful check.
- A recorded Muse run must restore its exact saved scenario and results. It cannot silently regenerate rule-based results or substitute a different household's record.

Sources and assumptions remain distinct. Successful internal checks establish consistency with the supplied records, not real-world accuracy. Field validation is still required.

Code: [plan contract](../web/src/life/plan.js), [planner call](../web/src/consult/life-plan.js), [review flow](../web/src/chat/life-plan-flow.js), [verification](../web/src/verify/compare.js), [record restoration](../web/src/chat/recording.js).


## Hybrid work and recorded decisions (stage 49)

`workdays` lists every working day. Optional `home_office_days` is an explicit subset; an empty array clears the legacy full-remote flag. The same schedule is used by the reviewed plan, daily routing and model decision context. A November 2, 2026 start over 30 days gives 22 working days: a Monday/Wednesday/Friday office schedule has 13 onsite days and 9 remote days. These are calendar counts, not measured travel outcomes.

The report's **How Muse chose** section reads saved options and reasons from the run. It covers household members and choice types, prioritizing choices different from the engine baseline. It does not invent missing travel times or imply every choice differs. The engine computes route, time and cost; Muse chooses among supplied options.

An advertised temporary `rate_limited` response pauses the same run and resumes the same request. Other access limits or failures are not bypassed. There are at most two waits, each at most 600 seconds, and stopping the run cancels the wait.

Validation: 3,716 JavaScript tests passed, 3 skipped; production build passed; Astryx doctor had 0 failures. A live plan response through the staged production connection returned five working days for both adults, no remote days for the first, and Tuesday/Thursday remote days for the second, with no outstanding questions. This validates plan generation; final demo month evidence is recorded separately.


### Intake and revision follow-up (49g–49h)

A public recording preflight exposed three English intake errors: a shared salary unit omitted the first salary, negated remote work could clear commutes, and a hyphenated commute limit was ignored. Muse Code repaired these parsers with Korean/English regressions. The exact demo prompts now parse two adult salaries and retain their working destinations. These preflight records are excluded from final result evidence.

The review card's Adjust action now routes the next valid response directly to a new plan review with the exact user quote and current choices. It never runs the generic property-search tools or the simulation automatically. Regression coverage executes the actual send function, including blocked sends and one-time consumption.

Validation after the follow-up: 3,728 JavaScript tests passed, 3 skipped; production build passed; Astryx doctor 20 pass, 3 existing warnings, 0 failures.

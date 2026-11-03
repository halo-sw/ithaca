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

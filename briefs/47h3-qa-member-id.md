# 47h3 — two verified test fixture errors, no product edits

Muse-only. 8stepsmax. EditONLY web/scripts/life-plan-audit.mjs:10–17,180–193 and web/tests/plan-flow-47g.test.js:196–220. No browser/git/build/fullsuite/subagents.

Actualbrowser desktopcompleted30days134decisionrequests, butassertionfails because trace member_id reads entry.member.id (entryisshellspreadandhasnomember). Capture `body.context.member.id` fromactualrequest instead. Keep strictexactpreferenceassertions; m1,m2 distinctpreferencesDOarriveinthetracealready. Do notchangeproduct. FixdefaultPW_PATH extra `/node/` betweennode_modulesandplaywright, actualinstallation `/Users/halo.axz-pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`.

47l2newtest callsapplyLifePlanwithunconfirmedplan atline206. UseconfirmLifePlan(plan,input) beforeapplyandstoreconfirmedplaninextras. Keepfreshnessassertionsunchanged. Runonly node --test web/tests/plan-flow-47g.test.js 2>&1 | tail -15 plusnode--checkQAscript. Stop.

# 47r — authenticated staged live planner check

Muse only; QA script only `web/scripts/live-plan-matrix.mjs`. Max 18 steps. No product edits, browser, git, build, full tests, or network calls.

The new backend is staged at https://ithaca-relay-69016e305-halos-projects-24428129.vercel.app and has the existing server Meta key. It is protected by Vercel. Normal logged-in CLI works: `vercel curl /api/model/status --deployment URL --scope halos-projects-24428129 -- --silent --show-error` returned ok with meta.hasServerKey=true. No key/token read needed. Public alias is old backend until verified.

Add optional ITHACA_VERCEL_DEPLOYMENT transport to script. When set, use child_process.execFile with argument ARRAY invoking normal `vercel curl /api/consult --deployment <envvalue> --scope halos-projects-24428129 -- --silent --show-error --request POST --header Content-Type:application/json --header x-ithaca-session:<same-existing-session> --data-binary @<temporary-body-path> --write-out <unique-status-marker>%{http_code}`. Inherit normal CLI env/login; do NOT inspect tokens, auth files, process env of other processes or print headers. Serialize body to temp file in outDir (no secrets) and unlink finally. Capture stdout body and HTTP status marker; CLI info stderr is not response. Timeout <=100s and bounded output. Existing standard fetch transport remains default for public alias. Same one ordinary session, no rotation, same gate-stop behavior, same result assertions. Add mode/deployment URL to summary provenance. Do not print session ID.

Only read script first85 and main180–245. Run node --check script. Stop. Orchestrator handles live calls.

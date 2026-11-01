# Stage 38d2 — the production build actually reads the gzipped boxes (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call.

## Found by the orchestrator
A local copy of the Pages site (built exactly like `.github/workflows/pages.yml`, with the gzipped data bundle) requests `data/hm-gangnam-01/area.json` and gets 404. It never asks for `area.json.gz`.
- Cause: `web/src/data-fetch.js:4-5`:
  ```
  const IM = import.meta;
  export const DATA_GZ = Boolean(IM && IM.env && IM.env.PROD);
  ```
- Vite replaces only the literal text `import.meta.env…`. Through the `IM` alias, `IM.env` is undefined in the browser, so `DATA_GZ` is `false` in production.

## Change — `web/src/data-fetch.js:4-5` only
```
export const DATA_GZ = Boolean(import.meta.env && import.meta.env.PROD);
```
(In Node tests `import.meta.env` is undefined, so it stays `false`.)

## Test — extend `web/tests/data-gz-38d.test.js`
- Read `web/src/data-fetch.js` as text. Assert it contains `import.meta.env.PROD`, and does not match `/=\s*import\.meta\s*;/` (no alias that defeats Vite's static replacement).
- Also scan every file under `web/src` (recursive `.js`/`.jsx`) for `/=\s*import\.meta\s*;/` and assert none.

Run only:
```
cd web && node --test tests/data-gz-38d.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each.

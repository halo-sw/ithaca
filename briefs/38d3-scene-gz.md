# Stage 38d3 — scene.json goes through the gzip helper too (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call.

## Found by the orchestrator
On a local copy of the Pages site, the older station boxes now ship only `scene.json.gz`. But `fetchScene` (`web/src/main.js:782-787`) uses a plain `fetch`, so it gets 404 and the scene falls back to flat:
```
async function fetchScene(wantId) {
  return loadScene(wantId, async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  });
}
```
`fetchDataJson` is already imported at `main.js:16`.

## Change — `web/src/main.js:782-787` only
```
async function fetchScene(wantId) {
  return loadScene(wantId, fetchDataJson);
}
```

## Test — extend `web/tests/data-gz-38d.test.js`
Read `web/src/main.js` as text and assert that the `fetchScene` function body (from `async function fetchScene` to the next `\n}\n`) contains `fetchDataJson` and no `fetch(url)`.

Run only:
```
cd web && node --test tests/data-gz-38d.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each.

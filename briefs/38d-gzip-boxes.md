# Stage 38d — 3D box files ship gzipped so 186 neighbourhoods fit on GitHub Pages (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator
- **Box count is going from 60 to 186** (122 station boxes `st-*`, 64 home boxes `hm-*`).
- **Each box ships about 9.5 MB of pretty-printed JSON:**

  | File | Raw | Gzip |
  |---|---:|---:|
  | `area.buildings.json` | 4.98 MB | 0.41 MB |
  | `area.json` | 3.06 MB | 0.23 MB |
  | `graph.json` (a `$ref`) | 1.83 MB | ~0.2 MB |
  | `scene.json` | 1.01 MB | 0.19 MB |

- **That does not fit.** 186 boxes is about 1.8 GB on the Pages site, and the Pages limit is 1 GB. Gzipped it is about 200 MB.
- **Pages serves a `.gz` file as raw bytes** (no `Content-Encoding`), so the app must decompress it itself. `DecompressionStream("gzip")` exists in every target browser and in Node ≥ 18 (the relay).

## Change
1. **New `web/src/data-fetch.js`** (pure, no DOM):
   - `isBoxDataUrl(url)`: true for `/data/(st-|hm-)<id>/<file>.json`. Handle URL-encoded Korean ids too (`/data/st-%EA%B0%95%EB%82%A8/area.json`).
   - `export const DATA_GZ`: true when `import.meta.env && import.meta.env.PROD`, else false. Guard so Node/tests do not crash; tests can pass an option.
   - `fetchDataJson(url, { fetchImpl = fetch, gz = DATA_GZ } = {})`:
     - When `gz && isBoxDataUrl(url)`, fetch `url + ".gz"`. If ok, decompress with `DecompressionStream("gzip")` and `JSON.parse`. If 404, fall back to the plain url.
     - Otherwise fetch the plain url.
     - A non-ok final answer throws `` `${url}: ${status}` `` (same text as today's helpers).
   - `fetchDataText(url, opts)`: same, returning text. The relay uses it.
2. **Route every box-file fetch through it.** Known sites:
   - `web/src/sim-worker.js:15-27`;
   - `web/src/main.js:2624-2628` (`fetchJson`), plus wherever `main.js` fetches the box `scene.json` / `area.json` (`grep -n "scene.json\|area.json" web/src/main.js` once);
   - `web/src/ui/chat.jsx:1976-1980`;
   - `web/src/ui/preview.jsx:100-108`;
   - `web/src/load.js:9-20`: callers inject `fetchJson`. Make the default the new helper when none is passed. Callers that pass `r.json()` wrappers switch to `fetchDataJson`.
   - `web/src/chat/engine.js:244-255` (`loadBoxArea`, injected; follow its caller).
   - **Relay:** `web/src/consult/server.js:165-175` `httpReadText`. For `kind === "data"` and a `rel` matching `(st-|hm-)…/….json`, try `${url}.gz` first and decompress to text; on 404, fetch the plain url.
     - The relay always tries gz (it only ever reads the public site).
     - Keep the `not found: <rel>` error text.
   - Non-box files (`homes/*.json`, `region/*.json`, `walkgraph/*.json`, `sim/*`) stay plain everywhere.
3. **Packaging script `web/scripts/gzip-boxes.mjs <dir>`** (the orchestrator runs it on the unpacked bundle before making the tgz):
   - For every file under `<dir>/st-*/` and `<dir>/hm-*/` ending in `.json`, write `<file>.gz` (gzip level 9, `node:zlib`) and delete the `.json`.
   - Print `{ files, bytes_before, bytes_after }` as JSON. Idempotent: an existing `.gz` with no `.json` is left alone.
4. **`web/scripts/runtime-data-list.mjs:88-95` `walkFs`** follows symlinks to directories (use `stat`, not only `Dirent.isDirectory()`). The local `data/build` is a mix of real dirs and symlinks, and today it lists only 16 files.

## Tests — new `web/tests/data-gz-38d.test.js`
- **`isBoxDataUrl`:**
  - true: `/ithaca/data/st-판교/area.json`, `/data/hm-gangdong-01/scene.json`, `/data/st-%EA%B0%95%EB%82%A8/area.buildings.json`;
  - false: `/data/homes/gangnam.json`, `/data/region/network.json`, `/data/st-판교/extract.osm.pbf`.
- **`fetchDataJson` with a fake fetch:**
  - (a) gz on, `.gz` present (serve `zlib.gzipSync(JSON.stringify({a:1}))` as a `Response`) → `{a:1}`, and the plain url is never requested;
  - (b) gz on, `.gz` 404 → falls back to plain;
  - (c) gz off → plain only;
  - (d) a non-box url with gz on → plain only, no `.gz` request.
- **`httpReadText`:** a fake fetch serving only `data/st-판교/area.json.gz` returns the decompressed text for `("data", "st-판교/area.json")`. `("data", "homes/gangnam.json")` asks for the plain url.
- **`gzip-boxes.mjs`:** run on a temp dir with `st-x/area.json`, `hm-y/scene.json` and `homes/a.json`. Afterwards `st-x/area.json.gz` and `hm-y/scene.json.gz` exist, their `.json` files are gone, `homes/a.json` is untouched, and the gunzipped content equals the original.
- **`runtimeDataList` via `walkFs`:** a temp dir where `st-x` is a symlink to a real dir lists `st-x/area.json`.
- **Source checks:** `sim-worker.js`, `ui/chat.jsx`, `ui/preview.jsx` and `main.js` import `fetchDataJson` (or `fetchDataText`).
- **Keep green:** web tests matching `loadArea|loadBoxArea|httpReadText|runtimeDataList|sim-worker|preview`.

Run only:
```
cd web && node --test tests/data-gz-38d.test.js $(grep -lE "loadArea|loadBoxArea|httpReadText|runtimeDataList|sim-worker|preview\.jsx" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/i18n/**`, `web/src/profile.js`, `web/src/chatmap.js`, `web/src/consult/tools*.js`, `README*`, `scenarios/`, `web/public/recorded/**`, `relay/dist/**`.

## Final message
Changed files, one line each. Nothing else.

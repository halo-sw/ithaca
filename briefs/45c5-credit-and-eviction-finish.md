# 45c5 — Finish two concrete review findings

Muse product authoring per AGENTS.md. First tool edits. No read/search tools, git, subagents, network or full suite/build. Exact current snippets below, no exploration needed.

1. main.js ensureSecondArea eviction has `if (state.aerialSecondByArea) delete state.aerialSecondByArea[oldest];`. There is NO state variable in this scope, and direct mutation bypasses subscriptions. Read current map through store.getState(), clone it, delete only oldest from the clone, publish with store.set. Keep forgetAreaDrape.
2. main.js sim's store.set still publishes `area: { id: run.meta.area, label: run.meta.area }` (tour metadata was fixed but sim missed). Loaded `area` is in scope; carry its country/bbox here too.
3. app.jsx areaForCredit currently returns any nonempty id directly, but aerialCreditFor/isUsArea does not understand an id. Thus `{id:'us-menlo'}` incorrectly gets VWorld and blocks money fallback. Prefer actual country/bbox when supplied; recognize supported `us-` ids as US when country/bbox absent; for unidentified metadata retain money.currency USD fallback. KR metadata wins over a stale USD moneyDoc. No layout change.
4. Append SSR checks to region-metadata test: id-only us-menlo→USGS; legacy unknown id with money USD→USGS; actual countryKR with moneyUSD→VWorld. Existing country/bbox/no-photo tests remain.

Run only region-metadata-45c, aerial-reliability-45c, ui-store, us-26e, one-map-36c. Stop after pass; no commit. Do not weaken tests or write source-string tests.

## main.js exact block
```js
    if (secondAreas.size >= 2) {
      const oldest = secondAreas.keys().next().value;
      const slot = secondAreas.get(oldest);
      // 45c1: eviction also drops the area's night entries so the night
      // table stays bounded to the live groups' material sets.
      if (slot) {
        scene.remove(slot.group);
        for (const e of slot.nightEntries || []) {
          const i = nightMats.indexOf(e);
          if (i >= 0) nightMats.splice(i, 1);
        }
      }
      secondAreas.delete(oldest);
      forgetAreaDrape(oldest);
      if (state.aerialSecondByArea) delete state.aerialSecondByArea[oldest];
    }
    const label = (AREAS.find((a) => a.id === areaId) || {}).label || areaId;
    store.set({ journeyLoading: `${label} 지도 불러오는 중…` });
    try {
      const data = await fetchArea(areaId);
      let scene14b = null;
      try {
        scene14b = await fetchScene(areaId);
      } catch {
```

## main.js exact block
```js
    home: homeLabel,
    homes,
    scenarioName,
    area: { id: run.meta.area, label: run.meta.area },
    legend: {
      title: `범례 — ${homeLabel} · ${run.meta.complex}`,
```

## app.jsx
```js
import { aerialCreditFor, USGS_CREDIT } from "../aerial/drape.js";
import { currentLang } from "../i18n/lang.js";

// 26e: the screens below carry no area bbox; a USD moneyDoc marks a US
// run, so the aerial credit maps it to a country-only area (Korean
// runs keep AERIAL_CREDIT).
// 45c3: prefer the loaded area's own country/bbox/id (tour has no
// moneyDoc); money USD stays only as a backward-compatible fallback.
function areaForCredit(state) {
  const a = state && state.area;
  if (a && typeof a === "object"
    && (a.country || a.bbox || (typeof a.id === "string" && a.id))) return a;
  return state.money && state.money.currency === "USD" ? { country: "US" } : null;
}
import { priorityValues, myScore } from "../priorities.js";

function useStore() {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
```

## Test file
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
register("./jsx-loader.mjs", import.meta.url);
import { createStore } from "../src/ui/store.js";
import { sceneInstant } from "../src/scene/time.js";
import { USGS_CREDIT } from "../src/aerial/drape.js";

test("45c3 strict store accepts aerialSecondByArea", () => {
  const s = createStore();
  s.set({ aerialSecondByArea: { "us-menlo": true } });
  assert.deepEqual(s.getState().aerialSecondByArea, { "us-menlo": true });
});

test("45c3 Feb31/Apr31 rejected, leap day valid", () => {
  assert.throws(() => sceneInstant("2026-02-31", 0, 720, null), RangeError);
  assert.throws(() => sceneInstant("2026-04-31", 0, 720, null), RangeError);
  const leap = sceneInstant("2024-02-29", 0, 720, null);
  assert.ok(leap instanceof Date && !Number.isNaN(leap.getTime()));
});

test("45c3 SimCredit SSR: US area/bbox without moneyDoc credits USGS; KR credits VWorld; no photo no imagery", async () => {
  const React = (await import("react")).default;
  const { renderToString } = await import("react-dom/server");
  const { SimCredit } = await import("../src/ui/app.jsx");
  const htmlCountry = renderToString(React.createElement(SimCredit, { state: { aerial: true, area: { id: "us-menlo", country: "US" } } }));
  assert.ok(htmlCountry.includes(USGS_CREDIT), `country US should credit USGS: ${htmlCountry}`);
  const htmlBbox = renderToString(React.createElement(SimCredit, { state: { aerial: true, area: { id: "bay", bbox: [-122.5, 37.3, -121.9, 37.8] } } }));
  assert.ok(htmlBbox.includes(USGS_CREDIT), `US bbox should credit USGS: ${htmlBbox}`);
  const htmlKr = renderToString(React.createElement(SimCredit, { state: { aerial: true, area: { id: "seongnam" } } }));
  assert.ok(htmlKr.includes("VWorld"), `KR should credit VWorld: ${htmlKr}`);
  assert.ok(!htmlKr.includes(USGS_CREDIT));
  const htmlNoPhoto = renderToString(React.createElement(SimCredit, { state: { aerial: false, area: { id: "us-menlo", country: "US" } } }));
  assert.ok(!htmlNoPhoto.includes("USGS") && !htmlNoPhoto.includes("VWorld"), `no photo means no imagery claim: ${htmlNoPhoto}`);
});

```

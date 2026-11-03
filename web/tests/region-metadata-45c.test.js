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

test("45c5 SimCredit SSR: id-only us-menlo, legacy USD fallback, KR wins over USD", async () => {
  const React = (await import("react")).default;
  const { renderToString } = await import("react-dom/server");
  const { SimCredit } = await import("../src/ui/app.jsx");
  const htmlIdOnly = renderToString(React.createElement(SimCredit, { state: { aerial: true, area: { id: "us-menlo" } } }));
  assert.ok(htmlIdOnly.includes(USGS_CREDIT), `id-only us-menlo should credit USGS: ${htmlIdOnly}`);
  const htmlLegacy = renderToString(React.createElement(SimCredit, { state: { aerial: true, area: { id: "legacy-unknown" }, money: { currency: "USD" } } }));
  assert.ok(htmlLegacy.includes(USGS_CREDIT), `legacy unknown id with money USD should credit USGS: ${htmlLegacy}`);
  const htmlKrWins = renderToString(React.createElement(SimCredit, { state: { aerial: true, area: { id: "seongnam", country: "KR" }, money: { currency: "USD" } } }));
  assert.ok(htmlKrWins.includes("VWorld"), `KR country with money USD should credit VWorld: ${htmlKrWins}`);
  assert.ok(!htmlKrWins.includes(USGS_CREDIT));
});

// Stage 34a — compare side panel fit, English pin money, picks tray names.
// node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./jsx-loader.mjs", import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const chatSrc = readFileSync(join(HERE, "..", "src", "ui", "chat.jsx"), "utf8");
const css = readFileSync(join(HERE, "..", "src", "ui", "ui.css"), "utf8");

let React;
let renderToString;
let PicksTray;
let SidePanel;
let trayNameFor;
let tagPriceLine;
let store;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ PicksTray, SidePanel, trayNameFor } = await import("../src/ui/chat.jsx"));
  ({ tagPriceLine } = await import("../src/chatmap.js"));
  ({ store } = await import("../src/ui/store.js"));
});

const noop = () => {};

function trayCand(id, name) {
  return { id, name, lon: 127.1, lat: 37.4,
    commute: { work: { minutes: 20 } },
    tenures: [{ tenure: "jeonse", median_won: 200000000, deals: 5 }] };
}

describe("34a compare lives in the side panel, not over it", () => {
  it("SidePanel renders CompareCard in its in-flow (bare) form", () => {
    const at = chatSrc.indexOf("export function SidePanel");
    assert.ok(at >= 0, "SidePanel present");
    const body = chatSrc.slice(at, at + 1500);
    assert.ok(body.includes("<CompareCard state={state} bare"), "bare CompareCard");
    assert.ok(!body.includes("ui-compare overlay"), "no overlay class in the panel");
  });

  it("panel output has one title, one Close, the share action, no overlay", () => {
    store.set({ compareOpen: true });
    let html = "";
    try {
      html = renderToString(React.createElement(SidePanel,
        { picks: [], candidatesData: null, detail: null,
          onCloseDetail: noop, photoDeps: {}, destName: "강남",
          tenure: "jeonse", onTogglePick: noop, onJeonse: noop }));
    } finally {
      store.set({ compareOpen: false });
    }
    assert.ok(html.includes("30일 생활 비교"), "panel owns the title");
    assert.equal(html.split("닫기").length - 1, 1, "exactly one Close");
    assert.ok(html.includes("결과 공유"), "share action kept");
    assert.ok(!html.includes("ui-compare overlay"), "no absolute overlay card");
    assert.ok(html.includes("ui-compare-bare"), "in-flow compare block");
  });
});

describe("34a compare rows stack instead of squeezing", () => {
  it("the A/B row wraps and no compare rule breaks words letter by letter", () => {
    const row = css.match(/\.ui-cmp-ab\s*\{[^}]*\}/);
    assert.ok(row, ".ui-cmp-ab rule present");
    assert.ok(row[0].includes("flex-wrap"), "A/B values wrap onto lines");
    const cell = css.match(/\.ui-cmp-ab\s*>\s*\*\s*\{[^}]*\}/);
    assert.ok(cell && cell[0].includes("word-break: keep-all"), "whole-word wrapping");
    for (const sel of ["\\.ui-cmp-ab", "\\.ui-cmp-ab\\s*>\\s*\\*",
      "\\.ui-compare-bare", "\\.ui-side-panel"]) {
      const rule = css.match(new RegExp(`${sel}\\s*\\{[^}]*\\}`));
      assert.ok(rule && !rule[0].includes("break-all"), `no break-all in ${sel}`);
    }
  });
});

describe("34a English pins speak the card money style", () => {
  it("jeonse ₩260,000,000", () => {
    const c = { tenures: [{ tenure: "jeonse", median_won: 260000000, deals: 5 }] };
    assert.equal(tagPriceLine(c, "jeonse", "en"), "₩260M");
    assert.equal(tagPriceLine(c, "jeonse"), "전 2억 6,000");
  });

  it("monthly 600,000 over 10,000,000 deposit", () => {
    const c = { tenures: [{ tenure: "wolse", median_won: 600000,
      deposit_median_won: 10000000, deals: 3 }] };
    assert.equal(tagPriceLine(c, "wolse", "en"), "₩600K / ₩10M");
    assert.equal(tagPriceLine(c, "wolse"), "월 60 / 1,000");
  });

  it("USD pins stay in dollars", () => {
    const c = { currency: "USD",
      tenures: [{ tenure: "monthly", median_won: 4261, currency: "USD" }] };
    assert.equal(tagPriceLine(c, "monthly", "en"), "$4,261");
    assert.equal(tagPriceLine(c, "monthly"), "$4,261");
  });
});

describe("34a tray names show once, in the tray language", () => {
  it("trayNameFor splits the Korean (English) form", () => {
    const c = { name: "목화밀라트 (Mokhwamillateu)" };
    assert.equal(trayNameFor(c, "en"), "Mokhwamillateu");
    assert.equal(trayNameFor(c, "ko"), "목화밀라트");
    assert.equal(trayNameFor({ name: "10 Coleman Place" }, "en"), "10 Coleman Place");
  });

  it("English tray shows the English name only; Korean tray the Korean name", () => {
    const cands = [trayCand("b", "목화밀라트 (Mokhwamillateu)")];
    const en = renderToString(React.createElement(PicksTray,
      { picks: ["b"], candidates: cands, gate: { ok: true },
        lang: "en", onRun: noop, onRemove: noop }));
    assert.ok(en.includes("Mokhwamillateu"), "English name shown");
    assert.ok(!en.includes("목화밀라트"), "Korean name not repeated");
    const ko = renderToString(React.createElement(PicksTray,
      { picks: ["b"], candidates: cands, gate: { ok: true },
        onRun: noop, onRemove: noop }));
    assert.ok(ko.includes("목화밀라트"), "Korean name shown");
    assert.ok(!ko.includes("Mokhwamillateu"), "English gloss not added");
  });
});

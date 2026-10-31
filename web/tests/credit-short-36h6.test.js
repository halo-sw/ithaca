// 36h6: the English credit keeps the short form on phones (≤ 480 px,
// CSS picks ui-simcredit-short) — same two spans as Korean.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

describe("36h6 SimCredit short form in English", () => {
  let React;
  let renderToString;
  let SimCredit;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ SimCredit } = await import("../src/ui/app.jsx"));
  });

  const render = (state) => renderToString(React.createElement(SimCredit, { state }));

  function withLang(lang, fn) {
    const prev = globalThis.window;
    const kept = {};
    globalThis.window = {
      location: { search: lang === "en" ? "?lang=en" : "?lang=ko" },
      localStorage: {
        getItem: () => kept["ithaca.lang"] ?? null,
        setItem: (k, v) => { kept[k] = v; },
      },
      navigator: { language: "ko-KR" },
    };
    try {
      return fn();
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  }

  it("English with the photo on has full + short spans", () => {
    const html = withLang("en", () => render({ aerial: true }));
    assert.ok(html.includes("ui-simcredit-full"), `full span: ${html}`);
    assert.ok(html.includes("ui-simcredit-short"), `short span: ${html}`);
  });

  it("English short span reads © VWorld · © OpenStreetMap", () => {
    const html = withLang("en", () => render({ aerial: true }));
    const m = html.match(/ui-simcredit-short[^>]*>([^<]*)</);
    assert.ok(m, `short span found: ${html}`);
    assert.equal(m[1], "© VWorld · © OpenStreetMap");
  });
});

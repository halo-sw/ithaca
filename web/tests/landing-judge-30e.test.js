// 30e: the hero judge buttons render as buttons (ds-lp-judge, not ds-lp-cta).
// 31l: three judge links — recorded month, Meta HQ, Seoul — as on main.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");

describe("30e landing hero judge buttons (SSR, no DOM)", () => {
  let React;
  let renderToStaticMarkup;
  let LandingPage;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToStaticMarkup } = await import("react-dom/server"));
    ({ LandingPage } = await import("../src/ui/landing-page.jsx"));
  });

  it("the three hero links sit inside ds-lp-trygrid, not ds-lp-cta", () => {
    const html = renderToStaticMarkup(React.createElement(LandingPage));
    const panel = html.match(/<section class="ds-lp-try"([\s\S]*?)<\/section>/);
    assert.ok(panel, "hero ds-lp-try panel missing");
    assert.ok(panel[1].includes("ds-lp-trygrid"), "hero ds-lp-trygrid wrapper missing");
    const links = panel[1].match(/<a /g) || [];
    assert.equal(links.length, 3);
    const first = panel[1].indexOf("기록된 한 달 보기");
    const second = panel[1].indexOf("Meta 본사 출근으로 해 보기");
    const third = panel[1].indexOf("서울로 해 보기");
    assert.ok(first !== -1 && second !== -1 && third !== -1, "all three entries present");
    assert.ok(first < second && second < third, "order");
    assert.ok(panel[1].includes("ds-lp-btn--primary"));
    assert.ok(panel[1].includes("ds-lp-btn--secondary"));
  });

  it("ds-lp-cta appears exactly once, on the bottom section", () => {
    const html = renderToStaticMarkup(React.createElement(LandingPage));
    const uses = html.match(/ds-lp-cta(?![\w-])/g) || [];
    assert.equal(uses.length, 1);
    assert.ok(html.includes('<section class="ds-lp-cta"'));
  });

  it("the judge captions replace the replay note", () => {
    const html = renderToStaticMarkup(React.createElement(LandingPage));
    assert.ok(!html.includes("ds-lp-replaynote"));
    assert.ok(html.includes("ds-lp-judgecap"));
    assert.ok(html.includes("키 없이"));
    assert.ok(html.includes("녹화된 30일을 재생해요"));
    assert.ok(html.includes("무료 체험 1회 · 이후 내 키"));
    assert.equal((html.match(/Muse 실시간/g) || []).length, 1);
  });

  it("ui.css has the judge button rules and no ellipsis", () => {
    const css = read("../src/ui/ui.css");
    assert.match(css, /\.ds-lp-btn--primary\s*\{[^}]*background:/);
    assert.match(css, /\.ds-lp-btn\s*\{[^}]*height:/);
    assert.match(css, /\.ds-lp-judge\s*\{[^}]*display:\s*grid/);
    assert.match(css, /\.ds-lp-judge\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/);
    assert.ok(!css.includes("ellipsis"), "ui.css must not contain ellipsis");
  });
});

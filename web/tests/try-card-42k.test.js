// Stage 42k: the 바로 해 보기 card — clear hierarchy, no romanized labels (SSR).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (p) => fs.readFileSync(path.join(here, p), "utf8");
const heroSrc = readSrc("../src/ui/entry-hero.jsx");
const css = readSrc("../src/ui/ui.css");

let React;
let renderToStaticMarkup;
let EntryHero;
before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ EntryHero } = await import("../src/ui/entry-hero.jsx"));
});

function html() {
  return renderToStaticMarkup(React.createElement(EntryHero, {
    value: "",
    onValueChange: () => {},
    onSubmitText: () => {},
    onAction: () => {},
    placeholder: "예시",
  }));
}

describe("42k try card hierarchy (SSR)", () => {
  it("Muse 실시간 appears exactly once, with eyebrow 키 없이", () => {
    const h = html();
    assert.equal(h.match(/Muse 실시간/g).length, 1);
    assert.ok(h.includes("키 없이"));
    assert.ok(!h.includes("Muse Silsigan"), "no romanized label");
  });

  it("replay caption and single free-trial caption", () => {
    const h = html();
    assert.ok(h.includes("녹화된 30일을 재생해요"));
    assert.equal((h.match(/무료 체험 하루 3회 · 이후 내 키/g) || []).length, 1);
  });

  it("no separate byok row above the proof strip", () => {
    const h = html();
    assert.ok(!h.includes("ds-lp-byok\""), "old byok row gone");
    assert.ok(h.includes("ds-lp-trygrid"), "two-group grid");
  });
});

describe("42k key toggle (SSR + source)", () => {
  it("label element text is exactly 내 모델 키로 하기", () => {
    const h = html();
    assert.ok(h.includes("<span>내 모델 키로 하기</span>"));
  });

  it("arrow lives in a separate aria-hidden element", () => {
    const h = html();
    assert.ok(/<span aria-hidden="true"> ?▸<\/span>/.test(h), "collapsed arrow aria-hidden");
    assert.ok(!heroSrc.includes("${LANDING_KEY_ROW_LABEL} ▸"), "no arrow in label text node");
    assert.ok(heroSrc.includes('<span aria-hidden="true">'), "arrow span in source");
  });

  it("collapsed by default; the form behind the toggle has providers, input and 키 저장", () => {
    const h = html();
    assert.ok(h.includes('aria-expanded="false"'), "collapsed by default");
    assert.ok(!h.includes('type="password"'), "key field hidden until opened");
    assert.ok(heroSrc.includes("setKeyOpen((v) => !v)"), "toggle flips keyOpen");
    assert.ok(heroSrc.includes("keyOpen &&"), "form opens on toggle");
    assert.ok(heroSrc.includes("NO_ANSWER_PROVIDERS"), "provider chips");
    assert.ok(heroSrc.includes('type="password"'), "key input in form");
    assert.ok(heroSrc.includes("키 저장"), "save button in form");
  });
});

describe("42k try grid CSS", () => {
  it("two columns on wide (1fr : 2fr), one column under 900px", () => {
    const at = css.indexOf(".ds-lp-trygrid");
    assert.ok(at !== -1, "try grid rule exists");
    const wide = css.slice(at, at + 200);
    assert.ok(wide.includes("1fr 2fr"), "1fr : 2fr on wide");
    const mediaAt = css.indexOf("@media (max-width: 900px)", at);
    assert.ok(mediaAt !== -1, "900px rule exists");
    const narrow = css.slice(mediaAt, mediaAt + 600);
    assert.ok(narrow.includes(".ds-lp-trygrid"), "grid covered at narrow width");
    assert.ok(narrow.includes("grid-template-columns: 1fr"), "one column under 900px");
  });

  it("Muse buttons share the row and stack full width when narrow", () => {
    assert.ok(css.includes(".ds-lp-trybtns--duo"), "duo rule exists");
    const at = css.indexOf(".ds-lp-trybtns--duo");
    assert.ok(css.slice(at, at + 200).includes("1fr 1fr"), "equal-width duo");
    const mediaAt = css.indexOf("@media (max-width: 900px)", at);
    assert.ok(mediaAt !== -1, "900px rule exists");
    assert.ok(css.slice(mediaAt, mediaAt + 600).includes(".ds-lp-trybtns--duo"), "duo stacks narrow");
  });

  it("no text-overflow, no 13px", () => {
    assert.ok(!css.includes("text-overflow"), "no text-overflow in css");
    assert.ok(!css.includes("13px"), "no 13px in css");
    assert.ok(!heroSrc.includes("13px"), "no 13px in entry hero");
    assert.ok(!heroSrc.includes("text-overflow"), "no text-overflow in entry hero");
  });
});

describe("42k2 try card on phones + key field CSS", () => {
  it("under 900px the Muse group flows: no fixed row heights, no absolute positions", () => {
    const at = css.indexOf(".ds-lp-trygroup");
    assert.ok(at !== -1, "try group rule exists");
    const mediaAt = css.indexOf("@media (max-width: 900px)", at);
    assert.ok(mediaAt !== -1, "900px rule exists");
    const narrow = css.slice(mediaAt, mediaAt + 1500);
    const groupAt = narrow.indexOf(".ds-lp-trygroup");
    assert.ok(groupAt !== -1, "try group covered at narrow width");
    const groupRule = narrow.slice(groupAt, groupAt + 300);
    assert.ok(!groupRule.includes("44px"), "no fixed row height on the group when narrow");
    assert.ok(!groupRule.includes("absolute"), "no absolute position on the group when narrow");
    assert.ok(groupRule.includes("var(--ds-s-8)"), "8px token gap when narrow");
  });

  it("key input has a field look: border and height", () => {
    const at = css.indexOf(".ds-lp-byok-input");
    assert.ok(at !== -1, "key input rule exists");
    const rule = css.slice(at, at + 500);
    assert.ok(rule.includes("border"), "input has a border");
    assert.ok(rule.includes("44px"), "input is 44px tall");
  });

  it("key row: input grows beside a normal-width save button on wide, stacked under 900px", () => {
    assert.ok(heroSrc.includes("ds-lp-byok-row"), "input and save button share a row");
    const mediaAt = css.indexOf("@media (max-width: 900px)", css.indexOf(".ds-lp-byok-row"));
    assert.ok(mediaAt !== -1, "900px rule exists");
    const narrow = css.slice(mediaAt, mediaAt + 1500);
    assert.ok(narrow.includes(".ds-lp-byok-row"), "key row covered at narrow width");
  });
});

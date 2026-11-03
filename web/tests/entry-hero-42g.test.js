// Stage 42g: one entry screen — the landing hero is the standard and the
// chat empty state renders the same EntryHero over its 3D backdrop + scrim
// (SSR, no DOM, no data/build needed).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./jsx-loader.mjs", import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, "..", "src", "ui", "ui.css"), "utf8");

const TITLE = "어떤 집을 고민 중이세요?";
const LEDE = "Muse가 직접 확인하고, 대신 30일 살아 보고, 대화로 알려 줘요.";
const CHIPS = ["출근지로 집 찾기", "본 매물 붙여 넣기", "예시로 써 보기"];
const TRY_BUTTONS = ["기록된 한 달 보기", "Meta 본사 출근으로 해 보기", "서울로 해 보기"];
const CAPTIONS = ["녹화된 30일을 재생해요", "무료 체험 하루 3회 · 이후 내 키"];

let React;
let renderToString;
let LandingPage;
let ChatEmpty;
let landing;
let entryHero;
let noAnswer;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ LandingPage } = await import("../src/ui/landing-page.jsx"));
  ({ ChatEmpty } = await import("../src/ui/chat.jsx"));
  landing = await import("../src/ui/landing.jsx");
  entryHero = await import("../src/ui/entry-hero.jsx");
  noAnswer = await import("../src/ui/no-answer-alert.js");
});

function landingHtml() {
  return renderToString(React.createElement(LandingPage));
}

function emptyHtml() {
  return renderToString(React.createElement(ChatEmpty,
    { onSend: () => {}, onListing: () => {}, onExample: () => {} }));
}

function entryHtml(props = {}) {
  return renderToString(React.createElement(entryHero.EntryHero, {
    value: "",
    onValueChange: () => {},
    onSubmitText: () => {},
    onAction: () => {},
    placeholder: "예시",
    ...props,
  }));
}

describe("42g one entry screen (SSR, no DOM)", () => {
  it("landing shows the hero: title, lede, chips, try card, key row, coverage", () => {
    const html = landingHtml();
    assert.ok(html.includes(TITLE), "title");
    assert.ok(html.includes(LEDE), "lede");
    for (const c of CHIPS) assert.ok(html.includes(c), `chip ${c}`);
    assert.ok(html.includes("바로 해 보기"), "try label");
    for (const b of TRY_BUTTONS) assert.ok(html.includes(b), `try button ${b}`);
    assert.ok(html.includes(CAPTIONS[0]), "replay caption");
    const free = html.match(/무료 체험 하루 3회 · 이후 내 키/g) || [];
    assert.equal(free.length, 1, "one free-trial caption");
    assert.ok(html.includes(noAnswer.LANDING_KEY_ROW_LABEL), "key row");
    assert.ok(html.includes(landing.COVERAGE_LINE), "coverage line");
  });

  it("chat empty state shows the same hero content", () => {
    const html = emptyHtml();
    assert.ok(html.includes(TITLE), "title");
    assert.ok(html.includes(LEDE), "lede");
    for (const c of CHIPS) assert.ok(html.includes(c), `chip ${c}`);
    assert.ok(html.includes("바로 해 보기"), "try label");
    for (const b of TRY_BUTTONS) assert.ok(html.includes(b), `try button ${b}`);
    assert.ok(html.includes(CAPTIONS[0]), "replay caption");
    const free = html.match(/무료 체험 하루 3회 · 이후 내 키/g) || [];
    assert.equal(free.length, 1, "one free-trial caption");
    assert.ok(html.includes(noAnswer.LANDING_KEY_ROW_LABEL), "key row");
    assert.ok(html.includes(landing.COVERAGE_LINE), "coverage line");
  });

  it("chat empty state drops the old heading and example cards", () => {
    const html = emptyHtml();
    assert.ok(!html.includes(landing.LANDING_HEADING), "no old heading");
    assert.ok(!html.includes("ui-landing-card"), "no example cards");
    assert.ok(!html.includes("예시로 시작하기"), "no example card buttons");
  });

  it("chat empty state keeps the backdrop, scrim and composer", () => {
    const html = emptyHtml();
    assert.ok(html.includes("ui-chat-empty-scrim"), "scrim kept");
    assert.ok(html.includes("판교 출근, 모은 돈 1억, 4억 이하 매매로 혼자 살 집 찾아 줘"), "composer kept");
  });

  it("landing try buttons still navigate as anchors", () => {
    const html = landingHtml();
    const panel = html.match(/<section class="ds-lp-try"([\s\S]*?)<\/section>/);
    assert.ok(panel, "hero ds-lp-try panel");
    const links = panel[1].match(/<a /g) || [];
    assert.equal(links.length, 3, "three navigating buttons");
  });

  it("chat try buttons act in place, not as links", () => {
    const html = emptyHtml();
    const panel = html.match(/<section class="ds-lp-try"([\s\S]*?)<\/section>/);
    assert.ok(panel, "hero ds-lp-try panel");
    assert.ok(!panel[1].includes("<a "), "no navigating anchors in chat");
    const buttons = panel[1].match(/<button /g) || [];
    assert.ok(buttons.length >= 3, "in-place buttons");
  });
});

describe("42g in-chat entry actions (no DOM)", () => {
  const deps = (over = {}) => ({
    setValue: () => {},
    findText: "FIND",
    onSend: () => {},
    onListing: () => {},
    onExample: () => {},
    openReplay: () => {},
    metaText: "META",
    ...over,
  });

  it("find fills the composer text", () => {
    let got = null;
    entryHero.runEntryAction("find", deps({ setValue: (v) => { got = v; } }));
    assert.equal(got, "FIND");
  });

  it("listing opens the paste check", () => {
    let n = 0;
    entryHero.runEntryAction("listing", deps({ onListing: () => { n += 1; } }));
    assert.equal(n, 1);
  });

  it("example fills the example", () => {
    let n = 0;
    entryHero.runEntryAction("example", deps({ onExample: () => { n += 1; } }));
    assert.equal(n, 1);
  });

  it("replay opens the replay", () => {
    let n = 0;
    entryHero.runEntryAction("replay", deps({ openReplay: () => { n += 1; } }));
    assert.equal(n, 1);
  });

  it("meta sends the Meta HQ prompt", () => {
    let got = null;
    entryHero.runEntryAction("meta", deps({ onSend: (t) => { got = t; } }));
    assert.equal(got, "META");
  });

  it("seoul sends the Seoul example", () => {
    let n = 0;
    entryHero.runEntryAction("seoul", deps({ onExample: () => { n += 1; } }));
    assert.equal(n, 1);
  });

  it("entry ids cover the old starter set", () => {
    assert.deepEqual([...entryHero.ENTRY_ACTION_IDS].sort(),
      ["example", "find", "listing", "meta", "replay", "seoul"].sort());
  });
});

describe("42g hero panel CSS", () => {
  it("backs the hero as its own light panel over the backdrop", () => {
    const at = css.indexOf(".ui-chat-empty .ds-lp-hero");
    assert.ok(at !== -1, "hero panel rule exists");
    const block = css.slice(at, css.indexOf("}", at));
    assert.ok(block.includes("color-mix") && block.includes("transparent"), "translucent light panel");
    assert.ok(block.includes("border-radius"), "panel radius");
    assert.ok(block.includes("max-width: 100%"), "never wider than the column");
  });

  it("keeps a narrow layout rule at or under 900 px", () => {
    const panelAt = css.indexOf(".ui-chat-empty .ds-lp-hero");
    assert.ok(panelAt !== -1, "hero panel rule exists");
    const mediaAt = css.indexOf("@media (max-width: 900px)", panelAt);
    assert.ok(mediaAt !== -1, "900px rule exists");
    assert.ok(css.slice(mediaAt, mediaAt + 400).includes(".ui-chat-empty .ds-lp-hero"),
      "hero covered at narrow width");
  });
});

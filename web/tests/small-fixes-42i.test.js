// Stage 42i — three small fixes from the 42h battery (node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (p) => fs.readFileSync(path.join(here, p), "utf8");

let Chat;
let entryHero;
let LandingPage;
let React;
let renderToString;
before(async () => {
  Chat = await import("../src/ui/chat.jsx");
  entryHero = await import("../src/ui/entry-hero.jsx");
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ LandingPage } = await import("../src/ui/landing-page.jsx"));
});

function thread(third) {
  const messages = [{ role: "assistant", kind: "simulation", data: { status: "done" } }];
  const picks = ["h-a", "h-b"];
  const candidates = [
    { id: "h-a", name: "백궁 동양파라곤" },
    { id: "h-b", name: "수서현대벤쳐빌" },
    third,
  ];
  return { messages, picks, candidates };
}

function addLine(third, lang = "ko") {
  const { messages, picks, candidates } = thread(third);
  const r = Chat.afterRunAnswer("3번 집이랑도 비교해 줘",
    { messages, picks, candidates, lang });
  assert.ok(r && r.line, "compare-add answers");
  return r.line;
}

describe("42i typed more-candidates without Muse → count line, no fallback", () => {
  it("count line in Korean and English", () => {
    assert.equal(Chat.moreCandidatesLine(9, "ko"), "후보를 9곳으로 늘려 지도에 올렸어요.");
    assert.equal(Chat.moreCandidatesLine(12, "en"), "Showing 12 homes on the map now.");
  });

  it("the count line is a visible reply, not the fallback", () => {
    const line = Chat.moreCandidatesLine(12, "ko");
    assert.equal(Chat.countsAsVisibleReply(
      { role: "assistant", kind: "text", content: line }), true);
    assert.notEqual(line, Chat.localNoAnswerLine("다른 후보 더 보여 줘"));
    assert.notEqual(line, Chat.nonMuseNoReplyLine("다른 후보 더 보여 줘",
      { messages: [], lang: "ko" }));
  });

  it("structuredFlow pushes the count line after the stored-profile re-run", () => {
    const src = readSrc("../src/ui/chat.jsx");
    const branch = src.indexOf("if (isMoreCandidatesRequest(text))");
    assert.ok(branch >= 0, "more-candidates branch");
    const push = src.indexOf("moreCandidatesLine(", branch);
    assert.ok(push > branch, "count line pushed after the re-run");
  });
});

describe("42i compare-add line uses the card display name", () => {
  it("lot-id name with dong/kind → display name, no raw-id label", () => {
    const line = addLine({ id: "h-c", name: "(84-0)", dong: "판교", kind: "○○빌" });
    assert.ok(line.includes("○○빌"), line);
    assert.ok(!line.includes("C (84-0)"), line);
  });

  it("parenthesised-id-only name → {N}번 집", () => {
    const line = addLine({ id: "h-c", name: "(84-0)" });
    assert.ok(line.includes("3번 집"), line);
    assert.ok(!line.includes("(84-0)"), line);
  });
});

describe("42i landing and chat empty state share one placeholder", () => {
  it("same constant rendered in both", () => {
    const ph = entryHero.ENTRY_COMPOSER_PLACEHOLDER;
    assert.ok(ph && ph.includes("판교 출근"), "shared constant");
    const landing = renderToString(React.createElement(LandingPage));
    assert.ok(landing.includes(ph), "landing shows it");
    const empty = renderToString(React.createElement(Chat.ChatEmpty,
      { onSend: () => {}, onListing: () => {}, onExample: () => {} }));
    assert.ok(empty.includes(ph), "chat empty state shows it");
    assert.ok(!empty.includes("예: 판교로 출근해요"), "old text gone");
  });

  it("both files use the shared constant", () => {
    assert.ok(readSrc("../src/ui/entry-hero.jsx").includes("ENTRY_COMPOSER_PLACEHOLDER"));
    assert.ok(readSrc("../src/ui/landing-page.jsx").includes("ENTRY_COMPOSER_PLACEHOLDER"));
    assert.ok(readSrc("../src/ui/chat.jsx").includes("ENTRY_COMPOSER_PLACEHOLDER"));
  });
});

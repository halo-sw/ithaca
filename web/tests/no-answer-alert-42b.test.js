// 42b: when Muse cannot answer, the chat says so where it matters
// and offers the key field there. Pure helpers + SSR (no DOM, no keys).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (p) => fs.readFileSync(path.join(here, p), "utf8");

describe("42b no-answer alert text per cause", () => {
  let noAnswerAlertFor;
  let noAnswerCause;
  before(async () => {
    ({ noAnswerAlertFor, noAnswerCause } = await import("../src/ui/no-answer-alert.js"));
  });

  it("server key used wins over the other causes", () => {
    assert.equal(noAnswerCause({ serverKeyUsed: true, keyless: true, fails: 5 }), "serverKeyUsed");
    assert.ok(noAnswerAlertFor({ serverKeyUsed: true }).includes("무료 체험(1회)을 이미 썼어요"));
  });

  it("keyless names the missing key", () => {
    assert.equal(noAnswerCause({ keyless: true, fails: 2 }), "keyless");
    assert.ok(noAnswerAlertFor({ keyless: true }).includes("Muse 키가 없어서"));
  });

  it("one failure is enough to mark the turn", () => {
    assert.equal(noAnswerCause({ fails: 1 }), "failures");
    assert.ok(noAnswerAlertFor({ fails: 3 }).includes("이번 답은 규칙으로 했어요"));
  });

  it("null when Muse answered", () => {
    assert.equal(noAnswerAlertFor({}), null);
    assert.equal(noAnswerAlertFor({ serverKeyUsed: false, keyless: false, fails: 0 }), null);
    assert.equal(noAnswerAlertFor(undefined), null);
  });
});

describe("42b saving a key through the alert", () => {
  let saveNoAnswerKey;
  let clearedNoAnswer;
  let noAnswerAlertFor;
  let saveByoKey;
  let STORAGE_PREFIX;
  before(async () => {
    ({ saveNoAnswerKey, clearedNoAnswer, noAnswerAlertFor } = await import("../src/ui/no-answer-alert.js"));
    ({ saveByoKey, STORAGE_PREFIX } = await import("../src/consult/byok.js"));
  });

  const fakeStorage = () => {
    const data = new Map();
    return {
      data,
      setItem: (k, v) => { data.set(k, String(v)); },
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      removeItem: (k) => { data.delete(k); },
    };
  };

  it("writes sessionStorage via saveByoKey and clears the alert state", () => {
    const session = fakeStorage();
    const ok = saveNoAnswerKey(
      { storage: session, provider: "meta", key: "k-test-123" }, saveByoKey);
    assert.equal(ok, true);
    assert.equal(session.getItem(`${STORAGE_PREFIX}meta`), "k-test-123");
    const cleared = clearedNoAnswer();
    assert.equal(noAnswerAlertFor({ serverKeyUsed: true, keyless: true, fails: 2 }) !== null, true);
    assert.equal(noAnswerAlertFor(cleared), null);
  });

  it("empty key saves nothing", () => {
    const session = fakeStorage();
    assert.equal(saveNoAnswerKey({ storage: session, provider: "meta", key: "" }, saveByoKey), false);
    assert.equal(session.data.size, 0);
  });

  it("nothing goes to localStorage", () => {
    const src = readSrc("../src/ui/no-answer-alert.js");
    assert.ok(!/localStorage\s*\./.test(src), "helper must never touch localStorage");
    const chat = readSrc("../src/ui/chat.jsx");
    assert.ok(/saveNoAnswerKey\(\{\s*storage:\s*sessionStorageOf\(\)/.test(chat),
      "alert key must go through sessionStorageOf (this tab only)");
  });
});

describe("42b rule answers say who answered (SSR)", () => {
  let React;
  let renderToStaticMarkup;
  let AssistantMsg;
  let RULE_ANSWER_META;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToStaticMarkup } = await import("react-dom/server"));
    ({ AssistantMsg } = await import("../src/ui/consult.jsx"));
    ({ RULE_ANSWER_META } = await import("../src/ui/no-answer-alert.js"));
  });

  it("a rule answer renders the meta line", () => {
    const html = renderToStaticMarkup(React.createElement(AssistantMsg,
      { msg: { role: "assistant", content: "두 곳을 담아 주세요.", fromModel: false }, toolRows: {} }));
    assert.ok(html.includes(RULE_ANSWER_META));
    assert.ok(html.includes("규칙으로 답했어요"));
  });

  it("a Muse answer keeps the model name and shows no rule line", () => {
    const html = renderToStaticMarkup(React.createElement(AssistantMsg,
      { msg: { role: "assistant", content: "찾았어요.", fromModel: true, model: "meta" }, toolRows: {} }));
    assert.ok(html.includes("Muse Spark 1.3"));
    assert.ok(!html.includes("규칙으로 답했어요"));
  });
});

describe("42b diary and report say why, with a way forward (SSR)", () => {
  let React;
  let renderToStaticMarkup;
  let DiarySection;
  let ReportCheck;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToStaticMarkup } = await import("react-dom/server"));
    ({ DiarySection, ReportCheck } = await import("../src/ui/chat.jsx"));
  });

  it("failed diary shows the new line plus 일기 다시 쓰기", () => {
    let retried = 0;
    const html = renderToStaticMarkup(React.createElement(DiarySection,
      { diary: { status: "failed" }, customId: "c1", onRetry: () => { retried += 1; }, canRetry: true }));
    assert.ok(html.includes("일기는 Muse가 써요. 키를 넣으면 다시 쓸 수 있어요."));
    assert.ok(html.includes("일기 다시 쓰기"));
    assert.equal(retried, 0);
  });

  it("failed diary retry stays disabled until a key works", () => {
    const html = renderToStaticMarkup(React.createElement(DiarySection,
      { diary: { status: "failed" }, customId: "c1", onRetry: () => {}, canRetry: false }));
    assert.ok(html.includes("일기 다시 쓰기"));
    assert.ok(html.includes("disabled"));
  });

  it("failed report shows the new line and keeps 다시 검증하기", () => {
    const html = renderToStaticMarkup(React.createElement(ReportCheck,
      { report: { status: "failed", attempts: [] }, names: {}, onRetry: () => {} }));
    assert.ok(html.includes("리포트 검증은 Muse가 해요. 지금은 연결이 안 돼서 하지 못했어요."));
    assert.ok(html.includes("다시 검증하기"));
  });
});

describe("42b landing 바로 해 보기 captions and key row (SSR)", () => {
  let React;
  let renderToStaticMarkup;
  let LandingPage;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToStaticMarkup } = await import("react-dom/server"));
    ({ LandingPage } = await import("../src/ui/landing-page.jsx"));
  });

  it("live entries read 무료 체험 1회 · 이후 내 키, replay needs no key", () => {
    const html = renderToStaticMarkup(React.createElement(LandingPage));
    const trial = html.match(/무료 체험 1회 · 이후 내 키/g) || [];
    assert.equal(trial.length, 1);
    assert.equal(html.match(/Muse 실시간/g).length, 1);
    assert.ok(html.includes("키 없이"));
    assert.ok(html.includes("녹화된 30일을 재생해요"));
    assert.ok(!html.includes("키 없이 바로 재생"));
  });

  it("the key row exists and is collapsed by default", () => {
    const html = renderToStaticMarkup(React.createElement(LandingPage));
    assert.ok(html.includes("내 모델 키로 하기"));
    assert.ok(html.includes("▸"));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(!html.includes('type="password"'), "key field hidden until opened");
    assert.ok(!html.includes("Muse Spark Open · Baseten"), "providers hidden until opened");
  });
});

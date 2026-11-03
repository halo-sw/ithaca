import test from "node:test";
import assert from "node:assert/strict";
import {
  sceneSentence,
  imagePrompt,
  IMAGE_PROMPT_PREFIX,
  createDiaryImageHandler,
} from "../src/consult/diary-image.js";
import { createRelay } from "../../relay/handler.js";

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      res.headers[k] = v;
    },
    end(b) {
      res.body = String(b ?? "");
    },
  };
  return res;
}

function postReq(sentence) {
  return { method: "POST", body: JSON.stringify({ sentence, lang: "en" }) };
}

function okFetchImpl(record) {
  return async (url, init) => {
    record.url = url;
    record.init = init;
    return {
      status: 200,
      json: async () => ({ data: [{ b64_json: "UklGRg==" }], output_format: "webp" }),
    };
  };
}

const ENV = { META_API_KEY: "test-key" };

test("sceneSentence strips day prefix (en)", () => {
  assert.equal(sceneSentence("Day 16, walked home after sunset"), "walked home after sunset");
});

test("sceneSentence strips day prefix (ko)", () => {
  assert.equal(sceneSentence("16일째 해 진 뒤 걸어서 귀가했어요"), "해 진 뒤 걸어서 귀가했어요");
});

test("imagePrompt contains no digits", () => {
  assert.equal(/\d/.test(imagePrompt("Day 3, 12 min walk to 2 stores")), false);
});

test("handler 200 returns data url and sends correct upstream request", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const req = postReq("Day 16, walked home after sunset");
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  const out = JSON.parse(res.body);
  assert.ok(out.image.startsWith("data:image/webp;base64,"));
  assert.ok(String(record.url).endsWith("/images/generations"));
  const sent = JSON.parse(record.init.body);
  assert.equal(sent.model, "muse-image-1.0");
  assert.ok(String(sent.prompt).startsWith(IMAGE_PROMPT_PREFIX));
  assert.equal(/\d/.test(sent.prompt), false);
  assert.equal(record.init.headers.Authorization, "Bearer test-key");
  assert.equal("prompt" in out, false);
});

test("handler rejects 201-char sentence", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq("a".repeat(201)), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /bad_sentence/);
});

test("handler rejects url-like sentence", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq("see http://x"), res);
  assert.equal(res.statusCode, 400);
});

test("handler rejects digit-only scene", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq("12 34"), res);
  assert.equal(res.statusCode, 400);
});

test("handler rejects GET with 405", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 405);
});

test("handler without key returns 503", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: {} });
  const res = makeRes();
  await handler(postReq("walked home after sunset"), res);
  assert.equal(res.statusCode, 503);
});

test("handler fetch throw returns 502", async () => {
  const handler = createDiaryImageHandler({
    fetchImpl: async () => {
      throw new Error("down");
    },
    env: ENV,
  });
  const res = makeRes();
  await handler(postReq("walked home after sunset"), res);
  assert.equal(res.statusCode, 502);
});

test("handler upstream 429 returns 502 with status 429", async () => {
  const handler = createDiaryImageHandler({
    fetchImpl: async () => ({ status: 429, json: async () => ({}) }),
    env: ENV,
  });
  const res = makeRes();
  await handler(postReq("walked home after sunset"), res);
  assert.equal(res.statusCode, 502);
  assert.match(res.body, /429/);
});

test("relay GET /api/image/diary is 405", async () => {
  const relay = createRelay({ env: { META_API_KEY: "test-key" }, fetchImpl: async () => ({ status: 200, json: async () => ({}) }) });
  const res = makeRes();
  await relay(
    {
      method: "GET",
      url: "/api/image/diary",
      headers: { origin: "https://halo-sw.github.io" },
      socket: { remoteAddress: "8.8.8.8" },
    },
    res,
  );
  assert.equal(res.statusCode, 405);
});

test("relay rate-limits the 6th diary image POST in 10 minutes", async () => {
  const record = {};
  const relay = createRelay({ env: { META_API_KEY: "test-key" }, fetchImpl: okFetchImpl(record) });
  const diaryReq = () => ({
    method: "POST",
    url: "/api/image/diary",
    headers: { origin: "https://halo-sw.github.io" },
    socket: { remoteAddress: "7.7.7.7" },
    body: JSON.stringify({ sentence: "walked home after sunset", lang: "en" }),
  });
  for (let i = 0; i < 5; i++) {
    const res = makeRes();
    await relay(diaryReq(), res);
    assert.equal(res.statusCode, 200);
  }
  const limited = makeRes();
  await relay(diaryReq(), limited);
  assert.equal(limited.statusCode, 429);
});

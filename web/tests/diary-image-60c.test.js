import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENE_KINDS,
  SCENES,
  IMAGE_PROMPT_PREFIX,
  lightFor,
  scenePrompt,
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

function postReq(body) {
  return { method: "POST", body: JSON.stringify(body) };
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
const GOOD = { kind: "park", minute: 1127, region: "kr" };

test("scenePrompt starts with prefix and contains no digit, every kind and region", () => {
  assert.deepEqual([...SCENE_KINDS].sort(), ["commute", "errand", "park", "plan", "ride"]);
  for (const kind of SCENE_KINDS) {
    for (const region of ["kr", "us"]) {
      const p = scenePrompt({ kind, minute: 600, region });
      assert.ok(p.startsWith(IMAGE_PROMPT_PREFIX), `${kind}/${region}`);
      assert.equal(/\d/.test(p), false, `${kind}/${region}`);
      assert.ok(p.includes(SCENES[kind][region]), `${kind}/${region}`);
    }
  }
});

test("lightFor gives the five phrases in order", () => {
  assert.equal(lightFor(0), "before dawn, deep blue sky");
  assert.equal(lightFor(480), "soft morning light");
  assert.equal(lightFor(900), "bright afternoon light");
  assert.equal(lightFor(1100), "early evening, sunset glow");
  assert.equal(lightFor(1300), "night, warm street lights");
});

test("handler 200 returns data url and sends scenePrompt upstream", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq(GOOD), res);
  assert.equal(res.statusCode, 200);
  const out = JSON.parse(res.body);
  assert.ok(out.image.startsWith("data:image/webp;base64,"));
  assert.equal("prompt" in out, false);
  const sent = JSON.parse(record.init.body);
  assert.equal(sent.prompt, scenePrompt(GOOD));
});

test("handler rejects kind selfie with bad_scene", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq({ kind: "selfie", minute: 100, region: "kr" }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /bad_scene/);
});

test("handler rejects minute 1440", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq({ kind: "park", minute: 1440, region: "kr" }), res);
  assert.equal(res.statusCode, 400);
});

test("handler rejects minute x", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq({ kind: "park", minute: "x", region: "kr" }), res);
  assert.equal(res.statusCode, 400);
});

test("handler rejects region jp", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(postReq({ kind: "park", minute: 100, region: "jp" }), res);
  assert.equal(res.statusCode, 400);
});

test("handler ignores sentence field", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: ENV });
  const res = makeRes();
  await handler(
    postReq({ kind: "park", minute: 1127, region: "kr", sentence: "draw anything at all please" }),
    res,
  );
  assert.equal(res.statusCode, 200);
  const sent = JSON.parse(record.init.body);
  assert.equal(sent.prompt, scenePrompt(GOOD));
});

test("handler rejects bad JSON with bad_request", async () => {
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl({}), env: ENV });
  const res = makeRes();
  await handler({ method: "POST", body: "{oops" }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /bad_request/);
});

test("handler without key returns 503", async () => {
  const record = {};
  const handler = createDiaryImageHandler({ fetchImpl: okFetchImpl(record), env: {} });
  const res = makeRes();
  await handler(postReq(GOOD), res);
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
  await handler(postReq(GOOD), res);
  assert.equal(res.statusCode, 502);
});

test("handler upstream 429 returns 502 with status 429", async () => {
  const handler = createDiaryImageHandler({
    fetchImpl: async () => ({ status: 429, json: async () => ({}) }),
    env: ENV,
  });
  const res = makeRes();
  await handler(postReq(GOOD), res);
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
    body: JSON.stringify({ kind: "park", minute: 1127, region: "kr" }),
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

// Stage 41f: the header model switch + chat request builder rules.
// Pure contract the chat uses: stored choice -> request bodies,
// baseten failure -> one meta retry with the notice line,
// server_key_used -> no retry, open item gated on model status.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { basetenFallbackProvider } from "../src/ui/consult-client.js";
import {
  PROVIDER_STORAGE_KEY, OPEN_MODEL_HINT, OPEN_FALLBACK_LINE_KO,
  openFallbackLine, isValidProvider, loadProviderChoice, saveProviderChoice,
  offerOpenWeights, providerLabel, recordedModelOf,
} from "../src/ui/provider-switch.js";

function memStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(k) { return Object.hasOwn(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
}

function throwingStorage() {
  return {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); },
  };
}

// What the chat sends on every /api/consult call (chat, report, diary).
function consultBody(stored, fields = {}) {
  return { provider: loadProviderChoice(stored), ...fields };
}

describe("41f provider switch", () => {
  it("a stored baseten choice rides on the request body", () => {
    const stored = memStorage({ [PROVIDER_STORAGE_KEY]: "baseten" });
    assert.equal(consultBody(stored, { task: "chat" }).provider, "baseten");
    assert.equal(consultBody(stored, { task: "report" }).provider, "baseten");
    assert.equal(consultBody(stored, { task: "diary" }).provider, "baseten");
    assert.equal(consultBody(memStorage(), {}).provider, "meta");
  });

  it("storage never throws: private mode falls back to meta", () => {
    assert.equal(loadProviderChoice(throwingStorage()), "meta");
    assert.equal(loadProviderChoice(null), "meta");
    assert.equal(saveProviderChoice("baseten", throwingStorage()), false);
    assert.equal(saveProviderChoice("x", memStorage()), false);
    assert.equal(isValidProvider("x"), false);
  });

  it("the open item shows only with baseten.hasServerKey", () => {
    assert.equal(offerOpenWeights({ baseten: { hasServerKey: true } }), true);
    assert.equal(offerOpenWeights({ baseten: { hasServerKey: false } }), false);
    assert.equal(offerOpenWeights({ meta: { hasServerKey: true } }), false);
    assert.equal(offerOpenWeights(null), false);
  });

  it("labels name the model that answered", () => {
    assert.equal(providerLabel("meta"), "Muse Spark 1.3");
    assert.equal(providerLabel("baseten"), "Muse Spark Open");
    assert.equal(providerLabel("recorded"), null);
    assert.equal(recordedModelOf("muse-spark-1.3"), "meta");
    assert.equal(recordedModelOf("meta-models/muse-spark-open-1026"), "baseten");
    assert.equal(recordedModelOf("other"), null);
  });

  it("open_limit retries once on meta with the notice line", () => {
    const openLimit = Object.assign(new Error("busy"), { code: "open_limit", httpStatus: 429 });
    assert.equal(basetenFallbackProvider("baseten", openLimit), "meta");
    const retryBody = { provider: basetenFallbackProvider("baseten", openLimit) };
    assert.equal(retryBody.provider, "meta");
    assert.equal(openFallbackLine("ko"), OPEN_FALLBACK_LINE_KO);
    assert.match(openFallbackLine("en"), /Muse Spark 1\.3/);
    assert.equal(OPEN_MODEL_HINT, "오픈 웨이트 모델(Muse Spark Open)로 같은 상담을 돌려 볼 수 있어요");
  });

  it("any other baseten error retries, server_key_used does not", () => {
    const boom = Object.assign(new Error("down"), { httpStatus: 500 });
    assert.equal(basetenFallbackProvider("baseten", boom), "meta");
    const spent = Object.assign(new Error("spent"), { code: "server_key_used", httpStatus: 429 });
    assert.equal(basetenFallbackProvider("baseten", spent), null);
    assert.equal(basetenFallbackProvider("meta", boom), null);
  });
});

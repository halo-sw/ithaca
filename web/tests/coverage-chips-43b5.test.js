// 43b5 — coverage chips send a chat turn, so they work in a Muse
// session too. The rule parser reads each chip sentence the way
// chat.jsx does (extractStep); the handler sends turns via send, never
// liveResearch or the tray handlers directly.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractStep, runGate } from "../src/chat/engine.js";
import { noCommuteEntry } from "../src/profile.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const chatSrc = readFileSync(join(HERE, "..", "src", "ui", "chat.jsx"), "utf8");

// The live Muse-session setup from the report: USD Meta HQ profile
// with monthlyMax 3000 and zero candidates.
const BASE = "I work at Meta HQ in Menlo Park. Renting alone, up to $3,000 a month.";

function handlerBody() {
  const start = chatSrc.indexOf("function handleCoverageChip");
  assert.ok(start !== -1, "handleCoverageChip exists");
  const end = chatSrc.indexOf("const handlers", start);
  return chatSrc.slice(start, end === -1 ? start + 2500 : end);
}

describe("43b5 chip sentences parse", () => {
  it("setup reads the USD Meta HQ profile with monthlyMax 3000", () => {
    const r = extractStep(BASE, null, []);
    assert.equal(r.value.ok, true);
    assert.equal(r.value.profile.monthlyMax.value, 3000);
    const wps = r.value.profile.workplaces.value;
    assert.ok(wps && wps[0] && wps[0].resolved && wps[0].resolved.place);
    assert.equal(wps[0].resolved.place.id, "meta-hq");
  });

  it("budget sentence reads monthlyMax 3600", () => {
    const r = extractStep("Show homes up to $3,600 a month.", null, []);
    assert.equal(r.value.ok, true);
    assert.equal(r.value.profile.monthlyMax.value, 3600);
  });

  it("meta sentence resolves the workplace to Meta HQ", () => {
    const r = extractStep("My workplace is Meta HQ in Menlo Park.", null, []);
    assert.equal(r.value.ok, true);
    const wps = r.value.profile.workplaces.value;
    assert.ok(wps && wps[0] && wps[0].resolved && wps[0].resolved.place);
    assert.equal(wps[0].resolved.place.id, "meta-hq");
  });

  it("출근 안 해요. rides the noCommute entry and passes the gate", () => {
    const entry = noCommuteEntry("출근 안 해요.");
    assert.equal(entry.noCommute, true);
    const base = extractStep(BASE, null, []).value.profile;
    const gate = runGate({ ...base,
      workplaces: { value: [entry], source: "customer" } });
    assert.equal(gate.noCommute, true);
  });
});

describe("43b6 handleCoverageChip branches on dataRef", () => {
  it("sends via send when rule data not loaded", () => {
    const body = handlerBody();
    assert.ok(body.includes("send("), "sends a chat turn");
    assert.ok(body.includes("dataRef.current"), "branches on rule data");
    const guard = body.indexOf("dataRef.current");
    assert.ok(guard !== -1 && body.indexOf("send(", guard) !== -1, "send sits in not-loaded branch");
  });

  it("seoul still uses handleExample", () => {
    assert.ok(handlerBody().includes("handleExample"), "seoul stays handleExample");
  });
});

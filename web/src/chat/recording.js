import { assetUrl } from "../paths.js";

export const RECORDINGS = [
  { id: "menlo-month", title: "Meta 본사 출근 · 두 사람의 한 달", titleEn: "Commuting to Meta HQ · a month for two" },
  { id: "seoul-couple", title: "판교 출근 예비부부 · 집 사기 · 30일", titleEn: "Engaged couple buying a home, Pangyo commute · 30 days" },
];

export function recordingUrl(id) {
  return assetUrl("recorded/" + String(id) + ".json");
}

export function validateRecording(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") return { ok: false, errors: ["not an object"] };
  const messages = doc.messages;
  if (!Array.isArray(messages) || messages.length === 0) errors.push("messages empty");
  else {
    messages.forEach((m, i) => {
      if (!m || typeof m !== "object") errors.push("message " + i + " not an object");
      else {
        if (!m.role) errors.push("message " + i + " missing role");
        if (!m.kind) errors.push("message " + i + " missing kind");
      }
    });
  }
  const meta = doc.meta;
  if (!meta || typeof meta !== "object") errors.push("missing meta");
  else {
    if (typeof meta.id !== "string" || !/^[a-z0-9-]+$/.test(meta.id)) errors.push("bad meta.id");
    if (typeof meta.model !== "string" || meta.model === "") errors.push("bad meta.model");
  }
  return { ok: errors.length === 0, errors };
}

// 36i2: the plan to rebuild a replay's 3D run in the browser. The last
// done simulation card carries the run's id, labels, names and money
// doc; doc.scenario (with its seed) re-runs the deterministic worker.
export function replayRunPlan(doc) {
  if (!doc || typeof doc !== "object") return null;
  if (!doc.scenario || typeof doc.scenario !== "object") return null;
  const messages = Array.isArray(doc.messages) ? doc.messages : null;
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const data = m && m.kind === "simulation" ? m.data : null;
    if (!data || data.status !== "done" || !data.customId) continue;
    const { customId, labels, names, moneyDoc, moneyMissing } = data;
    if (typeof customId !== "string" || !customId) return null;
    if (!Array.isArray(labels) || labels.length === 0) return null;
    if (!names || typeof names !== "object") return null;
    if (!moneyDoc || typeof moneyDoc !== "object") return null;
    if (typeof moneyMissing !== "string") return null;
    return { customId, scenario: doc.scenario, labels, names, moneyDoc, moneyMissing };
  }
  return null;
}

export function replaySchedule(messages) {
  const list = Array.isArray(messages) ? messages : [];
  return list.map((m, index) => {
    if (m && m.role === "user") return { index, delayMs: 700 };
    if (m && (m.kind === "text" || m.kind === "system")) return { index, delayMs: 1200 };
    return { index, delayMs: 1600 };
  });
}

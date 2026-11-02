// Stage 27d: Muse writes "my diary" from the record digest; code checks every line.

import { findInventedNumbers } from "../judge/guards.js";
import { lowerMidSentenceMemberLabels } from "../profile.js";
import { cleanupEnglishAnswer } from "./guards.js";
import { homeNameEn } from "../i18n/home-names.js";

export const DIARY_PROMPT = [
  "너는 이 집들에서 각각 30일을 살아 본 '나'다. 아래 기록(facts)만 보고 쓴다.",
  "1) 집마다 일기 4~6줄. 한 줄은 fact 하나만 다루고 그 fact의 id를 단다. 일기체(~했다), 짧게, 그날의 느낌을 한마디 덧붙여도 되지만 숫자는 그 fact에 있는 숫자만 쓴다. 줄은 한 달에 걸쳐 고른다: 첫 주·중간·마지막 주에서 고루, 같은 종류는 집마다 2줄까지. 가장 오래 걸린 출근, 혼잡, 늦은 귀가처럼 눈에 띄는 날을 먼저 쓴다.",
  "2) summary: 고객에게 존댓말로 두 집의 차이를 3문장 이내로. 숫자는 totals에 있는 것만 쓴다(출근은 totals.one_way_min = 30일 평균 편도). 하루치 숫자를 대표값처럼 쓰지 않는다. 어느 집이 낫다, 계약하라 같은 판단은 하지 않는다.",
  'JSON으로만 답한다: {"summary": "...", "lines": [{"home": "A", "id": "<fact id>", "text": "..."}]}',
].join("\n");

// 26s: English-mode suffix. Facts, ids, numbers and every other rule
// stay the same; only the language changes (romanized names with the
// Korean once in parentheses, as in the agent's English rule).
export const DIARY_PROMPT_EN =
  "Write every diary line and the summary in plain English. "
  + "The facts, their ids, the numbers and every other rule above stay the same. "
  + "Write place and home names romanized with the Korean once in parentheses.";

// Prompt builder: Korean (or unset) is DIARY_PROMPT byte-identical.
export function diaryPrompt(lang) {
  if (lang === "en") return `${DIARY_PROMPT}\n${DIARY_PROMPT_EN}`;
  return DIARY_PROMPT;
}

const BANNED_SUMMARY = ["추천", "계약하", "사세요", "낫다"];

export function parseDiaryJson(content) {
  let text = String(content || "").trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    lines.shift();
    const end = lines.lastIndexOf("```");
    if (end >= 0) lines.length = end;
    text = lines.join("\n").trim();
  }
  return JSON.parse(text);
}

// 26s: number check tolerant of comma grouping ("660,000" vs
// "660000"). Passes when either the raw or the comma-stripped text
// cites only allowed numbers.
function inventedInDiary(text, allowed) {
  const bad = findInventedNumbers(String(text || ""), "", allowed);
  if (bad.length === 0) return bad;
  const flat = String(text || "").replace(/(\d),(?=\d)/g, "$1");
  if (flat === String(text || "")) return bad;
  const badFlat = findInventedNumbers(flat, "", allowed);
  if (badFlat.length === 0) return badFlat;
  return bad;
}

function digestsByLabel(digests) {
  const map = new Map();
  for (const d of digests || []) {
    if (!d || typeof d.label !== "string") continue;
    const factsById = new Map();
    for (const f of d.facts || []) {
      if (f && typeof f.id === "string") factsById.set(f.id, f);
    }
    map.set(d.label, { digest: d, factsById });
  }
  return map;
}

export function checkDiary(parsed, digests) {
  const failures = [];
  const byLabel = digestsByLabel(digests);
  const lines = parsed && Array.isArray(parsed.lines) ? parsed.lines : [];
  lines.forEach((line, i) => {
    const n = i + 1;
    const entry = line && typeof line.home === "string" ? byLabel.get(line.home) : null;
    if (!entry) {
      failures.push({ index: i, reason_ko: `줄 ${n}: 알 수 없는 집` });
      return;
    }
    const fact = typeof line.id === "string" ? entry.factsById.get(line.id) : null;
    if (!fact) {
      failures.push({ index: i, reason_ko: `줄 ${n}: 근거 없는 줄` });
      return;
    }
    const text = typeof line.text === "string" ? line.text : "";
    if (text.trim().length === 0) {
      failures.push({ index: i, reason_ko: `줄 ${n}: 빈 줄` });
      return;
    }
    if (text.length > 80) {
      failures.push({ index: i, reason_ko: `줄 ${n}: 80자를 넘었어요` });
      return;
    }
    // 26s: comma-grouped won reads the same either way — "₩660,000"
    // cites 660000 when the fact holds it whole, and 660 + 0 when the
    // fact text held the comma form. Either tokenization passing is
    // enough; a truly invented number fails both.
    const bad = inventedInDiary(text, new Set(fact.numbers || []));
    if (bad.length > 0) {
      failures.push({ index: i, reason_ko: `줄 ${n}: 기록에 없는 숫자 ${bad[0]}` });
    }
  });
  let summaryOk = true;
  const summary = parsed && typeof parsed.summary === "string" ? parsed.summary : "";
  if (BANNED_SUMMARY.some((w) => summary.includes(w))) {
    summaryOk = false;
  } else {
    const allowed = new Set();
    for (const d of digests || []) {
      const totals = (d && d.totals) || {};
      for (const v of Object.values(totals)) {
        if (Number.isFinite(v)) allowed.add(v);
      }
    }
    const bad = inventedInDiary(summary, allowed);
    if (bad.length > 0) summaryOk = false;
  }
  return { failures, summaryOk };
}

// 26t: deterministic fallback summary. Korean byte-identical to today;
// in English mode it is built in English directly (never marked
// data-no-i18n, so it stays translatable either way).
function fallbackSummary(digests, lang = "ko") {
  const list = digests || [];
  if (lang === "en") {
    const parts = list.map((d, i) => {
      const v = d && d.totals ? d.totals.one_way_min : null;
      const vv = Number.isFinite(v) ? v : "–";
      const name = (d && typeof d.name === "string" && d.name.trim() !== "")
        ? ` ${d.name.trim()}` : "";
      const head = `${d.label}${name}`;
      return i === 0
        ? `${head}: average one-way commute ${vv} min`
        : `${head}: ${vv} min`;
    });
    return `${parts.join("; ")}.`;
  }
  const parts = list.map((d) => {
    const v = d && d.totals ? d.totals.one_way_min : null;
    return `${d.label}는 출근 편도 평균 ${Number.isFinite(v) ? v : "–"}분`;
  });
  return `${parts.join(", ")}이었어요.`;
}

function keptLines(parsed, digests) {
  const byLabel = digestsByLabel(digests);
  const out = [];
  const lines = parsed && Array.isArray(parsed.lines) ? parsed.lines : [];
  const { failures } = checkDiary(parsed, digests);
  const badIdx = new Set(failures.map((f) => f.index));
  lines.forEach((line, i) => {
    if (badIdx.has(i)) return;
    const entry = byLabel.get(line.home);
    const fact = entry ? entry.factsById.get(line.id) : null;
    if (!fact) return;
    out.push({ home: line.home, id: line.id, text: line.text, day: fact.day, minute: fact.minute });
  });
  return out;
}

// 41g: Spark Open (provider "baseten") spends 4–5k reasoning tokens
// per call — the diary path leaves room after reasoning, waits
// longer, and retries once, like the agent turn.
export const DIARY_MAX_TOKENS = { meta: 8000, baseten: 12000 };
export const DIARY_TIMEOUT_MS = { meta: 60000, baseten: 180000 };

export function diaryCallBudget(provider) {
  const baseten = provider === "baseten";
  return {
    maxTokens: baseten ? DIARY_MAX_TOKENS.baseten : DIARY_MAX_TOKENS.meta,
    timeoutMs: baseten ? DIARY_TIMEOUT_MS.baseten : DIARY_TIMEOUT_MS.meta,
  };
}

// A leading "Muse " is the UI badge's word, never the summary's —
// strip it when the model echoes it.
export function cleanDiarySummary(summary) {
  return lowerMidSentenceMemberLabels(
    String(summary || "").replace(/^(Muse|뮤즈)\s+/, ""));
}

// 41i: the English post-run summary and diary lines pass through the
// same deterministic cleanup as chat answers (41b) — Hangul
// parentheticals, tenure words, won forms and salutations — with each
// digest's Korean home name mapped to its homeNameEn (the same English
// name the card shows).
function englishNamesFor(digests) {
  const names = {};
  for (const d of digests || []) {
    const nm = d && typeof d.name === "string" ? d.name.trim() : "";
    if (!nm || !/[가-힣]/.test(nm)) continue;
    try {
      const en = homeNameEn(nm);
      if (en) names[nm] = en;
    } catch { /* the cleanup still strips the Hangul parens */ }
  }
  return names;
}

function cleanEnSummary(summary, digests) {
  return cleanupEnglishAnswer(cleanDiarySummary(summary),
    { lang: "en", names: englishNamesFor(digests), commuteMinutes: true });
}

function cleanEnLines(lines, digests) {
  const names = englishNamesFor(digests);
  return (lines || []).map((l) => (l && typeof l.text === "string"
    ? { ...l, text: cleanupEnglishAnswer(l.text, { lang: "en", names }) } : l));
}

// The rule diary: lines straight off the same facts (short fact texts
// pass checkDiary by construction), never an empty diary.
export function ruleDiary(digests, lang = "ko") {
  const lines = [];
  for (const d of digests || []) {
    const home = d && d.label;
    if (typeof home !== "string") continue;
    const short = (d.facts || []).filter((f) => f && typeof f.id === "string"
      && typeof f.text_ko === "string" && f.text_ko.length > 0 && f.text_ko.length <= 80);
    short.sort((a, b) => (a.day - b.day) || (a.minute - b.minute));
    const n = Math.min(short.length, 5);
    for (let i = 0; i < n; i++) {
      const pick = short[Math.floor((i * short.length) / n)];
      if (lines.some((l) => l.home === home && l.id === pick.id)) continue;
      lines.push({ home, id: pick.id, text: pick.text_ko });
    }
  }
  const parsed = { summary: fallbackSummary(digests, lang), lines };
  const checked = checkDiary(parsed, digests);
  const kept = keptLines(parsed, digests);
  const en = lang === "en";
  return {
    ok: true,
    summary: en ? cleanEnSummary(parsed.summary, digests) : cleanDiarySummary(parsed.summary),
    lines: en ? cleanEnLines(kept, digests) : kept,
    check: { total: kept.length, passed: kept.length,
      retried: 0, dropped: 0, summary_fallback: true, rule: true,
      failures: checked.failures.length },
    usage: {},
  };
}

export async function writeDiary({ complete, provider, digests, lang = "ko" }) {
  const baseMessages = [
    { role: "system", content: diaryPrompt(lang) },
    { role: "user", content: JSON.stringify(digests) },
  ];
  const budget = diaryCallBudget(provider);
  const attempt = async (messages) => {
    try {
      return await complete({ provider, messages,
        maxTokens: budget.maxTokens, timeoutMs: budget.timeoutMs });
    } catch {
      return null;
    }
  };
  const first = await attempt(baseMessages);
  const firstContent = (first && first.message && first.message.content) || "";
  let parsed;
  try {
    parsed = parseDiaryJson(firstContent);
  } catch {
    parsed = { summary: "", lines: [] };
  }
  let checked = checkDiary(parsed, digests);
  let retried = 0;
  let usage = (first && first.usage) || {};
  let current = parsed;
  let currentContent = firstContent;
  if (checked.failures.length > 0 || !checked.summaryOk) {
    retried = 1;
    const notes = checked.failures.map((f) => `줄 ${f.index + 1}: ${f.reason_ko.replace(/^줄 \d+: /, "")}`);
    if (!checked.summaryOk) notes.push("요약: 기록의 숫자만 쓰고 판단 표현(추천/계약/낫다)을 빼주세요.");
    const retry = await attempt([...baseMessages,
      { role: "assistant", content: currentContent },
      { role: "user", content: `고쳐 써주세요.\n${notes.map((n) => `${n}`).join("\n")}` }]);
    if (retry) usage = (retry && retry.usage) || usage;
    const retryContent = (retry && retry.message && retry.message.content) || "";
    try {
      current = parseDiaryJson(retryContent);
    } catch {
      current = { summary: "", lines: [] };
    }
    currentContent = retryContent;
    checked = checkDiary(current, digests);
  }
  const lines = keptLines(current, digests);
  const dropped = (current && Array.isArray(current.lines) ? current.lines.length : 0) - lines.length;
  let summary = typeof current.summary === "string" ? current.summary : "";
  let summary_fallback = false;
  if (!checked.summaryOk) {
    summary = fallbackSummary(digests, lang);
    summary_fallback = true;
  }
  if (lines.length === 0) {
    // Still nothing usable after the retry: hand back the rule diary
    // built from the same facts, never an empty diary.
    const fallback = ruleDiary(digests, lang);
    return { ...fallback, check: { ...fallback.check, retried } };
  }
  const total = lines.length + dropped;
  const en = lang === "en";
  return {
    ok: true,
    summary: en ? cleanEnSummary(summary, digests) : cleanDiarySummary(summary),
    lines: en ? cleanEnLines(lines, digests) : lines,
    check: { total, passed: lines.length, retried, dropped, summary_fallback },
    usage,
  };
}

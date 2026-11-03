// Consult browser client: thin fetch wrappers (no React, no keys).
//
// The chat's free questions post to /api/consult (dev server or, on the
// public site, the relay, which keeps the keys); the fixed flow
// (profile → candidates → simulation) runs keyless in the browser, and
// ?ask=… replays recorded replies. Nothing here imports server modules
// or provider code, so no key material can enter the bundle.
//
// 23b: on the public site the calls go to the relay, which keeps the
// keys. Without a live API (no dev server, no relay) the model calls
// stay off and the rule-based flow keeps working.

import { assetUrl, LIVE_API, apiUrl } from "../paths.js";
import { SESSION_HEADER, getChatSessionId } from "../chat/session-id.js";
import { judgeHeaders } from "../chat/judge-code.js";
import {
  parseRateLimitWaitSec,
  canRetryRateLimit,
  waitWithHeartbeat,
  abortError,
} from "./decision-retry.js";

// 41e: one server-key chat session per IP — every /api/consult
// request carries the tab's session id (BYOK requests too; the
// relay enforces the rule on the server key only).
function sessionHeaders() {
  let headers = {};
  try {
    const id = getChatSessionId();
    if (id) headers = { [SESSION_HEADER]: id };
  } catch {
    /* no storage — the relay treats it as a new session */
  }
  try {
    return { ...headers, ...judgeHeaders() };
  } catch {
    return headers;
  }
}

function markServerKeyUsed(err, payload) {
  if (payload && payload.error === "server_key_used") err.code = "server_key_used";
  else if (payload && payload.error === "open_limit") err.code = "open_limit";
  return err;
}

// 41f: a baseten turn that fails for any reason except the spent
// server-key session is worth one retry on Muse Spark 1.3. Pure.
export function basetenFallbackProvider(provider, err) {
  if (provider !== "baseten") return null;
  if (err && err.code === "server_key_used") return null;
  return "meta";
}

// 41g: Spark Open answers slowly (4–5k reasoning tokens) — the diary
// and report-check fetches wait longer on baseten than on meta.
export const CONSULT_TIMEOUT_MS = { meta: 90000, baseten: 180000 };

export function consultTimeoutMs(provider) {
  return provider === "baseten" ? CONSULT_TIMEOUT_MS.baseten : CONSULT_TIMEOUT_MS.meta;
}

function timeoutSignal(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

// 27b2: NDJSON stream parser for the consult stream.
export function parseNdjson(buffer, chunk) {
  const text = buffer + chunk;
  const parts = text.split("\n");
  const rest = parts.pop();
  const events = [];
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip bad lines
    }
  }
  return { events, rest };
}

export async function postConsult({ provider, messages, scenario, context = null, byoKey = "" }) {
  if (!LIVE_API) return { off: true, messages: [] };
  const headers = { "Content-Type": "application/json", ...sessionHeaders() };
  // 13: BYOK travels in a header to our proxy (dev server or relay) only.
  if (byoKey) headers["x-model-key"] = byoKey;
  const started = (typeof performance !== "undefined" ? performance.now() : 0);
  const r = await fetch(apiUrl("/api/consult"), {
    method: "POST",
    headers,
    body: JSON.stringify({ provider, messages, scenario, context }),
  });
  const latencyMs = (typeof performance !== "undefined" ? performance.now() : 0) - started;
  let payload = null;
  try {
    payload = await r.json();
  } catch {
    throw new Error(`상담 서버 응답 오류 (HTTP ${r.status})`);
  }
  if (!r.ok || !payload || payload.ok !== true) {
    if (r.status === 429) {
      const err = new Error("잠시 쉬었다가 다시 물어봐 주세요 (요청이 많아요)");
      err.httpStatus = 429;
      throw markServerKeyUsed(err, payload);
    }
    const err = new Error((payload && payload.error) || `상담 서버 오류 (HTTP ${r.status})`);
    err.httpStatus = r.status;
    throw err;
  }
  payload.latencyMs = Math.round(latencyMs);
  return payload;
}

// 44b: one guarded household branch decision. The worker asks once
// per branch and the main thread answers through here; the server
// judges exactly this context and returns the saved entry (model or
// explicit rule_fallback). Failures — rate limits, auth, network,
// timeouts — reject: they are never converted into a silent rule
// success. The whole JSON body is read inside the timeout lifetime.
export async function postDecision({ provider, context, byoKey = "" }, { signal, onWait, fetchFn, sleepFn } = {}) {
  if (!LIVE_API) {
    const err = new Error("상담 서버에 연결되어 있지 않아요");
    err.code = "offline";
    throw err;
  }
  if (signal && signal.aborted) throw abortError();
  const runFetch = fetchFn || fetch;
  const headers = { "Content-Type": "application/json", ...sessionHeaders() };
  if (byoKey) headers["x-model-key"] = byoKey;
  const body = JSON.stringify({ task: "decision", provider, context });
  const started = (typeof performance !== "undefined" ? performance.now() : 0);
  let retriesUsed = 0;
  let totalWaitedSec = 0;
  for (;;) {
    const wait = timeoutSignal(consultTimeoutMs(provider));
    const combined = new AbortController();
    const onOuterAbort = () => {
      try {
        combined.abort(signal && signal.reason !== undefined ? signal.reason : undefined);
      } catch {
        try {
          combined.abort();
        } catch {
          /* already aborted */
        }
      }
    };
    if (signal) {
      if (signal.aborted) {
        wait.done();
        throw abortError();
      }
      try {
        signal.addEventListener("abort", onOuterAbort, { once: true });
      } catch {
        /* non-standard signal */
      }
    }
    const onTimeoutAbort = () => {
      try {
        combined.abort();
      } catch {
        /* already aborted */
      }
    };
    try {
      wait.signal.addEventListener("abort", onTimeoutAbort, { once: true });
    } catch {
      /* non-standard signal */
    }
    let r;
    let payload = null;
    try {
      r = await runFetch(apiUrl("/api/consult"), {
        method: "POST",
        headers,
        body,
        signal: combined.signal,
      });
      payload = await r.json();
    } catch (err) {
      if (signal && signal.aborted) throw abortError();
      if (err && err.name === "AbortError") {
        const timeout = new Error("Muse의 선택이 늦어져서 중단했어요");
        timeout.code = "timeout";
        timeout.httpStatus = 408;
        throw timeout;
      }
      throw err;
    } finally {
      try {
        if (signal) signal.removeEventListener("abort", onOuterAbort);
      } catch {
        /* no listener support */
      }
      try {
        wait.signal.removeEventListener("abort", onTimeoutAbort);
      } catch {
        /* no listener support */
      }
      wait.done();
    }
    const latencyMs = (typeof performance !== "undefined" ? performance.now() : 0) - started;
    if (!r.ok || !payload || payload.ok !== true) {
      if (r.status === 429) {
        let retryAfterHeader = null;
        try {
          retryAfterHeader = r.headers ? r.headers.get("Retry-After") : null;
        } catch {
          retryAfterHeader = null;
        }
        const waitSec = parseRateLimitWaitSec({ status: r.status, payload, retryAfterHeader });
        if (
          waitSec !== null
          && canRetryRateLimit({ retriesUsed, totalWaitedSec, waitSec })
          && !(signal && signal.aborted)
        ) {
          try {
            await waitWithHeartbeat(waitSec, { signal, onWait, sleepFn });
          } catch (err) {
            if (err && (err.code === "aborted" || err.name === "AbortError")) throw abortError();
            throw err;
          }
          retriesUsed += 1;
          totalWaitedSec += waitSec;
          continue;
        }
        const err = new Error("잠시 쉬었다가 다시 물어봐 주세요 (요청이 많아요)");
        err.httpStatus = 429;
        throw markServerKeyUsed(err, payload);
      }
    if (r.status === 401 || r.status === 403) {
      const err = new Error((payload && payload.error) || `상담 서버 인증 오류 (HTTP ${r.status})`);
      err.httpStatus = r.status;
      throw err;
    }
    const err = new Error((payload && payload.error) || `상담 서버 오류 (HTTP ${r.status})`);
    err.httpStatus = r.status;
    throw err;
    }
    payload.latencyMs = Math.round(latencyMs);
    return payload;
  }
}

// 47e: household life-plan generation. Mirrors postDecision (same
// session/BYOK headers, same providers, no silent switch) but posts
// task:'life_plan'. Only bounded user history is sent — never the
// stale assistant transcript — and the server still validates. Keys
// travel in the header only, never in the body or logs. Offline,
// error, 429 and timeout reject with a useful code; a simulated or
// canned plan is never returned.
export async function postLifePlan({ provider, scenario, profile = {}, messages = [], lang = "en", byoKey = "" }) {
  if (!LIVE_API) {
    const err = new Error("상담 서버에 연결되어 있지 않아요");
    err.code = "offline";
    throw err;
  }
  const userOnly = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.role === "user" && typeof m.content === "string" && m.content.length > 0)
    .slice(-12)
    .map((m) => ({ role: "user", content: m.content }));
  const headers = { "Content-Type": "application/json", ...sessionHeaders() };
  if (byoKey) headers["x-model-key"] = byoKey;
  const started = (typeof performance !== "undefined" ? performance.now() : 0);
  const wait = timeoutSignal(consultTimeoutMs(provider));
  let r;
  let payload = null;
  try {
    r = await fetch(apiUrl("/api/consult"), {
      method: "POST",
      headers,
      body: JSON.stringify({ task: "life_plan", provider, scenario, profile, messages: userOnly, lang }),
      signal: wait.signal,
    });
    payload = await r.json();
  } catch (err) {
    if (err && err.name === "AbortError") {
      const timeout = new Error("생활 플랜을 만드는 데 시간이 오래 걸려 중단했어요");
      timeout.code = "timeout";
      timeout.httpStatus = 408;
      throw timeout;
    }
    if (err && !err.code) err.code = "plan_unavailable";
    throw err;
  } finally {
    wait.done();
  }
  const latencyMs = (typeof performance !== "undefined" ? performance.now() : 0) - started;
  if (!r.ok || !payload || payload.ok !== true || !payload.plan) {
    if (r.status === 429) {
      const err = new Error("잠시 쉬었다가 다시 물어봐 주세요 (요청이 많아요)");
      err.httpStatus = 429;
      throw markServerKeyUsed(err, payload);
    }
    if (r.status === 401 || r.status === 403) {
      const err = new Error((payload && payload.error) || `상담 서버 인증 오류 (HTTP ${r.status})`);
      err.httpStatus = r.status;
      throw err;
    }
    const err = new Error((payload && payload.error) || "Life plan could not be prepared. Please retry.");
    err.httpStatus = r.status;
    err.code = "plan_unavailable";
    throw err;
  }
  payload.latencyMs = Math.round(latencyMs);
  return payload;
}

export async function postDiary({ provider, digests, lang = "ko", byoKey = "" }) {
  if (!LIVE_API) return { off: true };
  const headers = { "Content-Type": "application/json", ...sessionHeaders() };
  if (byoKey) headers["x-model-key"] = byoKey;
  const started = (typeof performance !== "undefined" ? performance.now() : 0);
  const wait = timeoutSignal(consultTimeoutMs(provider));
  let r;
  try {
    r = await fetch(apiUrl("/api/consult"), {
      method: "POST",
      headers,
      body: JSON.stringify({ task: "diary", provider, digests, lang }),
      signal: wait.signal,
    });
  } finally {
    wait.done();
  }
  const latencyMs = (typeof performance !== "undefined" ? performance.now() : 0) - started;
  let payload = null;
  try {
    payload = await r.json();
  } catch {
    throw new Error(`상담 서버 응답 오류 (HTTP ${r.status})`);
  }
  if (!r.ok || !payload || payload.ok !== true) {
    if (r.status === 429) {
      const err = new Error("잠시 쉬었다가 다시 물어봐 주세요 (요청이 많아요)");
      err.httpStatus = 429;
      throw markServerKeyUsed(err, payload);
    }
    const err = new Error((payload && payload.error) || `상담 서버 오류 (HTTP ${r.status})`);
    err.httpStatus = r.status;
    throw err;
  }
  payload.latencyMs = Math.round(latencyMs);
  return payload;
}

// 27b2: streamed consult — same request plus `stream: true`; the server
// replies NDJSON (`tool_start` / `tool_end` rows, last line
// `{ type: "done", ...out }`). Emits live rows via onEvent and resolves
// with the done payload (without `type`) plus latencyMs.
export async function postConsultStream({ provider, messages, scenario, context = null, byoKey = "" }, onEvent) {
  if (!LIVE_API) return { off: true, messages: [] };
  const headers = { "Content-Type": "application/json", ...sessionHeaders() };
  if (byoKey) headers["x-model-key"] = byoKey;
  const started = (typeof performance !== "undefined" ? performance.now() : 0);
  const r = await fetch(apiUrl("/api/consult"), {
    method: "POST",
    headers,
    body: JSON.stringify({ provider, messages, scenario, context, stream: true }),
  });
  const latencyMs = () => Math.round((typeof performance !== "undefined" ? performance.now() : 0) - started);
  if (r.status !== 200) {
    let payload = null;
    try {
      payload = await r.json();
    } catch {
      throw new Error(`상담 서버 응답 오류 (HTTP ${r.status})`);
    }
    if (r.status === 429) {
      const err = new Error("잠시 쉬었다가 다시 물어봐 주세요 (요청이 많아요)");
      err.httpStatus = 429;
      throw markServerKeyUsed(err, payload);
    }
    const err = new Error((payload && payload.error) || `상담 서버 오류 (HTTP ${r.status})`);
    err.httpStatus = r.status;
    throw markServerKeyUsed(err, payload);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = null;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseNdjson("", buffer);
    buffer = rest;
    for (const ev of events) {
      if (!ev || typeof ev.type !== "string") continue;
      if (ev.type === "tool_start" || ev.type === "tool_end") {
        if (onEvent) onEvent(ev);
      } else if (ev.type === "error") {
        throw new Error(ev.error || "상담 서버 오류");
      } else if (ev.type === "done") {
        done = ev;
      }
    }
    if (done) break;
  }
  if (!done) {
    const { events } = parseNdjson("", buffer + "\n");
    for (const ev of events) {
      if (ev && ev.type === "done") { done = ev; break; }
      if (ev && ev.type === "error") throw new Error(ev.error || "상담 서버 오류");
    }
  }
  if (!done) throw new Error("상담 응답이 끊겼어요");
  const { type, ...out } = done;
  out.latencyMs = latencyMs();
  return out;
}

// 29j3: report-step stream (attempt lines then a done line).
export async function postReportStream({ provider, persona, labels, runs, homes, names, lang, byoKey = "" }, onEvent) {
  if (!LIVE_API) return { off: true };
  const headers = { "Content-Type": "application/json", ...sessionHeaders() };
  if (byoKey) headers["x-model-key"] = byoKey;
  const wait = timeoutSignal(consultTimeoutMs(provider));
  let r;
  try {
    r = await fetch(apiUrl("/api/consult"), {
      method: "POST",
      headers,
      body: JSON.stringify({ task: "report", stream: true, provider,
        persona, labels, runs, homes, names, lang }),
      signal: wait.signal,
    });
  } catch (err) {
    wait.done();
    if (err && err.name === "AbortError") throw new Error("상담 서버 응답이 느려요 (시간 초과)");
    throw err;
  }
  if (r.status !== 200) {
    let payload = null;
    try {
      payload = await r.json();
    } catch {
      throw new Error(`상담 서버 응답 오류 (HTTP ${r.status})`);
    }
    const err = new Error((payload && payload.error) || `상담 서버 오류 (HTTP ${r.status})`);
    err.httpStatus = r.status;
    throw markServerKeyUsed(err, payload);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = null;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseNdjson("", buffer);
    buffer = rest;
    for (const ev of events) {
      if (!ev || typeof ev.type !== "string") continue;
      if (ev.type === "error") throw new Error(ev.error || "상담 서버 오류");
      if (onEvent) onEvent(ev);
      if (ev.type === "done") { done = ev; break; }
    }
    if (done) break;
  }
  if (!done) {
    const { events } = parseNdjson("", buffer + "\n");
    for (const ev of events) {
      if (!ev || typeof ev.type !== "string") continue;
      if (ev.type === "error") throw new Error(ev.error || "상담 서버 오류");
      if (onEvent) onEvent(ev);
      if (ev.type === "done") { done = ev; break; }
    }
  }
  if (!done) throw new Error("상담 응답이 끊겼어요");
  const { type, ...out } = done;
  return out;
}

export async function fetchModelStatus() {
  if (!LIVE_API) return { off: true };
  const r = await fetch(apiUrl("/api/model/status"));
  if (!r.ok) throw new Error(`모델 상태 조회 실패 (HTTP ${r.status})`);
  return r.json();
}

export async function loadScenario(name) {
  const r = await fetch(assetUrl(`/scenarios/${name}.json`));
  if (!r.ok) throw new Error(`시나리오를 불러오지 못했습니다 (${name})`);
  return r.json();
}

export function formatUsage(usage) {
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  const total = prompt + completion;
  const tokens = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total);
  if (usage.est_usd === null || usage.est_usd === undefined) {
    return `${tokens} 토큰`;
  }
  return `${tokens} 토큰 · $${Number(usage.est_usd).toFixed(3)}`;
}

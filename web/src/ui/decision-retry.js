// 49a: pure rate-limit retry gates for one decision request.
//
// Only an HTTP 429 whose JSON body is exactly
// { error: "rate_limited" } with a finite advertised delay of
// 1..600s (payload retryAfterSec, else a valid Retry-After
// seconds header) may wait and retry the same request. At most 2
// retries and <=1200s of total advertised wait. Everything else
// rejects. No secrets are logged here.

export const RATE_LIMIT_MAX_RETRIES = 2;
export const RATE_LIMIT_MAX_SINGLE_WAIT_SEC = 600;
export const RATE_LIMIT_MAX_TOTAL_WAIT_SEC = 1200;

function toWaitSec(value) {
  if (typeof value === "number") {
    // fall through to numeric gate below
  } else if (typeof value === "string") {
    if (value.trim() === "") return null;
  } else {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const sec = Math.ceil(n);
  if (sec < 1 || sec > RATE_LIMIT_MAX_SINGLE_WAIT_SEC) return null;
  return sec;
}

// Pure gate: advertised seconds to wait, or null when the
// response must reject instead of retrying.
export function parseRateLimitWaitSec({ status, payload, retryAfterHeader }) {
  if (status !== 429) return null;
  if (!payload || payload.error !== "rate_limited") return null;
  const fromPayload = toWaitSec(payload.retryAfterSec);
  if (fromPayload !== null) return fromPayload;
  return toWaitSec(retryAfterHeader);
}

export function canRetryRateLimit({ retriesUsed, totalWaitedSec, waitSec }) {
  if (!Number.isFinite(waitSec)) return false;
  if (waitSec < 1 || waitSec > RATE_LIMIT_MAX_SINGLE_WAIT_SEC) return false;
  if (retriesUsed >= RATE_LIMIT_MAX_RETRIES) return false;
  if (totalWaitedSec + waitSec > RATE_LIMIT_MAX_TOTAL_WAIT_SEC) return false;
  return true;
}

export function abortError() {
  const err = new Error("요청이 중단되었어요");
  err.code = "aborted";
  err.name = "AbortError";
  return err;
}

function sleepAbortable(ms, signal, sleepFn) {
  if (signal && signal.aborted) return Promise.reject(abortError());
  const sleep = sleepFn || ((v) => new Promise((r) => setTimeout(r, v)));
  let onAbort = null;
  let cleanup = () => {};
  const gate = new Promise((resolve, reject) => {
    cleanup = () => {
      try {
        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      } catch {
        /* no listener support */
      }
    };
    onAbort = () => {
      cleanup();
      reject(abortError());
    };
    try {
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
    } catch {
      /* non-standard signal */
    }
    Promise.resolve()
      .then(() => sleep(ms))
      .then(
        () => {
          cleanup();
          if (signal && signal.aborted) reject(abortError());
          else resolve();
        },
        (err) => {
          cleanup();
          reject(err);
        },
      );
  });
  return gate;
}

// Abortable ~1s heartbeat. Calls onWait({ remainingSec }) about
// once a second; rejects with an abort error when signal aborts.
export async function waitWithHeartbeat(waitSec, { signal, onWait, sleepFn } = {}) {
  let remaining = waitSec;
  while (remaining > 0) {
    if (signal && signal.aborted) throw abortError();
    if (typeof onWait === "function") {
      try {
        onWait({ remainingSec: remaining });
      } catch {
        /* progress must never break the wait */
      }
    }
    const chunkMs = Math.min(1000, Math.ceil(remaining * 1000));
    await sleepAbortable(chunkMs, signal, sleepFn);
    remaining -= 1;
    if (remaining < 0) remaining = 0;
  }
}

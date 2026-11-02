// 42b: pinned no-answer alert helpers. Pure (no React, no DOM at
// import): the chat owns the state, this module owns the texts and
// the rules. Unit-tested in no-answer-alert-42b.test.js.
import { saveByoKey } from "../consult/byok.js";

export const NO_ANSWER_TEXTS = {
  serverKeyUsed: "Muse가 지금 답하지 못해요. 이 네트워크의 무료 체험(1회)을 이미 썼어요. 지금은 정해진 규칙으로만 답해요.",
  keyless: "Muse 키가 없어서 정해진 규칙으로만 답해요.",
  failures: "Muse 연결이 안 돼서 이번 답은 규칙으로 했어요.",
};

// Precedence: server key used > keyless > 27j failures.
export function noAnswerCause({ serverKeyUsed, keyless, fails } = {}) {
  if (serverKeyUsed) return "serverKeyUsed";
  if (keyless) return "keyless";
  if ((fails ?? 0) >= 1) return "failures";
  return null;
}

export function noAnswerAlertFor({ serverKeyUsed, keyless, fails } = {}) {
  const cause = noAnswerCause({ serverKeyUsed, keyless, fails });
  return cause ? NO_ANSWER_TEXTS[cause] : null;
}

// Dismiss snapshot: the alert hidden for this snapshot comes back
// when the next non-Muse turn changes it.
export function noAnswerKey({ serverKeyUsed, keyless, fails } = {}) {
  return `${serverKeyUsed ? 1 : 0}|${keyless ? 1 : 0}|${Number(fails) || 0}`;
}

// The alert state after a key is saved for the active provider —
// the next turn goes to Muse.
export function clearedNoAnswer() {
  return { serverKeyUsed: false, keyless: false, fails: 0 };
}

// The alert's key field writes through the same storage as
// ModelPanel (saveByoKey into the passed sessionStorage). It never
// touches localStorage, never logs, never builds a URL.
export function saveNoAnswerKey({ storage, provider, key }, save = saveByoKey) {
  if (!key) return false;
  return save(storage, provider, key) === true;
}

export const NO_ANSWER_PROVIDERS = [
  { value: "meta", label: "Muse Spark 1.3 · Meta" },
  { value: "baseten", label: "Muse Spark Open · Baseten" },
];

export const NO_ANSWER_SUCCESS = "키를 저장했어요. 다음 말부터 Muse가 답해요.";
export const NO_ANSWER_KEY_NOTE = "키는 이 탭에만 저장돼요";

// Assistant bubbles: model text keeps the model name (ModelTag);
// anything stamped fromModel: false says who answered instead.
export const RULE_ANSWER_META = "규칙으로 답했어요";

export function answerMetaFor(msg) {
  return msg && msg.fromModel === false ? RULE_ANSWER_META : null;
}

// The result card's diary area when the diary failed because Muse
// is unavailable — the line plus a retry (re-runs postDiary with
// the same digests; the caller disables it until a key works).
export const DIARY_NO_ANSWER = "일기는 Muse가 써요. 키를 넣으면 다시 쓸 수 있어요.";
export const DIARY_RETRY_LABEL = "일기 다시 쓰기";

export function diaryNoAnswer(diary) {
  if (!diary || diary.status !== "failed") return null;
  return { line: DIARY_NO_ANSWER, retry: DIARY_RETRY_LABEL };
}

// The report's failed line when Muse could not verify.
export const REPORT_NO_ANSWER = "리포트 검증은 Muse가 해요. 지금은 연결이 안 돼서 하지 못했어요.";

export function reportNoAnswerLine(report) {
  if (!report || report.status !== "failed") return null;
  return REPORT_NO_ANSWER;
}

// Landing "바로 해 보기" captions.
export const LANDING_TRIAL_CAPTION = "무료 체험 1회 · 이후 내 키";
export const LANDING_REPLAY_CAPTION = "키 없이 기록 재생";
export const LANDING_KEY_ROW_LABEL = "내 모델 키로 하기";

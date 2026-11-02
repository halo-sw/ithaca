export function captureJudgeCode() {
  try {
    if (typeof location === "undefined" || !location.search) return;
    const params = new URLSearchParams(location.search);
    const code = params.get("judge");
    if (code) {
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem("ithaca.judge", code);
      } catch (_) { /* ignore */ }
      params.delete("judge");
      const rest = params.toString();
      const hash = location.hash || "";
      const base = location.pathname || "";
      const next = base + (rest ? "?" + rest : "") + hash;
      if (typeof history !== "undefined" && history.replaceState) history.replaceState(null, "", next);
    }
  } catch (_) { /* ignore */ }
}

export function getJudgeCode() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage.getItem("ithaca.judge") || "";
  } catch (_) { /* ignore */ }
  return "";
}

export function judgeHeaders() {
  const code = getJudgeCode();
  return code ? { "x-ithaca-judge": code } : {};
}

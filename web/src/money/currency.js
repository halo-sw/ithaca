// Currency-aware money formatting (26c, pure, no DOM).
//
// fmtMoney(value, currency, { monthly }): KRW renders exactly as
// fmtWon; USD renders whole dollars with en-US grouping ("$4,261",
// monthly "월 $4,261"). Null or non-finite renders "—".

import { fmtWon } from "./format.js";

// English short won for map pins (34a, pure, no DOM). Same scale the
// English cards use: millions / billions with one trimmed decimal
// ("₩260M", "₩10M", "₩1.6B"), thousands as K ("₩600K"), grouped won
// below a thousand. Null or non-finite renders "—".
export function fmtWonEn(won) {
  const v = Number(won);
  if (!Number.isFinite(v)) return "—";
  const neg = v < 0;
  const abs = Math.abs(v);
  const trim1 = (x) => String(Math.round(x * 10) / 10);
  let body;
  if (abs >= 1000000000) body = `₩${trim1(abs / 1000000000)}B`;
  else if (abs >= 1000000) body = `₩${trim1(abs / 1000000)}M`;
  else if (abs >= 1000) body = `₩${Math.round(abs / 1000)}K`;
  else body = `₩${Math.round(abs).toLocaleString("en-US")}`;
  return `${neg ? "−" : ""}${body}`;
}

export function fmtMoney(value, currency = "KRW", { monthly = false } = {}) {
  if (value === null || value === undefined) return "—";
  if (currency === "USD") {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    const body = `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
    return `${v < 0 ? "−" : ""}${monthly ? "월 " : ""}${body}`;
  }
  return fmtWon(value, { monthly });
}

// currencyOf(candidateOrProfile): reads .currency (a string on a
// candidate row, or a profile field { value }). Defaults to "KRW".
export function currencyOf(candidateOrProfile) {
  const c = candidateOrProfile ? candidateOrProfile.currency : null;
  if (typeof c === "string") return c;
  if (c && typeof c.value === "string") return c.value;
  return "KRW";
}

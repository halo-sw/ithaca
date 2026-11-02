// Currency-aware money formatting (26c, pure, no DOM).
//
// fmtMoney(value, currency, { monthly }): KRW renders exactly as
// fmtWon; USD renders whole dollars with en-US grouping ("$4,261",
// monthly "월 $4,261"). Null or non-finite renders "—".

import { fmtWon } from "./format.js";

// English full-digit won for map pins, cards and aria labels (34a, 41i,
// pure, no DOM). Owner rule 2026-11-01: English money is full digits +
// " won" ("117,000,000 won", "960,000 won / 10,000,000 won") — never ₩,
// never K/M/B abbreviations. Null or non-finite renders "—".
export function fmtWonEn(won) {
  const v = Number(won);
  if (!Number.isFinite(v)) return "—";
  const body = `${Math.round(Math.abs(v)).toLocaleString("en-US")} won`;
  return `${v < 0 ? "−" : ""}${body}`;
}

export function fmtMoney(value, currency = "KRW", { monthly = false, lang } = {}) {
  if (value === null || value === undefined) return "—";
  if (currency === "USD") {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    const body = `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
    return `${v < 0 ? "−" : ""}${monthly ? "월 " : ""}${body}`;
  }
  // 41i: English KRW renders through fmtWonEn above (full digits +
  // " won"); Korean output and USD are unchanged.
  if (lang === "en") {
    const en = fmtWonEn(value);
    if (en === "—") return en;
    return monthly ? `monthly ${en}` : en;
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

// One-off purchase costs for 매매 (pure, no UI imports).
//
// Rates checked 2026-11-01 from the official sources named in each source string.

export const ACQUISITION_TAX_SOURCE_KO =
  "지방세법 제11조 제1항 제8호 (시행 2026-01-01, 법률 제21308호)";
export const EDUCATION_TAX_SOURCE_KO = "지방세법 제151조 제1항 제1호";
export const RURAL_TAX_SOURCE_KO = "농어촌특별세법 제5조";
export const BROKERAGE_SOURCE_KO =
  "서울특별시 주택중개보수 등에 관한 조례 제2조 별표1 (시행 2021-12-30, 매매·교환)";

export const SINGLE_HOUSE_NOTE =
  "1주택 기준이에요. 다주택 중과·생애최초 감면은 넣지 않았어요.";
export const BROKERAGE_CAP_NOTE =
  "중개보수는 서울시 조례의 상한이에요. 실제 금액은 중개사와 정하고, 부가세는 따로예요.";
export const EXCLUDED_COSTS_NOTE =
  "등기 비용(국민주택채권·법무사)·인지세·이사비·재산세는 넣지 않았어요.";
export const UNKNOWN_AREA_NOTE =
  "면적을 몰라 농어촌특별세(85㎡ 초과 시 0.2%)는 넣지 않았어요.";

// 매매·교환 중개보수 상한 (서울 조례 별표1). Every area uses this table.
export const BROKERAGE_TABLE = [
  { min_won: 0, max_won_exclusive: 50000000, rate_pct: 0.6, cap_won: 250000 },
  { min_won: 50000000, max_won_exclusive: 200000000, rate_pct: 0.5, cap_won: 800000 },
  { min_won: 200000000, max_won_exclusive: 900000000, rate_pct: 0.4, cap_won: null },
  { min_won: 900000000, max_won_exclusive: 1200000000, rate_pct: 0.5, cap_won: null },
  { min_won: 1200000000, max_won_exclusive: 1500000000, rate_pct: 0.6, cap_won: null },
  { min_won: 1500000000, max_won_exclusive: null, rate_pct: 0.7, cap_won: null },
];

export function brokerageBand(priceWon) {
  const price = Math.max(0, Math.round(Number(priceWon) || 0));
  for (const row of BROKERAGE_TABLE) {
    if (price >= row.min_won && (row.max_won_exclusive == null || price < row.max_won_exclusive)) {
      return row;
    }
  }
  return BROKERAGE_TABLE[BROKERAGE_TABLE.length - 1];
}

export function brokerageCapWon(priceWon) {
  const price = Math.max(0, Math.round(Number(priceWon) || 0));
  const band = brokerageBand(price);
  const raw = Math.round((price * band.rate_pct) / 100);
  if (band.cap_won != null) return Math.min(raw, band.cap_won);
  return raw;
}

// 1주택 유상거래 취득세율 (%). 6억 이하 1%, 9억 초과 3%, 그 사이는
// (price ÷ 1억 × 2/3) − 3, 소수 다섯째 자리에서 반올림 (4 decimals).
export function acquisitionTaxRatePct(priceWon) {
  const price = Math.max(0, Math.round(Number(priceWon) || 0));
  if (price <= 600000000) return 1;
  if (price > 900000000) return 3;
  const raw = (price / 100000000) * (2 / 3) - 3;
  return Math.round(raw * 10000) / 10000;
}

function wonShortLocal(v) {
  const n = Math.max(0, Math.round(Number(v) || 0));
  const eok = Math.floor(n / 100000000);
  const man = Math.round((n - eok * 100000000) / 10000);
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString("ko-KR")}만 원`;
  if (eok > 0) return `${eok}억 원`;
  if (man > 0) return `${man.toLocaleString("ko-KR")}만 원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

function fmtPct(pct) {
  return `${Number(pct)}`;
}

// purchaseCosts({ price_won, area_m2 }) → { items, total_won, notes }
export function purchaseCosts(args = {}) {
  const price = Math.max(0, Math.round(Number(args.price_won) || 0));
  const rawArea = args.area_m2;
  const area =
    rawArea === undefined || rawArea === null || String(rawArea).trim() === ""
      ? NaN
      : Number(rawArea);
  const knownArea = Number.isFinite(area) && area > 0;
  const over85 = knownArea && area > 85;

  const acqRate = acquisitionTaxRatePct(price);
  const acqWon = Math.round((price * acqRate) / 100);
  const eduRate = Math.round(acqRate * 1000) / 10000;
  const eduWon = Math.round(acqWon * 0.1);
  const ruralRate = 0.2;
  const ruralWon = over85 ? Math.round((price * ruralRate) / 100) : 0;
  const band = brokerageBand(price);
  const brokerWon = brokerageCapWon(price);

  const priceShort = `집값 ${wonShortLocal(price)}`;
  const items = [
    {
      key: "acquisition_tax",
      label_ko: "취득세",
      won: acqWon,
      rate_pct: acqRate,
      basis_ko: `${priceShort} × ${fmtPct(acqRate)}%`,
      source_ko: ACQUISITION_TAX_SOURCE_KO,
    },
    {
      key: "education_tax",
      label_ko: "지방교육세",
      won: eduWon,
      rate_pct: eduRate,
      basis_ko: `${priceShort} × ${fmtPct(eduRate)}% (취득세의 10%)`,
      source_ko: EDUCATION_TAX_SOURCE_KO,
    },
  ];
  if (ruralWon > 0) {
    items.push({
      key: "rural_tax",
      label_ko: "농어촌특별세",
      won: ruralWon,
      rate_pct: ruralRate,
      basis_ko: `${priceShort} × ${fmtPct(ruralRate)}% (85㎡ 초과)`,
      source_ko: RURAL_TAX_SOURCE_KO,
    });
  }
  items.push({
    key: "brokerage_cap",
    label_ko: "중개보수 상한",
    won: brokerWon,
    rate_pct: band.rate_pct,
    basis_ko: `${priceShort} × ${fmtPct(band.rate_pct)}% (상한)`,
    source_ko: BROKERAGE_SOURCE_KO,
  });

  const total_won = items.reduce((s, it) => s + it.won, 0);
  const notes = [SINGLE_HOUSE_NOTE, BROKERAGE_CAP_NOTE, EXCLUDED_COSTS_NOTE];
  if (!knownArea) notes.push(UNKNOWN_AREA_NOTE);
  return { items, total_won, notes };
}

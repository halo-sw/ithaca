// Stage 35b: "내가 내는 돈" — once, monthly, left out (SSR, no DOM).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

// .jsx loads dynamically (static imports resolve before the loader).
let React;
let renderToString;
let PurchasePayments;
let ResultSummary;
let tenureCost;
let purchaseCosts;
let monthlyHousingOf;
let fmtWon;
let fmtWonShort;
let fmtWonLump;
let TRADE_COSTS_NOTE;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ PurchasePayments } = await import("../src/ui/money.jsx"));
  ({ ResultSummary } = await import("../src/ui/chat.jsx"));
  ({ tenureCost, TRADE_COSTS_NOTE } = await import("../src/money/tenure.js"));
  ({ purchaseCosts } = await import("../src/money/purchase.js"));
  ({ monthlyHousingOf } = await import("../src/money/monthly.js"));
  ({ fmtWon, fmtWonShort, fmtWonLump } = await import("../src/money/format.js"));
});

const PRICE = 900000000;

const tradeHousing = () => tenureCost({ tenure: "매매", price_won: PRICE,
  cash_won: 300000000, area_m2: 84, loan_rate_pct: 4, loan_years: 30 });

const tradeSel = (housing, maint = -150000, transit = -60000) => ({
  housing, totals_by_category: { maintenance: maint, transit } });

const tradeDoc = (housing) => ({
  default_tenure: { A: "매매", B: "매매" },
  homes: {
    A: { by_tenure: { "매매": tradeSel(housing) } },
    B: { by_tenure: { "매매": tradeSel(housing) } },
  },
});

const cardData = (moneyDoc) => ({ labels: ["A", "B"],
  names: { A: "A집", B: "B집" },
  compare: { days: 30, one_way: null, metrics: [], members: [] }, moneyDoc });

// Rendered Korean won ("2,500만", "66만 8,000", "1,500") back to a number.
const parseWonKo = (t) => {
  let s = String(t).trim();
  let total = 0;
  const eok = s.match(/([\d,]+)억/);
  if (eok) { total += Number(eok[1].replace(/,/g, "")) * 100000000; s = s.slice(s.indexOf("억") + 1); }
  const man = s.match(/([\d,]+)만/);
  if (man) { total += Number(man[1].replace(/,/g, "")) * 10000; s = s.slice(s.indexOf("만") + 1); }
  const cheon = s.match(/([\d,]+)천/);
  if (cheon) { total += Number(cheon[1].replace(/,/g, "")) * 1000; s = s.slice(s.indexOf("천") + 1); }
  const rest = s.match(/([\d,]+)/);
  if (rest) total += Number(rest[1].replace(/,/g, ""));
  return total;
};

describe("35b PurchasePayments", () => {
  it("shows one-off items, totals, monthly and left-out groups", () => {
    const housing = tradeHousing();
    const html = renderToString(React.createElement(PurchasePayments,
      { housing, maintenanceWon: 150000, transitWon: 60000 }));
    const costs = purchaseCosts({ price_won: PRICE, area_m2: 84 });
    assert.ok(html.includes("살 때 한 번에 내는 돈"), "one-off group");
    assert.ok(html.includes("집값"), "price line");
    assert.ok(html.includes(fmtWonLump(PRICE)), "price amount");
    assert.ok(html.includes("취득세"), "acquisition tax");
    assert.ok(html.includes("지방교육세"), "education tax");
    assert.ok(html.includes("중개보수 (상한)"), "brokerage cap label");
    for (const item of costs.items) {
      const label = item.key === "brokerage_cap" ? "중개보수 (상한)" : item.label_ko;
      assert.ok(html.includes(fmtWonLump(item.won)), `${label} amount`);
      assert.ok(html.includes(item.basis_ko), `${label} basis`);
      assert.ok(html.includes(item.source_ko), `${label} source`);
    }
    assert.ok(html.includes(fmtWonLump(PRICE + costs.total_won)), "one-off total");
    assert.ok(html.includes("그중 내 돈"), "own vs loan line");
    assert.ok(html.includes("대출 갚는 돈"), "monthly loan line");
    assert.ok(html.includes("(이자율 4% · 30년 · 매달 같은 금액, 정해 둔 값)"), "loan terms");
    assert.ok(html.includes("관리비"), "maintenance line");
    assert.ok(html.includes("교통비"), "transit line");
    assert.ok(html.includes("넣지 않은 돈"), "left-out group");
    for (const note of costs.notes) {
      assert.ok(html.includes(note), `left-out note: ${note.slice(0, 12)}`);
    }
    assert.ok(html.includes("대출을 받을 수 있는지(LTV·DSR)는 판단하지 않아요."), "LTV line");
  });

  it("매달 total equals monthlyHousingOf for the same doc", () => {
    const doc = tradeDoc(tradeHousing());
    const mh = monthlyHousingOf(doc, "A", 30);
    assert.equal(mh.tenure, "매매");
    const html = renderToString(React.createElement(PurchasePayments,
      { housing: mh.housingDoc, maintenanceWon: mh.maintenanceWon,
        transitWon: mh.transitWon }));
    assert.ok(html.includes(fmtWon(mh.monthly, { monthly: true })),
      `monthly total matches monthlyHousingOf (${mh.monthly})`);
  });
});

describe("35b result card one-off row", () => {
  it("shows 살 때 드는 돈 for a 매매 doc", () => {
    const housing = tradeHousing();
    const html = renderToString(React.createElement(ResultSummary,
      { data: cardData(tradeDoc(housing)) }));
    const b = housing.breakdown;
    assert.ok(html.includes("살 때 드는 돈"), "one-off row label");
    assert.ok(html.includes(fmtWonLump(b.price_won + b.one_off_total_won)), "one-off total");
    assert.ok(html.includes(`내 돈 ${fmtWonLump(b.own_money_won)} · 대출 ${fmtWonLump(b.loan_won)}`),
      "own vs loan note");
  });

  it("shows – for a non-매매 home in a mixed doc", () => {
    const doc = tradeDoc(tradeHousing());
    doc.default_tenure.B = "전세";
    doc.homes.B = { by_tenure: { "전세": {
      housing: { monthly_won: 400000, upfront_won: 180000000 },
      totals_by_category: { maintenance: -20000, transit: -2000 } } } };
    const html = renderToString(React.createElement(ResultSummary,
      { data: cardData(doc) }));
    assert.ok(html.includes("살 때 드는 돈"), "row shown when any home is 매매");
  });

  it("shows no row for an all-전세 doc", () => {
    const sel = (monthly, upfront) => ({ housing: { monthly_won: monthly, upfront_won: upfront },
      totals_by_category: { maintenance: -20000, transit: -3000 } });
    const doc = { default_tenure: { A: "전세", B: "전세" },
      homes: { A: { by_tenure: { "전세": sel(500000, 200000000) } },
        B: { by_tenure: { "전세": sel(400000, 180000000) } } } };
    const html = renderToString(React.createElement(ResultSummary,
      { data: cardData(doc) }));
    assert.ok(html.includes("월 주거비"), "monthly row stays");
    assert.ok(!html.includes("살 때 드는 돈"), "no one-off row");
  });
});

describe("35b2 fmtWonLump", () => {
  it("formats lump sums without 월", () => {
    assert.equal(fmtWonLump(286740000), "2억 8,674만 원");
    assert.equal(fmtWonLump(900000000), "9억 원");
    assert.equal(fmtWonLump(2825000), "282만 5,000 원");
    assert.equal(fmtWonLump(0), "0 원");
  });
});

describe("35b2 result card lump sums", () => {
  it("never reads the 살 때 드는 돈 row as monthly", () => {
    const housing = tradeHousing();
    const html = renderToString(React.createElement(ResultSummary,
      { data: cardData(tradeDoc(housing)) }));
    const row = html.slice(html.indexOf("살 때 드는 돈"), html.indexOf("출퇴근 편도"));
    assert.ok(!row.includes("월"), `one-off row has no 월: ${row.slice(0, 200)}`);
  });

  it("shows 대출 없음 when savings cover the upfront", () => {
    const rich = tenureCost({ tenure: "매매", price_won: PRICE,
      cash_won: 2000000000, area_m2: 84, loan_rate_pct: 4, loan_years: 30 });
    assert.equal(rich.breakdown.loan_won, 0);
    const html = renderToString(React.createElement(ResultSummary,
      { data: cardData(tradeDoc(rich)) }));
    assert.ok(html.includes("대출 없음"), "no-loan note");
  });
});

describe("35b2 PurchasePayments lines", () => {
  const oneOffGroup = (html) =>
    html.slice(html.indexOf("살 때 한 번에 내는 돈"), html.indexOf("매달 내는 돈"));

  it("never reads one-off amounts as monthly", () => {
    const html = renderToString(React.createElement(PurchasePayments,
      { housing: tradeHousing(), maintenanceWon: 150000, transitWon: 60000 }));
    assert.ok(!oneOffGroup(html).includes("월 "), "one-off group has no 월");
  });

  it("hides 교통비 when the commute is on foot", () => {
    const html = renderToString(React.createElement(PurchasePayments,
      { housing: tradeHousing(), maintenanceWon: 150000, transitWon: 0 }));
    assert.ok(!html.includes("교통비"), "no transit row");
  });

  it("reads no loan as no loan", () => {
    const rich = tenureCost({ tenure: "매매", price_won: PRICE,
      cash_won: 2000000000, area_m2: 84, loan_rate_pct: 4, loan_years: 30 });
    const html = renderToString(React.createElement(PurchasePayments,
      { housing: rich, maintenanceWon: 150000, transitWon: 60000 }));
    assert.ok(html.includes("대출 갚는 돈 없음"), "no-loan row");
    assert.ok(html.includes("모은 돈으로 다 낼 수 있어요"), "no-loan note");
    assert.ok(html.includes("모두 내 돈으로 내요"), "all-own line");
    assert.ok(!html.includes("빌리는 돈"), "no borrow line");
  });

  it("monthly 합계 equals the sum of the monthly rows", () => {
    const html = renderToString(React.createElement(PurchasePayments,
      { housing: tradeHousing(), maintenanceWon: 150000, transitWon: 60000 }));
    const monthly = html.slice(html.indexOf("매달 내는 돈"));
    const bodies = [...monthly.matchAll(/월 ([^<]*?) 원/g)].map((m) => m[1]);
    assert.ok(bodies.length >= 3, `monthly amounts rendered (${bodies.length})`);
    const values = bodies.map(parseWonKo);
    const total = values[values.length - 1];
    const rows = values.slice(0, -1);
    assert.equal(total, rows.reduce((a, v) => a + v, 0),
      `합계 ${total} equals rows ${rows.join(" + ")}`);
  });
});

describe("35b pins", () => {
  it("new rules use no ellipsis and no 13px", () => {
    for (const f of ["../src/ui/money.jsx", "../src/ui/chat.jsx"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      assert.ok(!src.includes("text-overflow: ellipsis"), `${f} ellipsis`);
      assert.ok(!src.includes("13px"), `${f} 13px`);
    }
  });

  it("money tab shows TRADE_COSTS_NOTE", () => {
    assert.equal(typeof TRADE_COSTS_NOTE, "string");
    assert.ok(TRADE_COSTS_NOTE.includes("중개보수"), "costs note text");
  });
});

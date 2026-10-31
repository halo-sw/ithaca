// Stage 29L2: the 3D view's chrome fits — toolbar inset, labels
// clamped inside the frame and off people, width-capped counts,
// one-line phone credit, phone timeline, English built in code.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { placeLabels, labelCapForWidth, labelPaintStyle } from "../src/labels3d.js";
import {
  toolsLabelFor, memberEnFor, commuteBreakdownEn, tripStatusEn,
  workplaceLabel, stripCompareLabel, placeNameEn, todayStepEn,
  todayStepNoI18n, homeStatusEn,
} from "../src/ui/scene-chrome.js";
import { familyRowText } from "../src/nowcard.js";
import { activityLabelEn } from "../src/timeline.js";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, "..", "src", "ui", "ui.css"), "utf8");

function box(id, level, x, y, w = 60, h = 22) {
  return { id, level, title: id, x, y, w, h };
}

function insideStage(p, viewW, viewH) {
  const w = p.w ?? 60;
  const h = p.h ?? 22;
  return p.x >= 4 && p.y >= 4 && p.x + w <= viewW - 4 && p.y + h <= viewH - 4;
}

describe("29L2 placeLabels clamps inside the frame", () => {
  it("shifts a near-edge box inside [4, viewW-4] instead of cutting it", () => {
    const placed = placeLabels([box("e1", "poi", 350, 100, 60, 22)], 390, 800, []);
    assert.equal(placed.length, 1);
    assert.equal(placed[0].x, 390 - 60 - 4);
    assert.ok(insideStage(placed[0], 390, 800));
  });

  it("drops a non-always label shifted further than 48px from its anchor", () => {
    const placed = placeLabels([box("e2", "poi", 370, 100, 100, 22)], 390, 800, []);
    assert.equal(placed.length, 0);
  });

  it("never returns a box outside the stage", () => {
    const items = [
      box("a", "always", 380, 780, 60, 22),
      box("b", "poi", -50, 10, 60, 22),
      box("c", "poi", 200, -40, 60, 22),
      box("d", "complex", 360, 400, 80, 22),
    ];
    const placed = placeLabels(items, 390, 800, []);
    for (const p of placed) {
      assert.ok(insideStage(p, 390, 800), `${p.id} outside the stage`);
    }
  });

  it("drops a non-always label under a reserved zone", () => {
    const zone = { left: 100, top: 100, right: 220, bottom: 140 };
    const placed = placeLabels([box("p1", "poi", 120, 110, 80, 22)], 800, 600, [zone]);
    assert.equal(placed.length, 0);
  });
});

describe("29L2 label budget by stage width", () => {
  it("caps counts: 390px -> 6, 800px -> 12, wide -> 40", () => {
    assert.equal(labelCapForWidth(390), 6);
    assert.equal(labelCapForWidth(800), 12);
    assert.equal(labelCapForWidth(1440), 40);
  });

  it("places at most 6 of 20 items on a 390px stage, always-items first", () => {
    const items = [box("home", "always", 10, 10, 40, 22)];
    for (let i = 1; i < 20; i++) {
      items.push(box(`p${i}`, "poi", 10 + (i % 5) * 70, 10 + Math.floor(i / 5) * 30, 40, 22));
    }
    const placed = placeLabels(items, 390, 800, []);
    assert.ok(placed.length <= 6, `got ${placed.length}`);
    assert.ok(placed.some((p) => p.id === "home"), "home first");
  });
});

describe("29L2 short toolbar labels per language", () => {
  it("Korean phone shortens, desktop unchanged", () => {
    assert.equal(toolsLabelFor("동네 전체", { phone: true, lang: "ko" }), "전체");
    assert.equal(toolsLabelFor("집만 밝게 보기", { phone: true, lang: "ko" }), "집만");
    assert.equal(toolsLabelFor("범례", { phone: true, lang: "ko" }), "범례");
    assert.equal(toolsLabelFor("따라가기", { phone: true, lang: "ko" }), "따라가기");
    assert.equal(toolsLabelFor("동네 전체", { phone: false, lang: "ko" }), "동네 전체");
  });

  it("English phone shortens, desktop unchanged", () => {
    assert.equal(toolsLabelFor("Whole area", { phone: true, lang: "en" }), "Area");
    assert.equal(toolsLabelFor("Highlight homes only", { phone: true, lang: "en" }), "Homes");
    assert.equal(toolsLabelFor("Legend", { phone: true, lang: "en" }), "Legend");
    assert.equal(toolsLabelFor("Follow", { phone: true, lang: "en" }), "Follow");
    assert.equal(toolsLabelFor("Whole area", { phone: false, lang: "en" }), "Whole area");
  });
});

describe("29L2 English panel copy built in code", () => {
  it("commute breakdown reads as English", () => {
    assert.equal(
      commuteBreakdownEn({ dir: "home", total: 42, walk: 12, subway: 26, wait: 4 }),
      "Today's commute home: 42 min = 12 min walking + 26 min subway + 4 min waiting");
  });

  it("member chip for 나 is Me", () => {
    assert.equal(memberEnFor("나"), "Me");
    assert.equal(memberEnFor("배우자"), "Your partner");
    assert.equal(memberEnFor("아이"), "Child");
  });

  it("trip status reads as English", () => {
    assert.equal(
      tripStatusEn({ member: "Me", activity: "Commuting", from: "Jamsil", to: "Lake Palace", remainMin: 4 }),
      "Me · Commuting · Jamsil → Lake Palace (4 min walk left)");
  });

  it("timeline rows and legend are capitalised words", () => {
    assert.equal(workplaceLabel("판교", "en", "Pangyo"), "Work (assumed: near Pangyo Stn)");
    assert.equal(workplaceLabel("판교", "ko"), "직장 (가정: 판교역 인근)");
    assert.equal(activityLabelEn("home"), "Home");
    assert.equal(activityLabelEn("walk"), "Walking");
    assert.equal(activityLabelEn("subway"), "Subway");
    assert.equal(activityLabelEn("work"), "Work");
    assert.equal(activityLabelEn("errand"), "Groceries");
    assert.equal(activityLabelEn("park"), "Park");
    assert.equal(activityLabelEn("other"), "Other");
    assert.equal(stripCompareLabel("B", "en"), "B · same time");
    assert.equal(stripCompareLabel("B", "ko"), "B · 같은 시각");
  });
});

describe("29L2 toolbar inset tokens", () => {
  it("ui.css insets .ui-sim13-stage .ui-tools with the spacing token", () => {
    assert.ok(css.includes(".ui-sim13-stage .ui-tools"), "stage toolbar rule exists");
    assert.ok(css.includes("top: var(--ui-s12)"), "top inset uses --ui-s12");
  });
});

describe("29L2c the placed box is the painted box", () => {
  it("a label anchored at (10, 300) with w=200, h=22 paints at its clamped box, no translate", () => {
    // The caller hands placeLabels the real box: x = anchorX - w/2, y = anchorY - h.
    const anchor = { id: "home", level: "always", title: "t",
      x: 10 - 200 / 2, y: 300 - 22, w: 200, h: 22, _sx: 10, _sy: 300, _ox: 0, _oy: 0 };
    const placed = placeLabels([anchor], 1440, 900, []);
    assert.equal(placed.length, 1);
    assert.ok(placed[0].x >= 4, `x=${placed[0].x}`);
    const st = labelPaintStyle(placed[0], { x: placed[0]._ox ?? 0, y: placed[0]._oy ?? 0 });
    assert.equal(st.left, placed[0].x);
    assert.equal(st.top, placed[0].y);
    assert.equal(st.transform, "none");
  });

  it("labelPaintStyle adds the stage-to-wrap offset", () => {
    const st = labelPaintStyle({ x: 4, y: 278 }, { x: 12, y: 8 });
    assert.equal(st.left, 16);
    assert.equal(st.top, 286);
    assert.equal(st.transform, "none");
  });
});

describe("29L2c English strings romanise place names", () => {
  it("status helper reads Jamsil → Lake Palace with no Hangul", () => {
    const s = tripStatusEn({ member: "Me", activity: "Commuting",
      from: "잠실", to: "레이크팰리스", remainMin: 4 });
    assert.ok(s.includes("Jamsil → Lake Palace"), s);
    assert.ok(!/[가-힣]/.test(s), s);
  });

  it("placeNameEn keeps complex English names and romanises stations", () => {
    assert.equal(placeNameEn("레이크팰리스"), "Lake Palace");
    assert.equal(placeNameEn("잠실"), "Jamsil");
    assert.equal(placeNameEn("판교역"), "Pangyo Stn");
    assert.equal(placeNameEn("Lake Palace"), "Lake Palace");
  });

  it("English household row for 배우자 at home starts with Your partner · Home", () => {
    const row = familyRowText({ label: "배우자", labelEn: "Your partner",
      line: "집 · 저녁 시간", lineEn: "Your partner · Home · Evening", fatigue: 23 }, "en");
    assert.ok(row.startsWith("Your partner · Home"), row);
  });

  it("English Today rows read Home and the assumed workplace", () => {
    assert.equal(todayStepEn({ kind: "place", label: "집", home: true }), "Home");
    assert.equal(todayStepEn({ kind: "place", label: "레이크팰리스" }), "Lake Palace");
    assert.equal(todayStepEn({ kind: "place", label: "직장 근무", dest: "판교", destEn: "Pangyo" }),
      "Work (assumed: near Pangyo Stn)");
    assert.equal(todayStepEn({ kind: "walk", label: "잠실역 (걸어서 14분)" }), "잠실역 (걸어서 14분)");
  });

  it("English Today ride rows keep Korean for the translator, outside data-no-i18n", () => {
    const ride = { kind: "ride", label: "2호선 잠실→강남 (9분, 혼잡 91%)" };
    assert.equal(todayStepEn(ride), "2호선 잠실→강남 (9분, 혼잡 91%)");
    assert.equal(todayStepNoI18n(ride), false);
    assert.equal(todayStepNoI18n({ kind: "place", label: "집" }), true);
    assert.equal(todayStepNoI18n({ kind: "place", label: "레이크팰리스" }), true);
  });

  it("29L5 measured/assumed ride rows leave the source word to the badge", () => {
    assert.equal(
      todayStepEn({ kind: "ride", label: "2호선 잠실→강남 (9분, 혼잡 91% 실측)" }),
      "2호선 잠실→강남 (9분, 혼잡 91%)");
    assert.equal(
      todayStepEn({ kind: "ride", label: "신분당선 강남→판교 (17분, 혼잡 70% 가정)" }),
      "신분당선 강남→판교 (17분, 혼잡 70%)");
    const measured = { kind: "ride", label: "2호선 잠실→강남 (9분, 혼잡 91% 실측)",
      congestion: { valuePct: 91, source: "서울교통공사" } };
    assert.equal(todayStepNoI18n(measured), false);
  });

  it("English household row capitalises the activity word", () => {
    assert.equal(homeStatusEn("Your partner", "저녁 시간"), "Your partner · Home · Evening");
    const row = familyRowText({ label: "배우자", labelEn: "Your partner",
      line: "집 · 저녁 시간", lineEn: "Your partner · Home · Evening", fatigue: 23 }, "en");
    assert.equal(row, "Your partner · Home · Evening · Tiredness 23/100");
  });
});

describe("29L5 Today measured ride: badge apart, row text clean", () => {
  let React;
  let renderToString;
  let TodayList;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ TodayList } = await import("../src/ui/app.jsx"));
  });

  function state() {
    return {
      journey: null, journeyLoading: "", journeyView: "auto",
      clock: { minute: 520 },
      routeSteps: { outings: [{ start: 501, end: 600, steps: [
        { kind: "place", label: "레이크팰리스", minute: 501 },
        { kind: "ride", label: "2호선 잠실→강남 (9분, 혼잡 91% 실측)",
          minute: 515, minutes: 9,
          congestion: { valuePct: 91, source: "서울교통공사" } },
      ] }] },
    };
  }

  it("badge is its own element; the row text node carries no source word", () => {
    const html = renderToString(React.createElement(TodayList, { state: state() }));
    const labels = [...html.matchAll(/<span class="ui-today-label"[^>]*>(.*?)<\/span>/g)]
      .map((m) => m[1]);
    const ride = labels.find((t) => t.includes("잠실→강남"));
    assert.ok(ride, "measured ride row renders");
    assert.ok(!/실측|측정|가정값/.test(ride), `row text carries no source word: ${ride}`);
    assert.ok(html.includes(">실측<"), "source badge renders as its own element");
  });
});

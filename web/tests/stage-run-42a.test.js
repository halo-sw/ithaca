// Stage 42a — map tags follow zoom, the right stage shows the 30-day
// run, the after-run chips always answer (pure, node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let M;
let Chat;
let simMomentUrl;
let viewTransform;
before(async () => {
  M = await import("../src/chatmap.js");
  Chat = await import("../src/ui/chat.jsx");
  ({ simMomentUrl } = await import("../src/chat/urls.js"));
  ({ viewTransform } = await import("../src/basemap.js"));
});

const W = 640;
const H = 420;
const PAD = 24;

function focus42() {
  return [
    { lon: 127.1112, lat: 37.3944 },
    { lon: 127.1102, lat: 37.3949 },
    { lon: 127.1142, lat: 37.3999 },
  ];
}

function specs42() {
  return [
    { id: "work", kind: "work", lon: 127.1112, lat: 37.3944, w: 120, h: 26, rank: 0 },
    { id: "h-a", kind: "pill", lon: 127.1102, lat: 37.3949,
      w: 72, h: 70, rank: 1, pin: { n: 1, picked: true, letter: "A" } },
    { id: "h-b", kind: "pill", lon: 127.1142, lat: 37.3999,
      w: 72, h: 70, rank: 1, pin: { n: 2, picked: true, letter: "B" } },
  ];
}

function anchorOf(laid, id) {
  const l = laid.find((x) => x && x.id === id);
  assert.ok(l, `laid has ${id}`);
  return [l.x, l.y];
}

describe("42a layout follows zoom/pan", () => {
  it("zoom 2 + pan: every anchor equals toXYz(pin) within 1px", () => {
    const focus = focus42();
    const specs = specs42();
    const base = M.layoutChatStage({ focus, specs, W, H, pad: PAD,
      obstacles: [], tenure: "jeonse", lang: "ko", compact: false });
    const T = viewTransform({ zoom: 2, panX: 30, panY: -20, cx: W / 2, cy: H / 2 });
    const toXYz = (lon, lat) => T.apply(base.fit.toXY(lon, lat));
    const baseFit = M.fitMapView(focus, W, H, M.MAP_FIT_MARGIN, PAD);
    const zoomed = M.layoutChatStage({ focus, specs, W, H, pad: PAD,
      obstacles: [], tenure: "jeonse", lang: "ko", compact: false,
      allowRefit: false, fitOverride: M.zoomStageFit(baseFit, T) });
    const byId = new Map(specs.map((s) => [s.id, s]));
    for (const l of zoomed.laid) {
      if (l.kind === "group") {
        for (const mb of l.members || []) {
          const s = byId.get(mb.id);
          if (!s) continue;
          const [ex, ey] = zoomed.fit.toXY(s.lon, s.lat);
          assert.ok(Math.abs(mb.x - ex) <= 1 && Math.abs(mb.y - ey) <= 1,
            `member ${mb.id} on its pin: got ${mb.x},${mb.y} want ${ex},${ey}`);
        }
        continue;
      }
      const s = byId.get(l.id);
      if (!s || s.kind === "work" && false) continue;
      const [ex, ey] = zoomed.fit.toXY(s.lon, s.lat);
      assert.ok(Math.abs(l.x - ex) <= 1 && Math.abs(l.y - ey) <= 1,
        `${l.id} anchor on its pin: got ${l.x},${l.y} want ${ex},${ey}`);
      if (l.leader) {
        const [px, py] = toXYz(s.lon, s.lat);
        assert.ok(Math.abs(l.x - px) <= 1 && Math.abs(l.y - py) <= 1,
          `${l.id} leader ends at the zoomed pin`);
      }
    }
    // The work marker rides the same projection.
    {
      const s = byId.get("work");
      const [ax, ay] = anchorOf(zoomed.laid, "work");
      const [ex, ey] = zoomed.fit.toXY(s.lon, s.lat);
      assert.ok(Math.abs(ax - ex) <= 1 && Math.abs(ay - ey) <= 1,
        `work marker on its pin: got ${ax},${ay} want ${ex},${ey}`);
    }
  });

  it("zoom 1 override is identical to today", () => {
    const focus = focus42();
    const specs = specs42();
    const base = M.layoutChatStage({ focus, specs, W, H, pad: PAD,
      obstacles: [], tenure: "jeonse", lang: "ko", compact: false });
    const T = viewTransform({ zoom: 1, panX: 0, panY: 0, cx: W / 2, cy: H / 2 });
    const baseFit = M.fitMapView(focus, W, H, M.MAP_FIT_MARGIN, PAD);
    const same = M.layoutChatStage({ focus, specs, W, H, pad: PAD,
      obstacles: [], tenure: "jeonse", lang: "ko", compact: false,
      fitOverride: M.zoomStageFit(baseFit, T) });
    // Identity zoom threads one float round-trip through the view
    // transform, so boxes agree to 1e-6 px (production passes no
    // override at zoom 1, which is exactly today's path).
    assert.equal(same.laid.length, base.laid.length);
    for (let i = 0; i < base.laid.length; i++) {
      for (const k of ["x", "y", "w", "h"]) {
        assert.ok(Math.abs((same.laid[i][k] || 0) - (base.laid[i][k] || 0)) <= 1e-6,
          `laid[${i}].${k} identical`);
      }
      for (const k of ["x", "y", "w", "h"]) {
        assert.ok(Math.abs((same.laid[i].box[k] || 0) - (base.laid[i].box[k] || 0)) <= 1e-6,
          `laid[${i}].box.${k} identical`);
      }
    }
  });
});

function doneThread() {
  const moneyDoc = {
    default_tenure: { A: "전세", B: "전세" },
    homes: {
      A: { by_tenure: { 전세: { housing: { monthly_won: 1000000 },
        totals_by_category: { maintenance: 100000, transit: 50000 } } } },
      B: { by_tenure: { 전세: { housing: { monthly_won: 2000000 },
        totals_by_category: { maintenance: 200000, transit: 100000 } } } },
    },
  };
  const sim = { role: "assistant", kind: "simulation",
    data: { status: "done", customId: "run-42a",
      labels: ["A", "B"],
      names: { A: "역삼", B: "서현" },
      moments: [{ label: "A", day: 3, t: "08:20" }, { label: "B", day: 3, t: "08:25" }],
      compare: { days: 30, one_way: { A: 37, B: 42 } },
      moneyDoc, noCommute: false } };
  const cands = [
    { id: "h-a", name: "역삼", scene: "area-a" },
    { id: "h-b", name: "서현", scene: "area-b" },
  ];
  return { messages: [sim], picks: ["h-a", "h-b"], candidates: cands, moneyDoc };
}

describe("42a stage line follows the run", () => {
  it("running reads A·B 30일 살아 보는 중, done returns the normal line", () => {
    const profile = { workplaces: { value: [{ text: "판교" }] } };
    const candidatesData = { result: { candidates: [{ id: "h-a" }, { id: "h-b" }] } };
    assert.equal(Chat.stageContextLine(profile, candidatesData,
      { running: true, labels: ["A", "B"] }), "A·B 30일 살아 보는 중");
    const normal = Chat.stageContextLine(profile, candidatesData, { running: false });
    assert.equal(normal, Chat.stageContextLine(profile, candidatesData));
    assert.ok(normal.includes("후보 2곳"));
  });

  it("runStageOf tracks running vs done", () => {
    const running = [{ kind: "simulation", data: { status: "running" } }];
    assert.deepEqual(Chat.runStageOf(running, ["h-a", "h-b"]),
      { running: true, labels: ["A", "B"] });
    const { messages } = doneThread();
    assert.deepEqual(Chat.runStageOf(messages, ["h-a", "h-b"]), { running: false });
  });
});

describe("42a run done auto-opens the A commute replay", () => {
  it("wide opens A 출근길 with the commute URL; narrow opens nothing", () => {
    const { messages, picks, candidates } = doneThread();
    const auto = Chat.autoRunScene({ messages, picks, candidates, narrow: false });
    assert.ok(auto, "auto scene");
    assert.equal(auto.title, "A 출근길");
    assert.equal(auto.url, simMomentUrl({ custom: "run-42a", home: "A",
      day: 3, t: "08:20", follow: 1, embed: true }));
    assert.equal(Chat.autoRunScene({ messages, picks, candidates, narrow: true }), null);
    assert.equal(Chat.autoRunScene({ messages: [], picks, candidates }), null);
  });
});

describe("42a after-run chips answer without Muse", () => {
  for (const text of ["출근길 보여 줘", "Show the commute"]) {
    it(`${text}: commute scene + minutes line`, () => {
      const { messages, picks, candidates } = doneThread();
      const r = Chat.afterRunChipReply(text, { messages, picks, candidates });
      assert.ok(r, "chip handled");
      assert.deepEqual(r.scene, { panel: "commute", home: "A" });
      assert.ok(r.line && r.line.includes("37분") && r.line.includes("42분"),
        `minutes line: ${r.line}`);
    });
  }
  for (const text of ["동네 걸어 보기", "Walk the neighborhood"]) {
    it(`${text}: tour scene + line`, () => {
      const { messages, picks, candidates } = doneThread();
      const r = Chat.afterRunChipReply(text, { messages, picks, candidates });
      assert.ok(r, "chip handled");
      assert.deepEqual(r.scene, { panel: "tour", home: "A" });
      assert.ok(r.line && r.line.length > 0, "non-empty line");
      assert.ok(r.line.includes("역삼"), `names the home: ${r.line}`);
    });
  }
  for (const text of ["한 달에 얼마 들어?", "How much a month?"]) {
    it(`${text}: money tab + monthly totals`, () => {
      const { messages, picks, candidates } = doneThread();
      const r = Chat.afterRunChipReply(text, { messages, picks, candidates });
      assert.ok(r, "chip handled");
      assert.equal(r.tab, "money");
      assert.ok(r.line && r.line.startsWith("월 주거비는"), `monthly line: ${r.line}`);
    });
  }
  it("no run asks to run first", () => {
    for (const text of ["출근길 보여 줘", "동네 걸어 보기", "한 달에 얼마 들어?"]) {
      const r = Chat.afterRunChipReply(text, { messages: [], picks: [], candidates: [] });
      assert.ok(r && r.line.includes("먼저 두 집을"), `${text}: ${r && r.line}`);
    }
  });
  it("tour without 3D data says so", () => {
    const { messages, picks } = doneThread();
    const r = Chat.afterRunChipReply("동네 걸어 보기",
      { messages, picks, candidates: [{ id: "h-a", name: "역삼" }] });
    assert.equal(r.line, "이 집은 아직 3D 동네 자료가 없어요.");
  });
  it("unknown text falls to localNoAnswerLine", () => {
    const { messages, picks, candidates } = doneThread();
    assert.equal(Chat.afterRunChipReply("내일 날씨 어때?", { messages, picks, candidates }), null);
    const line = Chat.localNoAnswerLine("내일 날씨 어때?");
    assert.ok(line && line.length > 0, "fallback line answers");
  });
});

describe("42a reportUnlocked", () => {
  const sim = (report) => [{ kind: "simulation", data: report === undefined ? {} : { report } }];
  it("failed unlocks, checking and unconfirmed handoff stay locked", () => {
    assert.equal(Chat.reportUnlocked(sim({ status: "failed" })), true);
    assert.equal(Chat.reportUnlocked(sim({ status: "checking", attempts: [] })), false);
    assert.equal(Chat.reportUnlocked(sim({ status: "handoff" })), false);
  });
});

function towerThread() {
  const { messages, picks, candidates } = doneThread();
  const sim = { ...messages[0],
    data: { ...messages[0].data,
      names: { A: "판교 효성 해링턴 타워", B: "백궁 동양파라곤" } } };
  return { messages: [sim], picks, candidates };
}

describe("42a2 chip lines: particles, one 월, no 자세히 bubble, English", () => {
  it("topicParticle: open → 는, closed → 은, digit/Latin/bracket → none", () => {
    assert.equal(Chat.topicParticle("해링턴 타워"), "는");
    assert.equal(Chat.topicParticle("동양파라곤"), "은");
    assert.equal(Chat.topicParticle("푸르지오시티"), "는");
    assert.equal(Chat.topicParticle("래미안"), "은");
    assert.equal(Chat.topicParticle("더샵 101"), "");
    assert.equal(Chat.topicParticle("Pangyo Prugio"), "");
    assert.equal(Chat.topicParticle("래미안)"), "");
    assert.equal(Chat.conjParticle("해링턴 타워"), "와");
    assert.equal(Chat.conjParticle("동양파라곤"), "과");
  });

  it("diaryFallbackLine: 타워는 / 파라곤은, never 타워은 / 파라곤는", () => {
    const line = Chat.diaryFallbackLine({ A: 7, B: 7 },
      { A: "판교 효성 해링턴 타워", B: "백궁 동양파라곤" });
    assert.ok(line.includes("해링턴 타워는"), line);
    assert.ok(line.includes("동양파라곤은"), line);
    assert.ok(!line.includes("타워은") && !line.includes("파라곤는"), line);
  });

  it("commute chip line: 타워는 / 파라곤은, never 타워은 / 파라곤는", () => {
    const { messages, picks, candidates } = towerThread();
    const r = Chat.afterRunChipReply("출근길 보여 줘", { messages, picks, candidates });
    assert.ok(r && r.line.includes("해링턴 타워는"), r && r.line);
    assert.ok(r.line.includes("동양파라곤은"), r.line);
    assert.ok(!r.line.includes("타워은") && !r.line.includes("파라곤는"), r.line);
  });

  it("digit-ending names use the no-particle A {name}: form", () => {
    const line = Chat.diaryFallbackLine({ A: 7, B: 7 }, { A: "더샵 101", B: "자이" });
    assert.ok(line.includes("A 더샵 101: 출근 편도 평균 7분"), line);
    assert.ok(!line.includes("101은") && !line.includes("101는"), line);
  });

  it("money line: 월 주거비는 head, exactly one 월, no 합계", () => {
    const { messages, picks, candidates } = doneThread();
    const r = Chat.afterRunChipReply("한 달에 얼마 들어?", { messages, picks, candidates });
    assert.ok(r.line.startsWith("월 주거비는"), r.line);
    assert.ok(!r.line.includes("월 월") && !r.line.includes("합계"), r.line);
    assert.ok(r.line.includes("A 역삼 115만 원") && r.line.includes("B 서현 230만 원"), r.line);
  });

  it("한 달에 얼마 들어?: turn has the money line only, no 자세히-only bubble", () => {
    const { messages, picks, candidates } = doneThread();
    const r = Chat.afterRunChipReply("한 달에 얼마 들어?", { messages, picks, candidates });
    const msgs = Chat.afterRunChipTurn(r);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].content, r.line);
    assert.ok(msgs.every((m) => m.content !== "자세히"), "no detail-only bubble");
  });

  it("english: every chip line has no Hangul for Korean names", () => {
    const { messages, picks, candidates } = towerThread();
    for (const text of ["Show the commute", "Walk the neighborhood", "How much a month?"]) {
      const r = Chat.afterRunChipReply(text, { messages, picks, candidates, lang: "en" });
      assert.ok(r && r.line, `${text} answers`);
      assert.ok(!/[가-힣]/.test(r.line), `${text}: ${r.line}`);
    }
    assert.ok(Chat.afterRunChipReply("Show the commute",
      { messages, picks, candidates, lang: "en" }).line.startsWith("Average one-way commute:"));
    const tour = Chat.afterRunChipReply("Walk the neighborhood",
      { messages, picks, candidates, lang: "en" });
    assert.ok(tour.line.startsWith("Opened A ") && tour.line.endsWith("on the right."), tour.line);
    const money = Chat.afterRunChipReply("How much a month?",
      { messages, picks, candidates, lang: "en" });
    assert.ok(money.line.startsWith("Monthly housing cost:"), money.line);
  });

  it("english: no run and money-tab-only lines have no Hangul", () => {
    for (const text of ["Show the commute", "Walk the neighborhood", "How much a month?"]) {
      const r = Chat.afterRunChipReply(text,
        { messages: [], picks: [], candidates: [], lang: "en" });
      assert.equal(r.line, "First save two homes and run the 30-day stay.");
    }
    const noMoney = [{ role: "assistant", kind: "simulation", data: { status: "done",
      customId: "run-x", labels: ["A", "B"], names: { A: "역삼", B: "서현" },
      moments: [], compare: { days: 30 } } }];
    const { picks, candidates } = doneThread();
    const r = Chat.afterRunChipReply("How much a month?",
      { messages: noMoney, picks, candidates, lang: "en" });
    assert.equal(r.line, "See the Money tab for the details.");
  });

  it("english: no-commute run line has no Hangul", () => {
    const { picks, candidates } = doneThread();
    const noComm = [{ role: "assistant", kind: "simulation", data: { status: "done",
      customId: "run-x", labels: ["A", "B"], names: { A: "역삼", B: "서현" },
      moments: [], compare: { days: 30 }, noCommute: true } }];
    const r = Chat.afterRunChipReply("Show the commute",
      { messages: noComm, picks, candidates, lang: "en" });
    assert.ok(r && !/[가-힣]/.test(r.line) && r.line.includes("no commute"), r && r.line);
  });

  it("english running stage line: Living 30 days in A·B", () => {
    const profile = { workplaces: { value: [{ text: "판교" }] } };
    const candidatesData = { result: { candidates: [{ id: "h-a" }, { id: "h-b" }] } };
    assert.equal(Chat.stageContextLine(profile, candidatesData,
      { running: true, labels: ["A", "B"] }, "en"), "Living 30 days in A·B");
  });
});

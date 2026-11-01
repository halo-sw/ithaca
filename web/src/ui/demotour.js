// Guided demo tour ("3분 둘러보기", pure step machine, no React).
//
// ?tour=demo starts a scripted, skippable playlist for the video and for
// first-time users. Each step is one caption line plus URL params; the
// tour bar auto-advances on fixed per-step seconds (deterministic timing
// for screen recording — page loads add on top). The agent step uses a
// recorded reply (real numbers from the demo build) when no key is
// present, always labelled 기록된 답변.
//
// Step times are engine-verified (demo-two-homes, 1일차): A walks
// home→송파나루, rides 송파나루→판교 32.2분
// (9호선 → 8호선 → 수인·분당선 → 경강선, 석촌·복정·이매 환승 포함, 추정);
// B walks home→미금, rides 미금→판교 6.6분 (신분당선, 추정).

import { appUrl, appUrlWith } from "../paths.js";

export const DEMO_TOUR_STEPS = [
  { id: "persona", caption: "누구의 한 달인지 상담에서 고릅니다",
    secs: 8, params: { agent: "1" } },
  { id: "commute-walk", caption: "홈 A 올림픽카운티에서 걸어서 송파나루역까지 — 6분",
    secs: 10, params: { home: "A", day: "1", t: "08:30", follow: "1" } },
  { id: "ride", caption: "송파나루에서 세 번 갈아타 판교까지 — 32분",
    secs: 12, params: { home: "A", day: "1", t: "08:40", follow: "1" } },
  { id: "arrive", caption: "판교 도착 — 칸이 얼마나 찼는지 확인합니다",
    secs: 8, params: { home: "A", day: "1", t: "09:08", follow: "1" } },
  { id: "home-b", caption: "홈 B 분당 엠코 헤리츠에서 걸어서 미금역까지 — 2분",
    secs: 10, params: { home: "B", day: "1", t: "08:28", follow: "1" } },
  { id: "money", caption: "생활비 — 매매로 사면 매달 집에 드는 돈",
    secs: 10, params: { home: "A", tab: "money" } },
  { id: "jeonse", caption: "살 때 한 번에 내는 돈 — 오피스텔은 취득세 4%",
    secs: 10, params: { home: "A", tab: "money" } },
  { id: "listing", caption: "매물 붙여넣기 — 예시 글로 확인해 보기",
    secs: 12, params: { home: "A", tab: "listings", fill: "example" } },
  { id: "public", caption: "공공임대 — 직장 근처 공고 찾기",
    secs: 10, params: { home: "A", tab: "listings", sub: "public" } },
  { id: "agent", caption: "상담 — B로 바꾸면 어떻게 달라질까요?",
    secs: 14, params: { home: "A", agent: "1", ask: "switch" } },
  { id: "share", caption: "결과 공유 — 그림으로 저장하고 인쇄하기",
    secs: 10, params: { home: "A", share: "1" } },
];

export const DEMO_TOUR_TOTAL_SECS = DEMO_TOUR_STEPS.reduce((a, s) => a + s.secs, 0);

// Params the tour owns (stripped on skip / rebuilt per step).
const TOUR_KEYS = ["tour", "step", "agent", "ask", "share", "fill", "sub",
  "home", "day", "t", "follow", "tab", "play"];

export function tourStepFromSearch(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
  if (q.get("tour") !== "demo") return null;
  const raw = Number.parseInt(q.get("step") || "0", 10);
  const index = Number.isFinite(raw)
    ? Math.min(DEMO_TOUR_STEPS.length - 1, Math.max(0, raw)) : 0;
  return { index, step: DEMO_TOUR_STEPS[index] };
}

// URL for step `index`, keeping scenario/mode and dropping stale tour keys.
export function tourStepUrlWith(base, index, search) {
  const q = search instanceof URLSearchParams
    ? new URLSearchParams(search.toString()) : new URLSearchParams(search || "");
  for (const k of TOUR_KEYS) q.delete(k);
  q.set("tour", "demo");
  q.set("step", String(index));
  const step = DEMO_TOUR_STEPS[Math.min(DEMO_TOUR_STEPS.length - 1, Math.max(0, index))];
  for (const [k, v] of Object.entries(step.params)) q.set(k, v);
  return appUrlWith(base, q.toString());
}

export function tourStepUrl(index, search) {
  const q = search instanceof URLSearchParams
    ? new URLSearchParams(search.toString()) : new URLSearchParams(search || "");
  for (const k of TOUR_KEYS) q.delete(k);
  q.set("tour", "demo");
  q.set("step", String(index));
  const step = DEMO_TOUR_STEPS[Math.min(DEMO_TOUR_STEPS.length - 1, Math.max(0, index))];
  for (const [k, v] of Object.entries(step.params)) q.set(k, v);
  return appUrl(q.toString());
}

export function tourSkipUrlWith(base, search) {
  const q = search instanceof URLSearchParams
    ? new URLSearchParams(search.toString()) : new URLSearchParams(search || "");
  for (const k of TOUR_KEYS) q.delete(k);
  return appUrlWith(base, q.toString());
}

export function tourSkipUrl(search) {
  const q = search instanceof URLSearchParams
    ? new URLSearchParams(search.toString()) : new URLSearchParams(search || "");
  for (const k of TOUR_KEYS) q.delete(k);
  return appUrl(q.toString());
}

// Recorded agent replies for the tour (no key present). Numbers are the
// real build values (demo-two-homes; 12a example search below); UI
// labels them 기록된 답변.
export const RECORDED_AGENT_REPLIES = {
  profile_search: {
    q: "판교로 출근하는 맞벌이 부부, 연봉 6천+5천, 모은 돈 2억, 7억 이하로 50㎡ 이상 집을 사고 싶어",
    tools: [
      { name: "extract_profile", ok: true, summary: "프로필 읽기(2개 물어봄)", ms: 3 },
      { name: "find_homes", ok: true, summary: "집 후보 6곳(정렬: 동네별)", ms: 61 },
    ],
    a: [
      "예시로 찾아봤어요 (매매 7억 이하 50㎡ 이상, 2,698곳 중 6곳, 동네별).",
      "동네별로 한 곳씩 6곳을 골랐어요 (정자·수서·산성·압구정·응봉·한양대).",
      "백궁 동양파라곤(오피스텔·분당, 50㎡): 중간 5.7억, 1건. 정자 도보 3.1분, 정자 → 판교 총 7.2분(추정). 3D로 살아 보기 가능.",
      "수서현대벤쳐빌(오피스텔·강남, 50㎡): 중간 3.7억, 3건. 수서 도보 1.9분, 수서 → 판교 총 23.8분(추정, 이매 환승). 3D로 살아 보기 가능.",
      "산성역 근처 연립·다세대 (84-0)(연립·다세대·수정, 50㎡): 중간 3.2억, 1건. 산성 도보 8.2분, 산성 → 판교 총 30.9분(추정, 모란·이매 환승). 3D로 살아 보기 가능.",
      "다누림빌(연립·다세대·강남, 60㎡): 중간 4.8억, 1건. 압구정 도보 7.3분, 압구정 → 판교 총 37분(추정, 신사 환승). 3D로 살아 보기 가능.",
      "신우아트빌(연립·다세대·성동, 70㎡): 중간 5.9억, 1건. 응봉 도보 3.5분, 응봉 → 판교 총 41.9분(추정, 옥수·신사 환승). 3D로 살아 보기 가능.",
      "서울숲 더샵(오피스텔·성동, 60㎡): 중간 6.4억, 1건. 한양대 도보 12.4분, 한양대 → 판교 총 55.7분(추정, 잠실·복정·이매 환승). 3D로 살아 보기 가능.",
      "타는 시간은 운행시간표·추정으로 채웠어요 (대기 시간 제외). 2곳을 고르시면 30일 살아 보기를 실행해 드려요.",
    ].join("\n"),
  },
  switch: {
    q: "B로 바꾸면 어떻게 달라져?",
    tools: [{ name: "compare", ok: true, summary: "비교(12개 지표)", ms: 41 }],
    a: [
      "B 분당 엠코 헤리츠로 바꾸면 이렇게 달라져요 (올림픽카운티 기준).",
      "30일 동안 걸은 시간: A 12시간 44분 → B 4시간 59분.",
      "매매로 사면 매달 집에 드는 돈: A 208만 원 → B 199만 원.",
      "집값과 생활비를 내고 남는 돈: A 약 420만 원 → B 약 430만 원.",
      "하루 평균 피곤한 정도 (쉬는 시간 포함): A 8.3 → B 1.3.",
      "어느 쪽이 나은지는 고객님이 정하세요. 내 기준 탭에서 비중을 정해 보세요.",
    ].join("\n"),
  },
};

export function recordedReplyFor(ask) {
  return RECORDED_AGENT_REPLIES[ask] || null;
}

// Stage 29L2 scene chrome helpers (pure, no DOM, no React): short
// toolbar labels for phones, per-language member / status / commute /
// timeline strings. English strings are built here in code — never
// word-by-word through the glossary — and render inside data-no-i18n
// nodes. Korean output is byte-identical to the old inline strings.

import { romanizeName } from "../i18n/romanize.js";

export function toolsLabelFor(label, { phone = false, lang = "ko" } = {}) {
  if (!phone) return label;
  if (lang === "en") {
    if (label === "Highlight homes only") return "Homes";
    if (label === "Whole area") return "Area";
    return label;
  }
  if (label === "집만 밝게 보기") return "집만";
  if (label === "동네 전체") return "전체";
  return label;
}

// English member-chip / panel-headline words from the Korean member
// label (memberLabelFor output). Explicit customer names pass through.
const MEMBER_EN = {
  "나": "Me",
  "배우자": "Your partner",
  "아이": "Child",
  "부모": "Parent",
  "형제자매": "Sibling",
  "동거인": "Housemate",
  "자유 시점": "Free camera",
};

export function memberEnFor(koLabel) {
  const s = String(koLabel || "");
  if (MEMBER_EN[s]) return MEMBER_EN[s];
  let m = s.match(/^함께 사는 사람\s*(\d+)$/);
  if (m) return `Housemate ${m[1]}`;
  m = s.match(/^구성원\s*(\d+)$/);
  if (m) return `Member ${m[1]}`;
  return s;
}

// "오늘 퇴근 42분 = 걷기 12분 + 지하철 26분 + 기다림 4분" in English:
// "Today's commute home: 42 min = 12 min walking + 26 min subway +
/// 4 min waiting". Parts keep the Korean order (walk, bike, subway,
// wait); zero parts are left out.
export function commuteBreakdownEn({ dir = "home", total, walk = 0, bike = 0, subway = 0, wait = 0 }) {
  const parts = [];
  if (walk > 0) parts.push(`${walk} min walking`);
  if (bike > 0) parts.push(`${bike} min biking`);
  if (subway > 0) parts.push(`${subway} min subway`);
  if (wait > 0) parts.push(`${wait} min waiting`);
  const where = dir === "work" ? "work" : "home";
  return `Today's commute ${where}: ${total} min = ${parts.join(" + ")}`;
}

// Trip status: "Me · Commuting · Jamsil → Lake Palace (4 min walk
// left)". The Korean twin is "출근 중 · 잠실 → 레이크팰리스 (걸어서
// 4분 남음)" (nowcard.js).
// Named places with an English name keep it (complexes first);
// everything else romanises through the shared helper, so English
// strings built in code never carry Hangul.
const PLACE_EN = {
  "레이크팰리스": "Lake Palace",
};

const HAS_HANGUL = /[㐀-䶿가-힣]/;

export function placeNameEn(name) {
  const s = String(name == null ? "" : name).trim();
  if (!s || !HAS_HANGUL.test(s)) return s;
  if (Object.hasOwn(PLACE_EN, s)) return PLACE_EN[s];
  return s.split(/(\s+)/).map((w) => {
    if (!w || /^\s+$/.test(w) || !HAS_HANGUL.test(w)) return w;
    if (Object.hasOwn(PLACE_EN, w)) return PLACE_EN[w];
    return romanizeName(w);
  }).join("");
}
export function tripStatusEn({ member, activity = "Commuting", from, to, remainMin, bike = false }) {
  const move = bike ? "bike ride" : "walk";
  const tail = remainMin <= 0 ? "(arriving soon)" : `(${remainMin} min ${move} left)`;
  return `${member} · ${activity} · ${placeNameEn(from)} → ${placeNameEn(to)} ${tail}`;
}

const HOME_NOTE_EN = {
  "새벽 시간": "Early morning",
  "아침 시간": "Morning",
  "낮 시간": "Midday",
  "저녁 시간": "Evening",
  "밤 시간": "Night",
};

export function homeStatusEn(member = "Me", noteKo = "아침 시간") {
  return `${member} · Home · ${HOME_NOTE_EN[noteKo] || noteKo}`;
}

// Timeline / scenario workplace row: Korean "직장 (가정: 판교역
// 인근)", English "Work (assumed: near Pangyo Stn)". destEn is the
// already-English station-area name when known.
export function workplaceLabel(dest, lang = "ko", destEn = null) {
  if (lang === "en") return `Work (assumed: near ${destEn || dest} Stn)`;
  return `직장 (가정: ${dest}역 인근)`;
}

// "B home · 같은 시각" under the compare strip.
export function stripCompareLabel(home, lang = "ko") {
  if (lang === "en") return `${home} · same time`;
  return `${home} · 같은 시각`;
}

// Today-list rows in English. Only the home row (exactly "집"),
// the workplace row and place rows with a known English name are
// built in code (romanizeName sees bare place names only); every
// other row (rides, transfers, walks with minutes, crowding,
// shops) keeps its Korean text for the DOM translator / en-table
// patterns, exactly as before 29L2. Rows built in code render
// inside data-no-i18n nodes (see todayStepNoI18n); Korean output
// keeps the engine text.
export function todayStepEn(step) {
  const s = step || {};
  const raw = String(s.label ?? "");
  const label = raw.trim();
  if (label === "집") return "Home";
  if (s.kind === "place" && /근무\s*$/.test(label)) {
    if (s.dest) return workplaceLabel(s.dest, "en", s.destEn || romanizeName(s.dest));
    return "Work";
  }
  // 29L5: ride rows carry the source word in the engine text
  // ("혼잡 91% 실측"); the badge beside the row already says it, so
  // the row text drops it — the translator must not print it twice.
  if (s.kind !== "place") return raw.replace(/ (실측|측정|가정값|가정)\)$/, ")");
  const bare = label.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*\d+(?:\.\d+)?분\s*$/, "").trim();
  return placeNameEn(bare || label);
}

// True only when todayStepEn built English in code (the row's node
// takes data-no-i18n); false leaves the Korean text for the DOM
// translator.
export function todayStepNoI18n(step) {
  const s = step || {};
  // 29L5: non-place rows keep Korean for the translator (the source
  // badge is its own node); only place rows built in code opt out.
  if (s.kind !== "place") return false;
  return todayStepEn(s) !== String(s.label ?? "");
}

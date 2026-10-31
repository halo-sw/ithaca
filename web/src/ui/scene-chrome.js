// Stage 29L2 scene chrome helpers (pure, no DOM, no React): short
// toolbar labels for phones, per-language member / status / commute /
// timeline strings. English strings are built here in code — never
// word-by-word through the glossary — and render inside data-no-i18n
// nodes. Korean output is byte-identical to the old inline strings.

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
export function tripStatusEn({ member, activity = "Commuting", from, to, remainMin, bike = false }) {
  const move = bike ? "bike ride" : "walk";
  const tail = remainMin <= 0 ? "(arriving soon)" : `(${remainMin} min ${move} left)`;
  return `${member} · ${activity} · ${from} → ${to} ${tail}`;
}

const HOME_NOTE_EN = {
  "새벽 시간": "early morning",
  "아침 시간": "morning",
  "낮 시간": "midday",
  "저녁 시간": "evening",
  "밤 시간": "night",
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

// Region / kind name words (client-safe, no keys): customer words
// ("판교", "빌라") -> region ids / home kinds. Shared by the server
// search tools and the browser chat engine (12b, B).

// Customer region words -> region ids (regions.json ids).
export const REGION_NAME_ALIASES = {
  seongdong: ["성동", "성동구", "seongdong"],
  "songpa-gu": ["송파", "송파구", "songpa-gu", "songpa", "잠실", "jamsil"],
  gangnam: ["강남", "강남구", "gangnam"],
  gangdong: ["강동", "강동구", "gangdong", "천호", "cheonho"],
  bundang: ["분당", "분당구", "bundang", "서현", "seohyeon", "수내", "sunae"],
  sujeong: ["수정", "수정구", "sujeong"],
  jungwon: ["중원", "중원구", "jungwon", "모란", "moran"],
  suji: ["수지", "수지구", "suji"],
  wirye: ["위례", "wirye", "남위례"],
  pangyo: ["판교", "pangyo"],
  jeongja: ["정자", "jeongja"],
  migeum: ["미금", "migeum"],
  "us-menlo": ["menlo park", "멘로파크", "멘로 파크", "east palo alto",
    "이스트 팔로알토", "belle haven", "벨헤이븐",
    "meta", "메타", "facebook", "hacker way"],
  "us-st-san-francisco": ["san francisco", "샌프란시스코", "sf"],
  "us-st-belmont": ["belmont", "벨몬트"],
  "us-st-san-carlos": ["san carlos", "샌카를로스", "san carlos stn"],
  "us-st-redwood-city": ["redwood city", "레드우드시티"],
  "us-st-palo-alto": ["palo alto", "팔로알토"],
  "us-st-mountain-view": ["mountain view", "마운틴뷰"],
  "us-st-sunnyvale": ["sunnyvale", "서니베일"],
};

// 29N2a: the US Caltrain-corridor area names for cards and results
// (English + Korean). us-menlo homes sit in Belle Haven.
export const US_AREA_LABELS = {
  "us-menlo": { en: "Belle Haven", ko: "벨헤이븐" },
  "us-st-san-francisco": { en: "San Francisco", ko: "샌프란시스코" },
  "us-st-belmont": { en: "Belmont", ko: "벨몬트" },
  "us-st-san-carlos": { en: "San Carlos", ko: "샌카를로스" },
  "us-st-redwood-city": { en: "Redwood City", ko: "레드우드시티" },
  "us-st-palo-alto": { en: "Palo Alto", ko: "팔로알토" },
  "us-st-mountain-view": { en: "Mountain View", ko: "마운틴뷰" },
  "us-st-sunnyvale": { en: "Sunnyvale", ko: "서니베일" },
};

export function usAreaLabel(region, lang) {
  const e = US_AREA_LABELS[String(region || "")];
  if (!e) return null;
  return lang === "en" ? e.en : e.ko;
}

const PLACE_TO_REGION = { pangyo: "bundang", jeongja: "bundang", migeum: "bundang" };

export function regionsForNames(names) {
  const out = [];
  for (const raw of names || []) {
    const word = String(raw || "").trim();
    if (!word) continue;
    // Latin words match case-insensitively ("Menlo Park" hits
    // "menlo park"); Korean words compare exactly as before.
    const want = word.toLowerCase();
    for (const [id, aliases] of Object.entries(REGION_NAME_ALIASES)) {
      const hit = id.toLowerCase() === want
        || (aliases || []).some((a) => String(a).toLowerCase() === want);
      if (hit) {
        const region = PLACE_TO_REGION[id] || id;
        if (!out.includes(region)) out.push(region);
      }
    }
  }
  return out;
}

const KIND_ALIASES = {
  "아파트": "아파트", "apt": "아파트",
  "연립": "연립·다세대", "다세대": "연립·다세대", "빌라": "연립·다세대",
  "연립·다세대": "연립·다세대", "rowhouse": "연립·다세대",
  "오피스텔": "오피스텔", "오피": "오피스텔", "officetel": "오피스텔",
};

export function kindForName(name) {
  if (!name) return null;
  return KIND_ALIASES[String(name).trim()] || null;
}

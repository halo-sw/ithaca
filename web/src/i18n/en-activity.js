// 29N3g: generic activity / place words for English digest and record
// rows sent to Muse. Content only — the report/diary digest builders
// (verify/compare.js, diary/digest.js) and the consult tool/guards
// rows use it when lang === "en", so Muse reads English words instead
// of romanising Korean ones (jangbogi, gongwon). Exact whole-label
// matches only; real proper names (Main Street Market, 선릉역) never
// match a key and pass through untouched. Korean requests skip it.
export const ACTIVITY_EN = {
  "장보기": "groceries",
  "공원": "park",
  "산책": "walk",
  "공원/귀가": "park or home",
  "편의점": "convenience store",
  "마트": "supermarket",
  "대형마트": "supermarket",
  "병원": "clinic",
  "병원·약국": "clinic",
  "진료": "clinic visit",
  "역 출구": "station exit",
  "주말 계획": "weekend plan",
  "저녁에 집": "evening at home",
};

export function activityEn(ko) {
  return Object.hasOwn(ACTIVITY_EN, ko) ? ACTIVITY_EN[ko] : ko;
}

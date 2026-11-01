// English for Korean home and place names (39b). Two tables:
//
// LOANWORDS: Hangul spellings of English words and brand names that are
// common in apartment / villa / officetel names. A name is split into the
// longest known pieces left to right; the pieces in between are romanized
// as one word each. 에스케이허브진 → SK Hub Jin, 거성스타힐 → Geoseong Star
// Hill, 하우징허브 → Housing Hub, 강동현대 → Gangdong Hyundai.
//
// PLACE_TERMS: generic words at the end of a place name, translated the way
// Korean public signs and road-name addresses write them in English: the
// proper part romanized as one word, then the translated term.
// 구암어린이공원 → Guam Children's Park, 강남구청 → Gangnam-gu Office.
// `join: "hyphen"` attaches the term to the proper part with a hyphen and
// keeps it lower-case in the romanized part (-gu, -dong).
//
// Orchestrator-written i18n data. Never put a Korean word here unless its
// English spelling is the one used on signs or by the brand itself.

export const LOANWORDS = {
  // brands
  "에스케이": "SK", "엘지": "LG", "케이티": "KT", "지에스": "GS",
  "삼성": "Samsung", "현대": "Hyundai", "대우": "Daewoo", "쌍용": "Ssangyong",
  "롯데": "Lotte", "한신": "Hanshin", "금호": "Kumho", "두산": "Doosan",
  "효성": "Hyosung", "대림": "Daelim", "동아": "Dong-A", "우성": "Woosung",
  "한양": "Hanyang", "동양": "Dongyang", "선경": "Sunkyung", "극동": "Kukdong",
  "벽산": "Byucksan", "코오롱": "Kolon", "한진": "Hanjin", "한화": "Hanwha",
  "포스코": "POSCO", "태영": "Taeyoung", "신동아": "Shindonga", "주공": "Jugong",
  "래미안": "Raemian", "푸르지오": "Prugio", "힐스테이트": "Hillstate",
  "아이파크": "I-Park", "자이": "Xi", "더샵": "The Sharp", "센트레빌": "Centreville",
  "e편한세상": "e-Pyunhansesang", "편한세상": "Pyunhansesang", "아크로": "Acro",
  "쉐르빌": "Cherville", "롯데캐슬": "Lotte Castle", "꿈에그린": "Kkumegreen",
  // English words
  "아파트": "Apt.", "오피스텔": "Officetel", "빌딩": "Building", "빌리지": "Village",
  "빌라트": "Villart", "빌라": "Villa", "빌": "Ville", "하우스": "House",
  "하우징": "Housing", "하이츠": "Heights", "맨션": "Mansion", "타운": "Town",
  "홈타운": "Hometown", "타워": "Tower", "캐슬": "Castle", "팰리스": "Palace",
  "펠리스": "Palace", "파크": "Park", "파크뷰": "Park View", "뷰": "View",
  "리버뷰": "River View", "리버": "River", "레이크": "Lake", "힐스": "Hills",
  "힐": "Hill", "힐링": "Healing", "스카이": "Sky", "스타일": "Style", "스타": "Star",
  "시티": "City", "씨티": "City", "센트럴": "Central",
  "월드": "World", "그린": "Green", "블루": "Blue", "골든": "Golden", "골드": "Gold",
  "로얄": "Royal", "로열": "Royal", "노블": "Noble", "프라임": "Prime",
  "베스트": "Best", "퍼스트": "First", "플러스": "Plus", "드림": "Dream",
  "해피": "Happy", "휴먼": "Human", "샤인": "Shine", "트리": "Tree", "파인": "Pine",
  "포레스트": "Forest", "포레": "Fore", "에코": "Eco", "랜드": "Land",
  "카운티": "County", "그랜드": "Grand", "그랑": "Grand", "올림픽": "Olympic",
  "스위트": "Suite", "스테이트": "State", "스테이": "Stay", "레지던스": "Residence",
  "테라스": "Terrace", "클래식": "Classic", "블레스": "Bless", "그레이스": "Grace",
  "스톤": "Stone", "베어": "Bear", "에이스": "Ace", "에비뉴": "Avenue", "애비뉴": "Avenue",
  "허브": "Hub", "아트": "Art", "리치": "Rich", "하임": "Heim", "하이": "Hi",
  "라움": "Raum", "리움": "Rium", "뷰티": "Beauty", "가든": "Garden",
  "코아": "Core", "프라자": "Plaza", "플라자": "Plaza", "센터": "Center",
  "스퀘어": "Square", "타워팰리스": "Tower Palace", "트윈": "Twin",
  "원룸": "One-room", "투룸": "Two-room", "하우스텔": "Houstel",
  // Korean type word inside a name (청운주택 → Cheongun House); the
  // longer 다세대주택 / 연립주택 / 단독주택 match first as type words.
  "주택": "House",
};

export const PLACE_TERMS = [
  // longest first; the first matching suffix wins
  { ko: "여자고등학교", en: "Girls' High School" },
  { ko: "행정복지센터", en: "Administrative Welfare Center" },
  { ko: "어린이공원", en: "Children's Park" },
  { ko: "근린공원", en: "Neighborhood Park" },
  { ko: "체육공원", en: "Sports Park" },
  { ko: "초등학교", en: "Elementary School" },
  { ko: "고등학교", en: "High School" },
  { ko: "주민센터", en: "Community Service Center" },
  { ko: "어린이집", en: "Daycare Center" },
  { ko: "중학교", en: "Middle School" },
  { ko: "대학교", en: "University" },
  { ko: "유치원", en: "Kindergarten" },
  { ko: "도서관", en: "Library" },
  { ko: "우체국", en: "Post Office" },
  { ko: "경찰서", en: "Police Station" },
  { ko: "파출소", en: "Police Box" },
  { ko: "지구대", en: "Police Precinct" },
  { ko: "소방서", en: "Fire Station" },
  { ko: "보건소", en: "Public Health Center" },
  { ko: "경로당", en: "Senior Center" },
  { ko: "체육관", en: "Gymnasium" },
  { ko: "수영장", en: "Swimming Pool" },
  { ko: "놀이터", en: "Playground" },
  { ko: "편의점", en: "Convenience Store" },
  { ko: "시청", en: "City Hall" },
  { ko: "구청", en: "gu Office", join: "hyphen" },
  { ko: "병원", en: "Hospital" },
  { ko: "의원", en: "Clinic" },
  { ko: "시장", en: "Market" },
  { ko: "교회", en: "Church" },
  { ko: "성당", en: "Catholic Church" },
  { ko: "공원", en: "Park" },
  { ko: "마트", en: "Mart" },
];

// Home kinds as the generated lot-number names use them (homes.js
// displayNameFor): "산성역 근처 연립·다세대 (84-0)" → "Row house near
// Sanseong Stn (84-0)", "대치동 연립·다세대 (242-4)" → "Daechi-dong row
// house (242-4)". Capitalized form; lower-case it after a place name.
export const HOME_KINDS = {
  "아파트": "Apartment",
  "연립·다세대": "Row house",
  "오피스텔": "Officetel",
  "단독·다가구": "House",
};

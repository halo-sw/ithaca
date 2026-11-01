// Revised Romanization of Hangul, syllable by syllable (pure, no DOM).
import { STATION_EN } from "./en-stations.js";
import { LOANWORDS, PLACE_TERMS } from "./en-loanwords.js";

const LEADS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp",
  "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const MEDIALS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye",
  "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu",
  "eu", "ui", "i"];
const TAILS = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k",
  "m", "l", "l", "t", "p", "l", "m", "p", "p", "t", "t", "ng",
  "t", "t", "k", "t", "p", "t"];

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

// Final jamo (jongseong index) that romanize to "k" / "p".
const K_FINALS = new Set([1, 2, 24]); // ㄱ ㄲ ㅋ
const P_FINALS = new Set([17, 26]); // ㅂ ㅍ
// Final jamo of the ㄷ group, read "n" before a nasal (ㄴ/ㅁ).
const D_NASAL_FINALS = new Set([7, 19, 20, 22, 23, 25, 27]); // ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ ㅎ

function isNasalLead(lead) {
  return lead === 2 || lead === 6; // ㄴ ㅁ
}

function decompose(ch) {
  const code = ch.codePointAt(0);
  if (code == null || code < HANGUL_START || code > HANGUL_END) return null;
  const s = code - HANGUL_START;
  return {
    lead: Math.floor(s / (21 * 28)),
    medial: Math.floor((s % (21 * 28)) / 28),
    tail: s % 28,
  };
}

function romanizeWord(word) {
  const syls = [];
  for (const ch of word) {
    const d = decompose(ch);
    if (!d) {
      syls.push({ ch });
      continue;
    }
    syls.push({ lead: d.lead, medial: d.medial, tail: d.tail,
      init: LEADS[d.lead], fin: TAILS[d.tail] });
  }
  for (let i = 1; i < syls.length; i++) {
    const prev = syls[i - 1];
    const cur = syls[i];
    if (prev.tail == null || cur.lead == null) continue;
    if ((prev.tail === 4 && cur.lead === 5) || // ㄴ + ㄹ
      (prev.tail === 8 && cur.lead === 2) || // ㄹ + ㄴ
      (prev.tail === 8 && cur.lead === 5)) { // ㄹ + ㄹ
      prev.fin = "l";
      cur.init = "l";
    } else if (K_FINALS.has(prev.tail) && isNasalLead(cur.lead)) {
      prev.fin = "ng"; // final ㄱ before ㄴ/ㅁ → ng
    } else if (P_FINALS.has(prev.tail) && isNasalLead(cur.lead)) {
      prev.fin = "m"; // final ㅂ before ㄴ/ㅁ → m
    } else if (D_NASAL_FINALS.has(prev.tail) && isNasalLead(cur.lead)) {
      prev.fin = "n"; // final ㄷ-group before ㄴ/ㅁ → n
    } else if (cur.lead === 5 && (prev.tail === 21 || prev.tail === 16)) {
      cur.init = "n"; // final ㅇ/ㅁ before ㄹ → ㄹ reads n (종로 → jongno)
    } else if (cur.lead === 5 && K_FINALS.has(prev.tail)) {
      prev.fin = "ng"; // final ㄱ before ㄹ → ng + n (독립 → dongnip)
      cur.init = "n";
    } else if (cur.lead === 5 && P_FINALS.has(prev.tail)) {
      prev.fin = "m"; // final ㅂ before ㄹ → m + n (협력 → hyeomnyeok)
      cur.init = "n";
    }
  }
  return syls.map((s) => (s.ch != null
    ? s.ch
    : s.init + MEDIALS[s.medial] + s.fin)).join("");
}

// Well-known station / neighbourhood names the rules alone get wrong.
export const NAMES = {
  강남: "Gangnam",
  잠실: "Jamsil",
  판교: "Pangyo",
  선릉: "Seolleung",
  성수: "Seongsu",
  송파: "Songpa",
  분당: "Bundang",
  수지: "Suji",
  위례: "Wirye",
  성남: "Seongnam",
  강동: "Gangdong",
  정자: "Jeongja",
  서현: "Seohyeon",
  삼성: "Samseong",
  역삼: "Yeoksam",
  신논현: "Sinnonhyeon",
  석촌: "Seokchon",
  문정: "Munjeong",
  가락: "Garak",
  오금: "Ogeum",
  건대입구: "Konkuk Univ.",
  왕십리: "Wangsimni",
  서울숲: "Seoul Forest",
  뚝섬: "Ttukseom",
  미금: "Migeum",
  동천: "Dongcheon",
  수내: "Sunae",
  야탑: "Yatap",
  모란: "Moran",
  복정: "Bokjeong",
  장지: "Jangji",
};

const SEG_SEP = /(→|·|\/|-)/g;

function romanizeSegment(seg) {
  if (Object.hasOwn(NAMES, seg)) return NAMES[seg];
  const r = romanizeWord(seg);
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function romanize(text) {
  return String(text).split(" ").map((w) => w.split(SEG_SEP).map((part) =>
    (part === "" || part === "→" || part === "·" || part === "/" || part === "-")
      ? part
      : romanizeSegment(part)).join("")).join(" ");
}

// 29L6: trailing building-type parts read as English words, longest
// match first, so loanwords stop gluing into one romanised blob
// (대하빌딩 → Daeha Building). Repeated once for 팰리스+빌라 style
// doubles. NAMES and the 역/동/구/시 suffixes still win.
const TYPE_EN = [
  ["다세대주택", "Multi-family house"],
  ["연립주택", "Row house"],
  ["단독주택", "House"],
  ["주상복합", "Mixed-use"],
  ["오피스텔", "Officetel"],
  ["아파트", "Apt"],
  ["팰리스", "Palace"],
  ["하우스", "House"],
  ["빌딩", "Building"],
  ["빌라", "Villa"],
  ["맨션", "Mansion"],
  ["타워", "Tower"],
  ["캐슬", "Castle"],
  ["파크", "Park"],
  ["힐스", "Hills"],
  ["빌", "Vill"],
];

// 39c: left-to-right longest match over LOANWORDS, then TYPE_EN as a
// fallback list. A run between matches is romanized as one word.
// A one-syllable loanword (빌/뷰/힐) matches only at the end of the
// word, after at least 2 other syllables.
const LOAN_KEYS = Object.keys(LOANWORDS).sort((a, b) => b.length - a.length);
const TYPE_KEYS = TYPE_EN.map(([ko]) => ko).sort((a, b) => b.length - a.length);
const TYPE_MAP = Object.fromEntries(TYPE_EN);

function keyAt(keys, w, i) {
  for (const k of keys) {
    if (k.length === 1 && (i + 1 !== w.length || i < 2)) continue;
    if (w.startsWith(k, i)) return k;
  }
  return null;
}

function romanizeRun(buf) {
  if (Object.hasOwn(NAMES, buf)) return NAMES[buf];
  if (buf.length > 1 && buf.endsWith("동")) {
    const base = buf.slice(0, -1);
    return (Object.hasOwn(NAMES, base) ? NAMES[base] : romanize(base)) + "-dong";
  }
  return romanize(buf);
}

function namePieces(w) {
  const out = [];
  let buf = "";
  const flush = () => {
    if (!buf) return;
    out.push(romanizeRun(buf));
    buf = "";
  };
  for (let i = 0; i < w.length;) {
    const lk = keyAt(LOAN_KEYS, w, i);
    if (lk) { flush(); out.push(LOANWORDS[lk]); i += lk.length; continue; }
    const tk = keyAt(TYPE_KEYS, w, i);
    if (tk) { flush(); out.push(TYPE_MAP[tk]); i += tk.length; continue; }
    buf += w[i];
    i++;
  }
  flush();
  return out;
}

export function romanizeName(name) {
  return String(name).trim().split(/\s+/).filter(Boolean).map((w) => {
    if (Object.hasOwn(NAMES, w)) return NAMES[w];
    // Station: the word minus a trailing 역 is an official English name.
    const bare = (w.endsWith("역") && w.length > 1) ? w.slice(0, -1) : w;
    const isStn = bare !== w;
    if (Object.hasOwn(STATION_EN, bare)) return STATION_EN[bare] + (isStn ? " Stn" : "");
    // Place term: the stem goes through the name pieces below.
    for (const t of PLACE_TERMS) {
      if (w.length > t.ko.length && w.endsWith(t.ko)) {
        const stemEn = namePieces(w.slice(0, w.length - t.ko.length)).join(" ");
        return t.join === "hyphen" ? `${stemEn}-${t.en}` : `${stemEn} ${t.en}`;
      }
    }
    // 역/동/구/시 suffixes read plainly — never as loanwords, so
    // 삼성동 stays Samseong-dong, never Samsung-dong.
    const last = w.charAt(w.length - 1);
    if ((last === "역" || last === "동" || last === "구" || last === "시") && w.length > 1) {
      const base = w.slice(0, -1);
      const head = Object.hasOwn(NAMES, base) ? NAMES[base] : romanize(base);
      const suffix = last === "역" ? " Stn" : last === "동" ? "-dong" : last === "구" ? "-gu" : "-si";
      return head + suffix;
    }
    // Name pieces: loanwords and type words read as English.
    return namePieces(w).join(" ");
  }).join(" ");
}

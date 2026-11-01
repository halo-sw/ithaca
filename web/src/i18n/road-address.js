import { romanize } from "./romanize.js";

function capLower(s) {
  const t = String(s).replace(/\s+/g, "");
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function guEn(guPart) {
  const base = guPart.slice(0, -1);
  return `${capLower(romanize(base))}-gu`;
}

function siEn(siPart) {
  const base = siPart.slice(0, -1);
  return `${capLower(romanize(base))}-si`;
}

export function roadAddressEn(address) {
  if (!address || typeof address !== "object") return "";
  const { road, sigungu } = address;
  if (typeof road !== "string" || !road.trim()) return "";
  const m = road.trim().match(/^(.+?)(대로|로|길)(?:(\d+)(번길|길))?\s+(\d+(?:-\d+)?)$/);
  if (!m) return "";
  const [, base, kind, midNum, midKind, bldg] = m;
  const suffix = kind === "대로" ? "-daero" : kind === "로" ? "-ro" : "-gil";
  let roadEn = `${capLower(romanize(base))}${suffix}`;
  if (midNum) {
    roadEn += midKind === "번길" ? ` ${midNum}beon-gil` : ` ${midNum}-gil`;
  }
  const head = `${bldg} ${roadEn}`;
  let tail = "";
  if (typeof sigungu === "string" && sigungu.trim()) {
    const parts = sigungu.trim().split(/\s+/);
    const isSeoul = parts.some((p) => p.startsWith("서울"));
    const gu = parts.find((p) => p.endsWith("구"));
    const si = parts.find((p) => p.endsWith("시"));
    if (isSeoul) {
      if (gu) tail = `${guEn(gu)}, Seoul`;
    } else if (si && gu) {
      tail = `${guEn(gu)}, ${siEn(si)}`;
    } else if (si) {
      tail = `${siEn(si)}`;
    } else if (gu) {
      tail = `${guEn(gu)}`;
    }
  }
  return tail ? `${head}, ${tail}` : head;
}

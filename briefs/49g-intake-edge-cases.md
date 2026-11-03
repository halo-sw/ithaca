# 49g: Fix concrete English intake errors from public recording
Read AGENTS.md. Product code and tests are your work. No git/build/full suite/search/subagents. Implement only web/src/profile.js plus one regression test web/tests/intake-49g.test.js. Exact local snippets below.

Observed public bugs:
1. `Our annual salaries are 50 and 45 million won.` becomes [45000000], losing first salary. Likewise 80 and 70. Parse shared magnitude lists only under salary/income anchor; preserve literal substring evidence and ordering. Never consume house budget/savings, dollars, or unrelated bare counts. Existing fully qualified salary lists must stay valid.
2. `Both parents work onsite Monday through Friday with zero remote days.` yields officeDays=0 and removes both real commutes. Negated remote/zero remote/no WFH must not imply full remote. Explicit five onsite days can stay legacy null (default 5) but must not become 0. Existing full-remote and 1–4-day hybrid rules must remain. Do not turn a member-specific remote clause into a whole-household assertion.
3. `Use a 45-minute one-way commute limit.` is ignored. Support bounded minutes/minutes hyphen form with explicit commute/limit cue. Never treat a listing floor/age/day count as commute.

Test actual full intake including members, salaries, cash and budget, plus no-WFH English + Korean negations (재택 안 해요/재택 없음), genuine fully remote, hybrid2, fully qualified salaries and ambiguous/no-anchor numbers. Use extract_profile exported API (empty current); no parser-mirroring unit tests. Verify scenario generation retains work when officeDays is not 0 if available in existing helpers. Run only new test plus households-38e/39a and Korean/English profile regression files if needed; compact output. Max2 fixes then stop.

Do not modify running recordings or generated data.

## web/src/profile.js:118-181
```js
118: // English money words (24b): 300M, 300 M, 300m won, 300 million,
119: // ₩300M, KRW 300M, 1.5B, 40K, ₩40,000,000, 40,000,000 won.
120: // A bare comma number counts only with a ₩/KRW/won marker; a bare
121: // plain number ("300") is never money.
122: export function parseEnglishMoney(chunk) {
123:   const m = /^(?:(₩|KRW)\s*)?([\d,]+(?:\.\d+)?)\s*(M|B|K|millions?|billions?)?\s*(won)?$/i
124:     .exec(String(chunk || "").trim());
125:   if (!m) return null;
126:   const hasPrefix = !!m[1];
127:   const mag = (m[3] || "").toLowerCase();
128:   const hasWon = !!m[4];
129:   if (!hasPrefix && !mag && !hasWon) return null;
130:   const num = Number(m[2].replace(/,/g, ""));
131:   if (!Number.isFinite(num) || num <= 0) return null;
132:   let mult = 1;
133:   if (mag === "k") mult = 1000;
134:   else if (mag === "m" || mag === "million" || mag === "millions") mult = 1000000;
135:   else if (mag === "b" || mag === "billion" || mag === "billions") mult = 1000000000;
136:   else if (!hasPrefix && !hasWon) return null;
137:   return Math.round(num * mult);
138: }
139: 
140: // Parse one dollar chunk to whole dollars: "$4,000" -> 4000,
141: // "$4.5k" -> 4500, "4,000 dollars" / "4000 USD" / "US$4,000" ->
142: // 4000, "4천 달러" -> 4000, "월 4000달러" -> 4000. Bare digits are
143: // dollars as said (never 만원).
144: function parseDollarChunk(chunk) {
145:   const s = String(chunk || "");
146:   const cheon = s.match(/([\d,]+(?:\.\d+)?)\s*천/);
147:   if (cheon) {
148:     const n = Number(cheon[1].replace(/,/g, ""));
149:     return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
150:   }
151:   const num = s.match(/[\d,]+(?:\.\d+)?/);
152:   if (!num) return null;
153:   const n = Number(num[0].replace(/,/g, ""));
154:   if (!Number.isFinite(n) || n <= 0) return null;
155:   const after = s.slice(s.indexOf(num[0]) + num[0].length);
156:   const mult = /^[ \t]*[kK]\b/.test(after) ? 1000 : 1;
157:   return Math.round(n * mult);
158: }
159: 
160: // Find money expressions with their evidence spans. Returns
161: // [{won, evidence, currency}] in text order; currency is "USD" for
162: // dollar amounts (the key stays `won` for schema reuse — the unit is
163: // dollars) and "KRW" otherwise. A dollar amount is never read as won.
164: function findMoney(text) {
165:   const src = String(text || "");
166:   const out = [];
167:   const hits = [];
168:   const dollarRe = /US\$\s*[\d,]+(?:\.\d+)?[kK]?\b|\$\s*[\d,]+(?:\.\d+)?[kK]?\b|\b\d[\d,]*(?:\.\d+)?\s*[kK]\s*(?:dollars?|USD)\b|\b\d[\d,]*(?:\.\d+)?\s*(?:dollars?|USD)\b|\b\d[\d,]*\s*천\s*달러|월\s*\d[\d,]*\s*달러|\b\d[\d,]*\s*달러/gi;
169:   const koRe = /\d[\d,]*\s*억(?:\s*\d[\d,]*\s*(?:천|만))?|\d[\d,]*\s*천(?:\s*만)?|\d[\d,]*\s*만\s*원?/g;
170:   const enRe = /(?:₩\s*|KRW\s*)\d[\d,]*(?:\.\d+)?\s*(?:[MBK]\b|millions?\b|billions?\b)?(?:\s*won\b)?|\d[\d,]*(?:\.\d+)?\s*(?:[MBK]\b|millions?\b|billions?\b)(?:\s*won\b)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*won\b/gi;
171:   let m;
172:   const dollarSpans = [];
173:   while ((m = dollarRe.exec(src)) !== null) {
174:     const amount = parseDollarChunk(m[0]);
175:     if (amount !== null) {
176:       hits.push({ index: m.index, evidence: m[0], kind: "dollar", amount });
177:       dollarSpans.push([m.index, m.index + m[0].length]);
178:     }
179:   }
180:   while ((m = koRe.exec(src)) !== null) {
181:     hits.push({ index: m.index, evidence: m[0], kind: "ko" });
```

## web/src/profile.js:368-406
```js
368: // 38e: office days per week (Korean first, then English, word-bounded).
369: // N = 1..4; full-remote words read 0; N = 5 (or no cue) reads null.
370: function findOfficeDays(text) {
371:   const src = String(text || "");
372:   const enNum = { one: 1, two: 2, three: 3, four: 4 };
373:   const koNum = { 한: 1, 두: 2, 세: 3, 네: 4 };
374:   const numOf = (raw) => {
375:     if (/^\d$/.test(raw)) return Number(raw);
376:     const hit = enNum[String(raw).toLowerCase()] ?? koNum[raw];
377:     return hit === undefined ? null : hit;
378:   };
379:   // 39a: a dated match always beats the remote words below.
380:   const cands = [
381:     /주\s*(\d)\s*일\s*출근/.exec(src),
382:     /주\s*(\d)\s*회\s*출근/.exec(src),
383:     /일주일에\s*(\d)\s*번\s*출근/.exec(src),
384:     /일주일에\s*(한|두|세|네)\s*번\s*출근/.exec(src),
385:     /(\d)\s*days?\s*a\s*week\s*in\s*the\s*office/i.exec(src),
386:     /\bin\s*office\s*(\d)\s*days?/i.exec(src),
387:     /\bhybrid\s*(\d)\s*days?/i.exec(src),
388:   ];
389:   if (/출근/.test(src)) cands.push(/주\s*(\d)\s*일/.exec(src));
390:   if (/(office|commute|go in|work in)/i.test(src)) {
391:     cands.push(/(\d|one|two|three|four)\s*days?\s*(?:a|per)\s*week/i.exec(src));
392:   }
393:   let sawDated = false;
394:   for (const m of cands) {
395:     if (!m) continue;
396:     sawDated = true;
397:     const n = numOf(m[1]);
398:     if (n !== null && n >= 1 && n <= 4) return { value: n, evidence: m[0] };
399:   }
400:   if (sawDated) return null;
401:   const remoteKo = /(완전 재택|재택근무|풀재택|재택)/.exec(src);
402:   if (remoteKo) return { value: 0, evidence: remoteKo[0] };
403:   const remoteEn = /(work from home|fully remote|\bWFH\b|\bremote\b)/i.exec(src);
404:   if (remoteEn) return { value: 0, evidence: remoteEn[0] };
405:   return null;
406: }
```

## web/src/profile.js:808-901
```js
808:       }
809:       from = hit + 1;
810:     }
811:     if (idx < 0 || dist > window) continue;
812:     // After-anchor beats before-anchor at any distance.
813:     let tier = idx >= end ? 0 : 1;
814:     if (boundedBefore && idx < at) {
815:       const between = text.slice(idx + money.evidence.length, at);
816:       if (between.length <= 6 && /(이하|까지|안쪽|미만)/.test(between)) tier = -1;
817:     }
818:     const key = tier * 10000 + dist;
819:     if (key < bestDist) {
820:       bestDist = key;
821:       best = money;
822:     }
823:   }
824:   return best ? { ...best, anchor: m[0] } : null;
825: }
826: 
827: // 36i: a list of amounts after one salary anchor reads as one amount
828: // per member, in order ("연봉은 6천, 5천", "salaries are ₩60M and
829: // ₩50M", "₩60M and ₩50M a year"). Amounts joined only by short
830: // separators (,, ·, /, and, &, 이랑, 하고, 과/와) chain together; all
831: // of them are claimed, so none becomes the price, deposit or cap.
832: const SALARY_LIST_SEP = /^(?:\s*(?:,|·|・|\/|&|and|or|이랑|하고|과|와|만원|원)\s*)+$/i;
833: const SALARY_ANCHORS = [/연봉|월급|세전|급여/,
834:   /(?<!-)(?:salaries|salary|earn|make|income)(?!-)/i,
835:   /\b(?:a year|per year|annual(?:ly)?)\b/i];
836: // 41l: money tied to a savings cue is cash only, never salary —
837: // in both languages. A chain element counts as tied when a savings
838: // word stands just before it (particle/space in between) or just
839: // after it (a unit word or comma in between).
840: const CASH_TIE_WORD = `(?:모은\\s*돈|저축|자기자본|자기\\s*자본|현금|보유|수중|마련|종잣돈|savings|saved|cash|in the bank)`;
841: function cashTiedBefore(src, pos) {
842:   const before = src.slice(Math.max(0, pos - 12), pos);
843:   return new RegExp(`${CASH_TIE_WORD}[\\s은는이가을를의,·]*$`, "i").test(before);
844: }
845: function cashTiedAfter(src, end) {
846:   const after = src.slice(end, end + 12);
847:   const m = new RegExp(`^[\\s,·만원won]*(${CASH_TIE_WORD})`, "i").exec(after);
848:   if (!m) return false;
849:   // The cue belongs to a later amount ("현금 2억") — not to this one.
850:   const ahead = after.slice(m[0].length, m[0].length + 14);
851:   if (/\d/.test(ahead)) return false;
852:   return true;
853: }
854: function salaryListAfterAnchor(text, monies) {
855:   const src = String(text || "");
856:   let anchor = null;
857:   for (const re of SALARY_ANCHORS) {
858:     const m = re.exec(src);
859:     if (m && (!anchor || m.index < anchor.index)) anchor = m;
860:   }
861:   if (!anchor) return null;
862:   const at = anchor.index;
863:   const end = at + anchor[0].length;
864:   const occ = [];
865:   let cursor = 0;
866:   for (const money of monies) {
867:     const pos = src.indexOf(money.evidence, cursor);
868:     if (pos < 0) continue;
869:     occ.push({ money, pos, end: pos + money.evidence.length });
870:     cursor = pos + money.evidence.length;
871:   }
872:   let best = -1;
873:   let bestKey = Infinity;
874:   occ.forEach((o, i) => {
875:     const d = o.pos >= end ? o.pos - end : at - o.end;
876:     if (d < 0 || d > 24) return;
877:     const key = (o.pos >= end ? 0 : 10000) + d;
878:     if (key < bestKey) { bestKey = key; best = i; }
879:   });
880:   if (best < 0) return null;
881:   let lo = best;
882:   let hi = best;
883:   while (lo - 1 >= 0) {
884:     const gap = src.slice(occ[lo - 1].end, occ[lo].pos);
885:     if (gap.length > 6 || !SALARY_LIST_SEP.test(gap)) break;
886:     lo--;
887:   }
888:   while (hi + 1 < occ.length) {
889:     const gap = src.slice(occ[hi].end, occ[hi + 1].pos);
890:     if (gap.length > 6 || !SALARY_LIST_SEP.test(gap)) break;
891:     hi++;
892:   }
893:   return occ.slice(lo, hi + 1);
894: }
895: 
896: export function extract_profile(text, current = null, opts = {}) {
897:   const src = String(text || "");
898:   const profile = current ? clone(current) : emptyProfile();
899:   const stations = opts.stations || [];
900:   const monies = findMoney(src);
901:   const set = (key, value, evidence, note = "") => {
```

## web/src/profile.js:925-968
```js
925:     }
926:   }
927:   const isUsd = profile.currency && profile.currency.value === "USD";
928: 
929:   const tenure = findTenure(src);
930:   const salaryHit = nearMoney(src, /연봉|월급|세전|급여/, krwMonies)
931:     // 36d2: "dual-income" names the household, not a salary — the
932:     // English anchor never matches inside a hyphenated compound.
933:     // 36i: the English anchor also matches "salaries".
934:     || nearMoney(src, /(?<!-)(?:salaries|salary|earn|make|income)(?!-)/i, krwMonies, 24)
935:     || (/(신입|초봉).*?(4천|3천|5천)/.test(src) ? null : null);
936:   const cashHit = nearMoney(src, /모은\s*돈|모은돈|저축|자기자본|자기\s*자본|보유|현금|수중|마련|종잣돈/, krwMonies, 20)
937:     || nearMoney(src, /savings|saved|cash|in the bank/i, krwMonies, 24);
938:   // 36i: a list after one salary anchor is one amount per member, in
939:   // order; a second anchor for the partner sets the second pay.
940:   // 41l: a chain element tied to a savings cue is cash only — it
941:   // never reads as salary (both languages).
942:   const salaryChainRaw = salaryListAfterAnchor(src, krwMonies);
943:   const salaryChain = salaryChainRaw && salaryChainRaw.length > 0
944:     ? salaryChainRaw.filter((o) => !cashTiedBefore(src, o.pos) && !cashTiedAfter(src, o.end))
945:     : null;
946:   const salaryHitTied = salaryHit
947:     && (cashTiedBefore(src, src.indexOf(salaryHit.evidence)) || cashTiedAfter(src,
948:       src.indexOf(salaryHit.evidence) + salaryHit.evidence.length));
949:   const salaryWons = salaryChain && salaryChain.length > 0
950:     ? salaryChain.map((o) => o.money.won)
951:     : (salaryHit && !salaryHitTied) ? [salaryHit.won] : [];
952:   const salaryEvidence = salaryChain && salaryChain.length > 0
953:     ? src.slice(salaryChain[0].pos, salaryChain[salaryChain.length - 1].end)
954:     : (salaryHit && !salaryHitTied) ? salaryHit.evidence : null;
955:   const partnerHit = salaryWons.length > 0
956:     ? nearMoney(src, /(?:\bpartner\b|\bspouse\b|\bhusband\b|\bwife\b|배우자|아내|남편)/i,
957:         krwMonies.filter((h) => !salaryWons.includes(h.won)
958:           && !(cashHit && h.won === cashHit.won)), 24)
959:     : null;
960:   if (partnerHit) salaryWons.push(partnerHit.won);
961:   // English budget cues ("under 200M won") also mark the deposit —
962:   // never an amount already read as the salary or the savings.
963:   const claimedWon = new Set(
964:     [...salaryWons, cashHit && cashHit.won].filter((v) => Number.isFinite(v)));
965:   // 36d: money already read as the salary or the savings never doubles
966:   // as a price / deposit / monthly cap — those hits read the rest.
967:   const freeMonies = krwMonies.filter((h) => !claimedWon.has(h.won));
968:   const depositCueHit = nearMoney(src,
```

## web/src/profile.js:1001-1033
```js
1001:     const e = /(\d+(?:\.\d+)?)\s*(?:m2|m²|㎡|sqm|square meters?|pyeong)/i.exec(src);
1002:     if (!e) return null;
1003:     return { value: Number(e[1]), evidence: e[0] };
1004:   })();
1005:   const commuteHit = (() => {
1006:     const m = /(\d+)\s*분\s*(?:이내|안에|까지|컷)/.exec(src);
1007:     if (m) return { value: Number(m[1]), evidence: m[0] };
1008:     const e = /(?:within|under|at most|max(?:imum)?|no more than)\s*(\d+)\s*(?:min|mins|minutes)/i.exec(src)
1009:       || /(\d+)\s*(?:min|mins|minutes)\s*(?:or less|max|at most|commute)/i.exec(src);
1010:     if (!e) return null;
1011:     return { value: Number(e[1]), evidence: e[0] };
1012:   })();
1013:   const membersHit = findMembers(src);
1014:   const workHits = findWorkplaces(src, stations);
1015:   const kindsHit = findHomeKinds(src);
1016: 
1017:   // Salary: "연봉 4천" anchor; bare "4천" with 연봉 nearby also counts
1018:   // because nearMoney already requires the anchor word.
1019:   if (salaryWons.length > 0 && profile.salaryAnnual.value === null) {
1020:     const n = (profile.members.value || []).length || 1;
1021:     set("salaryAnnual",
1022:       salaryWons.length > 1 ? salaryWons.slice()
1023:         : Array.from({ length: n }, () => salaryWons[0]),
1024:       partnerHit ? `${salaryEvidence} · ${partnerHit.evidence}` : salaryEvidence,
1025:       "세전 연봉이에요. 실수령은 따로 계산해요.");
1026:   }
1027:   if (cashHit && profile.cash.value === null) {
1028:     set("cash", cashHit.won, cashHit.evidence, "모은 돈");
1029:   }
1030:   // 26c: US data has rent only — tenure is always wolse, even when
1031:   // the text says buy/purchase/매매/전세.
1032:   if (isUsd && profile.tenure.value === null) {
1033:     const rentWord = /\brent(?:ing|s|als?)?\b/i.exec(src) || /월세/.exec(src);
```

## web/src/profile.js:1080-1094
```js
1080:   if (sizeHit && profile.sizeMin.value === null) {
1081:     set("sizeMin", sizeHit.value, sizeHit.evidence, "최소 면적(㎡)");
1082:   }
1083:   if (commuteHit && profile.commuteMax.value === null) {
1084:     set("commuteMax", commuteHit.value, commuteHit.evidence, "출퇴근 상한(분)");
1085:   }
1086:   if (membersHit && profile.members.value === null) {
1087:     set("members", membersHit.members, membersHit.evidence, "함께 사는 사람");
1088:   }
1089:   const officeHit = findOfficeDays(src);
1090:   if (officeHit && profile.officeDays.value === null) {
1091:     set("officeDays", officeHit.value, officeHit.evidence, "일주일 출근 일수");
1092:   }
1093:   const petsHit = findPets(src);
1094:   if (petsHit && profile.pets.value === null) {
```

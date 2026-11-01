# Stage 39c — English screens: official station names, translated loanwords and place terms, and homes shown with their road-name address in English (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the user (English mode)
- Card: `에스케이허브진 (Eseukeiheobeujin)` and `Gangnamgucheong Stn on foot`.
- 3D labels: `Our home · Haujingheobeu`, `Guameorinigongwon walk · destination`, `Geoseongseutahil`, `Roga Vill`.
- The user asked for these "한국 도로명주소 영문으로" (as the Korean road-name address system writes them in English).

Almost every English name goes through `romanizeName` (`web/src/i18n/romanize.js:156-185`):
- card gloss: `homeNameEn` → `romanizeName` (`web/src/i18n/home-names.js:114-120`);
- DOM translator: `web/src/i18n/translate.js:111,216,222`;
- chat map: `web/src/chatmap.js:1025`;
- map walk: `web/src/mapwalk.js:44,347`;
- the 3D label pattern `우리 집 · {0}` → `Our home · {0}`.

The orchestrator added two i18n data files (read them, do not edit):
- `web/src/i18n/en-stations.js`: `STATION_EN`, the official English names of all 518 network stations from the OSM `name:en` tag (`강남구청` → `Gangnam-gu Office`, `서울숲` → `Seoul Forest`).
- `web/src/i18n/en-loanwords.js`: `LOANWORDS` (Hangul spellings of English words and brands, e.g. `허브` → `Hub`, `하우징` → `Housing`, `스타` → `Star`, `현대` → `Hyundai`) and `PLACE_TERMS` (generic end words such as `어린이공원` → `Children's Park`, `구청` → `gu Office` with `join: "hyphen"`).

39b gave every Korean home `address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" }`, in `homes/*.json` and in the homes index.

## Change
1. **`romanizeName`** (`romanize.js:156-185`), per whitespace word, in this order:
   1. `NAMES` exact (unchanged).
   2. **Station.** The word minus a trailing `역` is in `STATION_EN` → `STATION_EN[w]`, plus ` Stn` when `역` was there.
   3. **Place term.** The word ends with a `PLACE_TERMS` entry and has a non-empty stem → `<stem> <en>`, where the stem goes through step 5. With `join: "hyphen"` it is `<Stem>-gu Office`.
   4. Today's `역/동/구/시` suffix rules. **No `LOANWORDS` inside a word that had one of those suffixes**, so `삼성동` stays `Samseong-dong` and never becomes `Samsung-dong`.
   5. **Name pieces.** Replace `splitTypes`/`TYPE_EN` with a left-to-right longest match over `LOANWORDS`, then `TYPE_EN` as a fallback list:
      - each Hangul run between matches is romanized as one capitalised word;
      - pieces are joined with single spaces;
      - a one-syllable loanword (`빌`, `뷰`, `힐`) matches only at the end of the word, after at least 2 other syllables.
2. **Sound changes** (`romanizeWord`, `romanize.js:44-58`), following the Revised Romanization rules:
   - final ㅇ/ㅁ before ㄹ → the ㄹ reads `n` (`종로` → `Jongno`, `음료` → `Eumnyo`);
   - final ㄱ before ㄹ → `ng` + `n` (`독립` → `Dongnip`, `백련` → `Baengnyeon`);
   - final ㅂ before ㄹ → `m` + `n` (`협력` → `Hyeomnyeok`);
   - final ㄷ-group (ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ ㅎ) before ㄴ/ㅁ → `n`.
3. **New `web/src/i18n/road-address.js`**, pure: `roadAddressEn(address)` → string or `""`.
   - Road: `^(.+?)(대로|로|길)(?:(\d+)(번길|길))?\s+(\d+(?:-\d+)?)$`.
     - `<Base>-daero` / `-ro` / `-gil` (base romanized, first letter capital, rest lower-case, no inner spaces);
     - then ` <n>beon-gil` or ` <n>-gil`;
     - the building number goes first.
   - Sigungu: drop the 동/읍/면/리 part.
     - Seoul → `<Gu>-gu, Seoul`.
     - Gyeonggi → `<Gu>-gu, <Si>-si` when both exist, else `<Si>-si`.
     - Use `romanize` for the names (not `romanizeName`, so no loanwords).
   - Examples (tests):
     - `{ road: "천호대로157길 45", sigungu: "서울특별시 강동구 천호동" }` → `45 Cheonho-daero 157-gil, Gangdong-gu, Seoul`;
     - `{ road: "시민로28번길 7", sigungu: "경기도 성남시 수정구 신흥동" }` → `7 Simin-ro 28beon-gil, Sujeong-gu, Seongnam-si`;
     - `{ road: "중앙공원로 17", sigungu: "경기도 성남시 분당구 서현동" }` → `17 Jungganggongwon-ro…`. **Correction:** expected `17 Junganggongwon-ro, Bundang-gu, Seongnam-si`;
     - `{ road: null }` → `""`.
4. **Show the address in English mode**:
   - **Card.** `HomeName` (`web/src/ui/candidate-card.jsx:225-238`) takes an optional `address`. In English with `roadAddressEn(address)` non-empty, render it on its own line (`<span className="ui-home-address" data-no-i18n>`, 14px, muted) under the name. The gloss stays, now from the improved `romanizeName`. Pass `address={candidate.address}` at `:890` and `:1058`.
   - **3D home label** (`web/src/labels3d.js:236-251`): when `homeCandidate && homeCandidate.address` gives a non-empty `roadAddressEn`, set `sub` to it in English. In Korean, set `sub` to `address.road`. Find how labels know the language the same way the nearby labels do; if there is no language there, put both into the item as `sub` (Korean road) and `subEn` (English) and use `subEn` where the label renders in English.
   - Korean screens are otherwise unchanged.

## Tests — new `web/tests/english-names-39c.test.js`
- `romanizeName`:
  - `강남구청역` → `Gangnam-gu Office Stn`; `디지털미디어시티` → `Digital Media City`;
  - `구암어린이공원` → `Guam Children's Park`; `수지구청` → `Suji-gu Office`;
  - `에스케이허브진` → `SK Hub Jin`; `하우징허브` → `Housing Hub`; `거성스타힐` → `Geoseong Star Hill`; `강동현대` → `Gangdong Hyundai`;
  - `삼성동` → `Samseong-dong`; `천호동` → `Cheonho-dong`;
  - `종로` → `Jongno`.
- No output contains Hangul.
- `roadAddressEn`: the examples above.
- SSR:
  - English `HomeName` with an address renders `45 Cheonho-daero 157-gil, Gangdong-gu, Seoul` once; Korean renders no address line.
- **Keep green:** web tests matching `romaniz|homeNameEn|HomeName|labels3d|translate|en-names|chatmap`. Where an old test pins an old romanization that the rules above change on purpose (for example `Dokrimmun`, `Jongro`, `... Vill`), update that pin to the new spelling and list it in the final message.

Run only:
```
cd web && node --test tests/english-names-39c.test.js $(grep -lE "romaniz|homeNameEn|HomeName|labels3d|translate|en-names|chatmap" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/i18n/en-stations.js`, `web/src/i18n/en-loanwords.js`, `web/src/i18n/en.js`, `web/src/i18n/en-table.js`, `web/src/i18n/en-words.js`, `web/src/main.js`, `web/src/consult/**`, `README*`.

## Final message
Changed files, one line each, plus any old test pins you changed (old → new). Nothing else.

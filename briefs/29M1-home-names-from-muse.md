# Stage 29M1 — English names of Korean homes come from Muse, and every screen uses the same one (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep for the rest). Stop when the named tests pass.

## Why
Orchestrator capture, English, Seoul search "Gangnam commute · 2 people · jeonse ₩400M or less" (2026-11-01):
- Muse's answer: `Sinil Utopil (신일유토빌) and Daeha Building (대하빌딩) are both a short walk from work.`
- Same screen, our code: card `수정하이츠 (Sujeonghaicheu)`, `허니하우스 (Heoni House)`; tray `Sinilyuto Vill`; 3D pill `Sinilyuto Vill`.
Muse already writes Korean names "romanized, with the Korean once in parentheses" (`ENGLISH_NOTE`, `web/src/consult/agent.js:24`), and it does so better than our rule-based `romanizeName` (it knows 하이츠 = Heights, 허니 = Honey, 유토빌 = Utopil). The product owner wants the app to match Muse's answer. So Muse becomes the source of English home names, and `romanizeName` is only the last fallback.

## Changes
1. **One client registry** — new `web/src/i18n/home-names.js`:
   - `homeNameEn(ko)` → registered English name for that exact Korean name (trimmed), else `romanizeName(ko)`.
   - `registerHomeNamesEn(map)` (`{ "대하빌딩": "Daeha Building", … }`); ignores values containing Hangul or empty.
   - `harvestHomeNamesEn(text, knownKoNames)` → map of pairs found in a Muse reply written as `English Name (한글이름)` where the Hangul part is one of `knownKoNames` (the current candidates/picks); the English part is the run of Latin words/digits/`'.&-` right before the parenthesis (stop at `,` `;` `:` sentence start words like `and`, `are`, `is`, `The`… — keep it to at most 5 words). A reply-harvested name overrides a registered one (the app matches what the customer just read).
   - `homeNamesEnSnapshot()` → the current map (for requests).
   - In-memory only; `resetHomeNamesEn()` for tests.
2. **Use it everywhere a Korean home/complex name is shown in English** — replace `romanizeName` for home names with `homeNameEn` in: `HomeName` (`web/src/ui/candidate-card.jsx:~158`, and the gloss at `~655`), `trayDisplayName` (`web/src/ui/chat.jsx:~3800`), the 3D home/complex pills (`web/src/labels3d.js` / `placeNameEn` in `web/src/ui/scene-chrome.js` — only for names that are homes/complexes; stations and dongs keep `romanizeName`), the map pin/tooltip names (`web/src/ui/chatmap.jsx`, `web/src/chatmap.js` where a home name is romanised), result/compare headers. Components re-render when the registry changes (a tiny subscribe/version counter or pass through existing state — keep it simple).
3. **Muse names the homes up front (server, English only)** — in `web/src/consult/agent.js`, when the session is English and a tool result carries Korean-named candidates (`result.ui` with candidates / the candidates list used at `~320`), before the model writes its reply:
   - Collect Korean names not yet known (known = `context.names_en` sent by the client + a per-process cache).
   - One extra call with the same `complete` the agent already uses: system "Give the English name an English-speaking resident would use for each Korean apartment/villa/building name. Translate English loanwords by meaning (빌딩 Building, 팰리스 Palace, 하이츠 Heights, 허니 Honey, 타워 Tower, 아파트 Apartments), romanize Korean words (Revised Romanization), keep brand coinages readable (유토빌 Utopil). Reply with JSON only: {\"names\": {\"<korean>\": \"<english>\"}}." User: the JSON list of names. Max 30 names, timeout 8 s, temperature as low as the provider allows. Parse leniently; drop values with Hangul. Failure → skip silently (fallbacks cover it). Log the call in the consult trace like other calls (count only, no text).
   - Put `name_en` on each candidate in the tool result the model reads **and** in `result.ui`, so Muse's reply and the UI start from the same name.
   - Add to `ENGLISH_NOTE`: "When a home has name_en, write exactly that name, with the Korean once in parentheses."
   - Return the final map in the consult response as `names_en` (merge into whatever response object already carries `uiActions`).
4. **Client wiring** — on every consult response in English: `registerHomeNamesEn(res.names_en)`, `registerHomeNamesEn(names from ui candidates' name_en)`, then `registerHomeNamesEn(harvestHomeNamesEn(replyText, currentKoNames))`. Every consult request in English sends `context.names_en = homeNamesEnSnapshot()`. The report request in English passes the English names through the existing `names` input of `writeReport` (`web/src/consult/report.js:106`) so the report says `Daeha Building`, not a romanisation.
5. Korean mode: no extra call, no change.

## Tests — new `web/tests/home-names-29M1.test.js`
- `homeNameEn("대하빌딩")` → `Daeha Building` from `romanizeName` fallback; after `registerHomeNamesEn({"수정하이츠":"Sujeong Heights"})`, `homeNameEn("수정하이츠")` → `Sujeong Heights`.
- `harvestHomeNamesEn("Sinil Utopil (신일유토빌) and Daeha Building (대하빌딩) are both a short walk from work.", ["신일유토빌","대하빌딩","허니하우스"])` → `{신일유토빌:"Sinil Utopil", 대하빌딩:"Daeha Building"}`; a pair whose Hangul is not a known name (`Gangnam Stn (강남역)`) is ignored.
- SSR `HomeName` in English after registering `허니하우스 → Honey House` renders `허니하우스` and `(Honey House)`; `trayDisplayName("허니하우스","en")` → `Honey House`.
- Agent with a fake `complete`: English session, a candidates tool result with `대하빌딩`, the names call returns `{"names":{"대하빌딩":"Daeha Building"}}` → the tool message the model reads contains `"name_en":"Daeha Building"`, the response has `names_en.대하빌딩 === "Daeha Building"`; a name already in `context.names_en` triggers no names call; Korean session makes no names call; a names call that throws leaves the turn working.
Keep green: `tests/en-names-29L6.test.js`, `tests/en-report-names-34b.test.js`, `tests/scene-chrome-29L2.test.js`, and the consult agent tests (`grep -l "runConsult\|consult/agent" tests/*.test.js`).

Run only:
```
cd web && node --test tests/home-names-29M1.test.js tests/en-names-29L6.test.js tests/en-report-names-34b.test.js tests/scene-chrome-29L2.test.js $(grep -l "runConsult\|consult/agent" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
The 2D map layout, 3D rendering, verify/, `briefs/`.

## Final message
Changed files, one line each. Nothing else.

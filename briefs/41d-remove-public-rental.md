# Stage 41d — remove public rental from the service (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Runs after 41a/41b/41c/41e are committed.

## Why
Owner decision (2026-11-01): **public rental (공공임대, LH·마이홈) is removed from the service.** Today it shows up as a tenure choice, a chat chip, a tool the model can call, a money-panel section with broken rows ("[object Object] undefined㎡", "보증금 – · –"), a support-tab section, a demo-tour step and a source line.

## Change — remove every customer-visible public-rental path
Find them with `grep -rnE "공공임대|public_rental|publicRental|find_public_rentals|recommend_public_rental|NO_PUBLIC_RENTAL|tenure.*public|\"public\"" web/src`. At least:
- `web/src/profile.js`: tenure "public" (`:38`, `:210` Korean word, `:1084` question text → "전세·월세·매매 중 어떻게 살고 싶으세요?", English parse). A customer who says 공공임대 / public rental gets no tenure set (the normal tenure question follows) — never an error.
- `web/src/ui/chat.jsx`: chip "공공임대 찾기" (`:1390`, `:2943`), the `/공공임대/` branch (`:2889`), and the US note text (`:1666` → "미국 자료에는 전세·지원 제도 정보가 없어요.").
- Consult/relay: the `find_public_rentals` and `recommend_public_rental` tools leave `SEARCH_TOOL_DEFS` / money tool defs and dispatch; `web/src/consult/agent.js` prompts stop mentioning public rental; `agent-float.js` labels for those tools go; guards that format public-rental rows go.
- `web/src/ui/money.jsx`: the public-rental candidates section (`CandidateRow` and its list) goes; `web/src/ui/support.jsx:139-141` public-rental section goes; `web/src/ui/listings.jsx` public sub-tab goes; `web/src/ui/app.jsx:1079` source line drops " · 공공임대: LH·마이홈 (공공주택 데이터 API)".
- `web/src/money/tenure.js`, `worthit.js`, `custom-money.js`, `format.js`, `homes.js` (`public:` label, `NO_PUBLIC_RENTAL_NOTE`), `sources.js`, `glossary.js` term 공공임대, `ui/copy.js`, `ui/share.js`, `ui/store.js`, `orb.js`/`ui/orb.jsx`, `load-error.js`, `verify/compare.js`, `engine/scenario.js`: remove the public branches/labels/terms. Keep the 공공임대 *exclusion* filter in `homes.js:92-98` (rental complexes must still never appear as 전세·월세·매매 results).
- `web/src/ui/demotour.js:34-35`: drop the `public` step (orchestrator file; allowed for this change) and update `web/tests/demotour.test.js` accordingly.
- Delete tests that only test public rental; update tests that list tenures/tools/chips.
Do not delete data files under `data/` or pipeline code; only the web product.

## Tests — new `web/tests/no-public-rental-41d.test.js`
- `extract_profile("공공임대 찾아줘")` and `("I want public rental")` set no tenure and do not throw.
- The consult tool list has no tool whose name contains "public".
- Source scan: no file under `web/src` (except `web/src/i18n/*` and the homes.js exclusion filter) contains "공공임대" or "find_public_rentals".

Run only:
```
cd web && node --test tests/no-public-rental-41d.test.js tests/demotour.test.js $(grep -lE "공공임대|public_rental|find_public_rentals|\"public\"" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```

## Final message
Changed/deleted files, one line each; tests deleted or changed (why).

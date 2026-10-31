# Stage 36h6 — the English credit has its phone short form again (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls. Stop when the named tests pass.

## Found by the orchestrator (phone 390×844, `?…&home=B&t=07:38&lang=en`)
- **What the phone shows.** The credit reads `Aerial photo © MOLIT Spatial Information Open Platform (VWorld) · ` and runs off the right edge.
- **Korean is fine.** It shows the short form `© VWorld · © OpenStreetMap`.
- **Cause.** 36g2 made the English credit one string inside a single span (`web/src/ui/app.jsx:1032-1040`). It dropped the `ui-simcredit-full` / `ui-simcredit-short` pair that the CSS switches at ≤ 480 px (29L2).

## Change (`SimCredit`, English branch)
- Render the same two spans as Korean, each `data-no-i18n`:
  - **full:** today's English line;
  - **short:** `© VWorld · © OpenStreetMap` when the VWorld photo shows, `${USGS_CREDIT} · © OpenStreetMap` for US areas, `© OpenStreetMap` without a photo.
- Keep the `title` on the wrapper.
- Do not change Korean.

## Also: the public-rental workplace line reads twice (`web/scripts/money.mjs` `workplaceNote`, `web/src/ui/listings.jsx:271`)
- **What the money tab shows now.** After 36h4 it reads `직장: 직장 (가정: 판교역 인근) · 직장 위치(직장 (가정: 판교역 인근))에서 직선 거리예요. 출퇴근 시간은 아니에요.` The orchestrator's 36h4 wording caused this.
- **Note.** When the label already starts with `직장`, write `{label}에서 직선 거리예요. 출퇴근 시간은 아니에요.` → `직장 (가정: 판교역 인근)에서 직선 거리예요. 출퇴근 시간은 아니에요.` A station label keeps `직장({label})에서 …`.
- **`listings.jsx`.** Show the note alone, without the `직장: {label} ·` prefix, when the label starts with `직장`. Otherwise keep `직장: {label} · {note}`.
- **Test.** Update `listings-workplace-36h4.test.js` to the new wording, and add an SSR check that the line contains `직장` once before `에서`.

## Test
Add to `web/tests/official-marker-36g.test.js` (or a new `web/tests/credit-short-36h6.test.js`): SSR `SimCredit` in English with the photo on contains both `ui-simcredit-full` and `ui-simcredit-short`, and the short span text is `© VWorld · © OpenStreetMap`. Keep green every test that mentions `SimCredit` or `ui-simcredit`.

Run only:
```
cd web && node --test $(grep -lE "SimCredit|ui-simcredit|workplace_note|listings-workplace" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Do not touch
Everything except `web/src/ui/app.jsx`, `web/scripts/money.mjs` (`workplaceNote` only), `web/src/ui/listings.jsx` (that line only) and the test files.

## Final message
Changed files, one line each. Nothing else.

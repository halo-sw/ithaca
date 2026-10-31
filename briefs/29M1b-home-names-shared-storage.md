# Stage 29M1b — The 3D frame and new windows see the same English home names (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
29M1's registry (`web/src/i18n/home-names.js`) lives in memory of the chat page. The 3D scene in the chat panel is a separate document (`<iframe className="ui-chat-scene-frame">`, `web/src/ui/chat.jsx:~3661`) and "Open in new window" is another one, so their 3D pills still show the rule-based romanisation (`Sinilyuto Vill`) while the chat says `Sinil Utopil`.

## Changes
`home-names.js` only:
- Persist the map in `localStorage` under `ithaca.homeNamesEn.v1` (JSON). Every read/write in try/catch; storage unavailable → memory only, nothing breaks.
- Load it lazily on first `homeNameEn` / `homeNamesEnSnapshot` call; `registerHomeNamesEn` merges and writes back.
- Listen to the `storage` event (when `window` exists) so a frame already open picks up names registered later; bump the same change counter 29M1 uses so subscribed components re-render.
- Cap at 500 entries (drop oldest).
- `resetHomeNamesEn()` also clears the stored key.

## Tests — extend `web/tests/home-names-29M1.test.js`
- With a fake `globalThis.localStorage` (Map-backed): register in one "page", `resetHomeNamesEn`-free re-import or a test hook that drops the memory cache → `homeNameEn` still returns the stored name.
- A `localStorage` whose `getItem`/`setItem` throw → register and read still work from memory.

Run only:
```
cd web && node --test tests/home-names-29M1.test.js tests/scene-chrome-29L2.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Everything else; `briefs/`.

## Final message
Changed files, one line each. Nothing else.

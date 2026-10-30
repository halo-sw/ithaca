# V1 result — the 3-minute demo video in Remotion

`Demo`: 1920×1080, 30 fps, 180 s (5400 frames), 9 scenes straight from
`video/data/script.json`. New clips and new words drop in with no code change
(see below). 46 unit tests, all green; `remotion bundle` compiles.

## Commands (run in `video/`)

- `npm test` — 46 unit tests (`copy`, `timeline`, `theme`, `fade`, `assets`,
  `callouts`, `verify`).
- `npm run studio` — Remotion Studio for scrubbing the timeline.
- `npm run stills` — one still per scene into `out/stills/<id>.png`
  (frame at 2 s into each scene). Extra args pass through to
  `remotion still`, e.g. `npm run stills -- --scale=0.5`.
  `node scripts/stills.mjs --dry-run` prints the frames without rendering.
- `npm run still -- Demo out/x.png --frame=60` — a single still.
- `npm run render` — full video to `out/ithaca-demo.mp4`.
  Half-scale check: `npx remotion render src/index.js Demo
  out/ithaca-demo-half.mp4 --scale=0.5`.

To swap a clip: put the `.mp4` (or `.png`) in `video/public/clips/` under the
name `script.json` expects. `scripts/assets.mjs` re-lists the folder into
`src/assets.generated.json` automatically before studio / still / render /
stills, so the placeholder card flips to the clip with no code change.
To change a word: edit `video/data/script.json` (scene times must stay
continuous — `timeline.test.js` checks the real file) or `video/data/stats.json`
(a `null` stat drops its whole line, never prints "null"). No code change.

## Stills and render status

Not rendered in this session: both headless-Chrome binaries crash within
milliseconds under this session's shell sandbox (`chrome-headless-shell`
SIGSEGV `KERN_INVALID_ADDRESS at 0x10`; full Chrome SIGABRT — reports in
`~/Library/Logs/DiagnosticReports/`, 2026-10-30 ~14:01), and unsandboxed
execution needs human approval, which is disabled for this run. The failure
is environmental, not code: `remotion bundle` exits 0 on the final code and
the crash reproduces with the browser binary alone. First pixel check =
orchestrator runs `npm run stills` outside the sandbox.

Expected stills (verified via `--dry-run`): `hook` f60, `pitch` f420,
`intake` f660, `candidates` f1200, `simulate` f1860, `results` f3210,
`verify` f4110, `meta` f4770, `end` f5250 → `out/stills/<id>.png` (git-ignored).
Half-scale render time: not measured (same blocker) — please record it on the
first real render.

Currently all five clip scenes (`intake`, `candidates`, `simulate`, `results`,
`verify`) will show the placeholder card (`public/clips/` is empty, clips land
after stage 18).

## Copy that may not fit (estimates — confirm from the stills)

Char counts are exact (filled from `stats.json`); widths use conservative
Pretendard advances. Wrapping is graceful everywhere (centred/wrapped, nothing
clips), but a wrapped title changes the intended one-line look:

- `hook` `lines_en[0]` (54 chars): likely wraps to 2 lines at title 72
  (one-line budget ≈ 50 chars in 1728 px). Suggest ≤ 48 chars or accept 2 lines.
- `pitch` `lines_en[1]` (69 chars): wraps to 2 lines. Suggest shortening, or
  splitting into two `lines_en` entries (the 8-frame stagger handles it).
- `meta` `rows_en[2]` (88 chars): likely wraps to 2 lines at subtitle 40
  (budget ≈ 78). Suggest ≤ 75 chars.
- Borderline, check the still: `pitch` `lines_en[0]` (49 chars),
  `meta` `rows_en[0]` (78 chars).

Fits: all four screen captions (2 lines each; the bar reserves 2 + bottom
margin), `verify` caption (2 lines) and steps (step 4 wraps to 2 lines, fits
the column), all callout pills (longest 52 chars ≈ 760 px in the 1632 px card),
`source`/`footer`. Callouts cannot overlap: each window ends at the next
callout's `at` or after 4 s, whichever is sooner (`callouts.test.js` checks
the real timings — every callout gets its full 4 s).

## Limits and judgment calls

- No pixel has been rendered yet (above). Layout math is hand-verified with
  reserves; watch the flagged lines on the first stills.
- `verify` caption sits under the left card like the screen scenes (the brief
  doesn't place it); steps top-align with the card.
- Title `lines_ko` renders as a block under the English lines with the stagger
  continuing (the brief's "sits under it" is ambiguous for multi-line scenes).
- A clip shorter than its scene holds its last frame via the video element's
  end clamp; a longer one is cut by the `Sequence`. Re-check with a real clip:
  today every clip scene is a placeholder.
- Unknown scene `kind`s render a small fallback card instead of crashing, so a
  future script edit can't break the 180 s end to end.
- Font: Pretendard Variable + OFL copied to `video/public/fonts/`; rendering
  waits for it (`delayRender`, 10 s safety timeout). Only app colours, radii,
  shadow and border are used (`theme.js` names every source line).

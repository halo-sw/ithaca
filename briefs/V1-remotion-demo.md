# Stage V1 — The 3-minute demo video in Remotion (brief for Muse)

Agent mode, rules in `AGENTS.md`. Sandbox: no network, no keys. **No sub-agents.** Branch `video-demo` (worktree `sim-video`). Commit after each part (`git add -A video && git commit -m "V1: …"`). The first edit should land within 5 tool calls. Do the parts **in order**; if you run out of budget, earlier parts matter more.

**Touch only `video/`** (except `video/data/`, which the orchestrator owns, and `video/node_modules/`). Another Muse run is editing `web/` on a different branch: never edit anything under `web/`, `pipeline/`, `tests/` or `scenarios/`. You may read them.

## Why
The hackathon submission needs a 3-minute demo video. The judges (Meta staff) score impact, Meta AI tool use, technical depth and demo quality equally. The video is product code like everything else here, so Muse writes it. The orchestrator writes the words (`video/data/script.json`), checks the numbers (`video/data/stats.json`) and records the screen clips (`video/public/clips/`) after stage 18 lands. Build the video so that new clips and new words drop in with no code change.

## Already set up (orchestrator)
- `video/package.json` with `remotion`, `@remotion/cli`, `@remotion/media-utils` 4.0.535 (exact), `react` / `react-dom` 19.1.1, installed in `video/node_modules`. The headless browser for rendering is already downloaded, so `npx remotion still` / `render` work offline.
- `video/data/script.json`: scenes with `id`, `start`, `duration`, `kind` (`title` / `screen` / `verify` / `stats`), copy, `callouts` (`at` = seconds from scene start), `asset` paths.
- `video/data/stats.json`: numbers. `{stat:key}` in any copy string reads it.
- JavaScript + JSX only, no TypeScript.

## 1. Skeleton that renders
- `video/src/index.js` (`registerRoot`) and `video/src/Root.jsx` with one composition `Demo`: width, height, fps from `script.json`; duration = end of the last scene.
- `video/src/copy.js` (pure): fills `{stat:key}` from `stats.json`. If a line uses a stat that is `null` or missing, the whole line is dropped (never print "null", "undefined" or an empty number). A `source` field whose stat is null is dropped too. Unit tests with `node --test` in `video/tests/`.
- `video/src/timeline.js` (pure): scene → `{ from, durationInFrames }`; checks that scenes do not overlap or leave gaps and that callouts fall inside their scene. Tests, including one that runs the check on the real `script.json`.
- Each scene is a `<Sequence>`; render placeholder scenes first so the whole 180 s plays end to end.
- Commit `V1: skeleton renders end to end`.

## 2. Look
- Fonts: copy `web/public/fonts/pretendard/` into `video/public/fonts/pretendard/` (OFL, keep the license file) and load it with `@font-face` / `staticFile`. Wait for the font before rendering (`delayRender` / `continueRender`) so no frame shows a fallback font.
- Colours and sizes from the app, copied into `video/src/theme.js` with a comment naming the source line:
  - `web/src/ui/ui.css` tokens: page `#f6f4ef`, card `#ffffff`, ink `#1d1b18` / `#5f5a52` / `#8f897f`, accent `#2f6fed`, radii 8 / 12 / 16.
  - Home colours from `web/src/ui/money.jsx` `HOME_COLORS`: A `#b25a33`, B `#4a7ba7`.
  - Do not invent other brand colours or gradients.
- Type scale for 1080p: title 72, subtitle 40, caption 32, callout 28. English is the main line; Korean (`lines_ko`) sits under it at 0.6 size in ink2.
- Motion: calm. Fades and short slides with `spring` (no bounce overshoot) or `interpolate` with easing; 12–18 frames in and out. No spinning, zooming text or particle effects.
- Commit `V1: look`.

## 3. Scene kinds
- `title`: centred lines on the page colour, staggered 8 frames per line; optional `source` in small ink3 text bottom-left; optional `footer` bottom-centre.
- `screen`: the clip (`OffthreadVideo` for `.mp4`, `Img` for `.png`) inside a rounded card that fills about 86 % of the width, with a soft shadow. A caption bar sits under the card. Each callout appears at its `at` second as a pill near the top-right of the card and stays 4 s, unless the next callout comes sooner.
  - Missing asset: show a placeholder card with the scene id, the expected path and the caption. Detect what exists with a small script `video/scripts/assets.mjs` that lists `video/public/clips/` into `video/src/assets.generated.json`; run it from `prestudio`, `prestill` and `prerender` in `package.json`. Test the placeholder decision in pure code.
  - A clip shorter than its scene holds its last frame; a longer one is cut at the scene end.
- `verify`: the clip on the left at 60 % width; on the right, `steps_en` appear one by one, evenly spaced across the scene. Fail steps get the busy colour `#d96c3c`, the final pass step the ok colour `#4a9b6b`. A step counts as a fail when its text starts with "Check:".
- `stats`: the caption as a heading, then `rows_en` appear one per second as large lines with a thin accent bar on the left. Rows dropped by `copy.js` leave no gap.
- Commit `V1: scene kinds`.

## 4. Checks and stills
- `npm test` in `video/` green.
- Render one still per scene into `video/out/stills/<id>.png` (frame at 2 s into each scene) with a script `video/scripts/stills.mjs`, so the orchestrator can review the look without the full render. `video/out/` is git-ignored.
- Render the full video once at `--scale=0.5` to make sure it finishes, and report the time it took.
- Commit `V1: stills and checks`.

## End
Write `briefs/V1-RESULT.md`:
- the commands (studio, stills, full render), and how to swap a clip or a word
- the list of stills rendered and the half-scale render time
- anything in `script.json` that did not fit the layout (line too long for one line at caption size, callout overlapping another), with the scene id, so the orchestrator can shorten the copy
- limits
Commit `V1: result note`.

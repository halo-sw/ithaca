# Stage V2 — demo video v2: caption bar under the clip, zoom-ins on small UI, title image, model table, end links (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no build, no render. Branch `video-demo`, folder `video/` only. Stop when this part is done.

## Why (customer feedback on the v1.2 render)
- The app UI is too small to read: the clip is an 85 %-wide card (`ScreenScene.jsx:22–24`), so a 1440-px app screen shrinks to about half size.
- Callout pills sit over the clip at top-right (`ScreenScene.jsx:42–69`), so they cover the UI.
- Small UI needs zoom-ins; there is no zoom today.
- The Meta scene needs a model-by-model table, not bullet sentences.
- The end card needs the live site and the GitHub address.

The orchestrator records new clips (1440×810 at 2× → 2880×1620 mp4) and rewrites `data/script.json` / `data/stats.json`. You change only the code and the tests. Never edit `data/*.json` (the tests read the real file; add fixtures in tests if needed).

## Change
1. **`ScreenScene` layout** (`src/scenes/ScreenScene.jsx`, `src/theme.js`):
   - **Clip box:** top of the frame, as large as possible. Height = 1080 − caption bar height (`CAPTION_BAR = 128`). Width = height × 16 / 9, centred, `--page` colour on both sides. Radius 16, no shadow.
   - **Caption bar:** full-width bar at the bottom, `CAPTION_BAR` px tall, background `COLORS.ink`, text white, `TYPE.caption` (32), centred, max 2 lines. It never overlaps the clip.
   - **Callouts move into the bar.** While a callout window is open, it shows as an accent pill (background `COLORS.accent`, white, `TYPE.callout`) at the left of the bar, before the caption, vertically centred. The caption shifts right, but its centre stays within the remaining width. Nothing is drawn over the clip.
2. **Zoom** (new `src/zoom.js`, used by `ClipCard` / `ScreenScene`):
   - **Script field:** `scene.zooms: [{ at, until, rect: [x, y, w, h] }]`. Seconds are scene-relative. `rect` is normalised (0–1) to the clip.
   - **Pure helper:** `zoomTransform(zooms, tSec, boxW, boxH, fps)` returns `{ scale, tx, ty }`.
     - Inside a window, scale = `min(1 / max(w, h·(16/9)/(16/9)), 2.5)`. In practice: fit the rect into the box, cap 2.5.
     - Translate so the rect centre sits at the box centre, clamped so the clip never shows an edge inside the box.
     - Ease in over the first 18 frames of the window and out over its last 18 frames (`Easing.inOut(Easing.cubic)` style, pure math).
     - Outside every window: `{1, 0, 0}`.
   - **Render:** apply it as a CSS `transform` on the inner video / image; the box keeps `overflow: hidden`.
3. **Clip trim** (`ClipCard`):
   - `scene.clip_from` (seconds, default 0) → `OffthreadVideo startFrom` in frames.
   - `scene.playback_rate` (default 1) → `playbackRate`.
4. **`TitleScene` image:** optional `scene.image` (path under `public/`, e.g. `brand/ithaca-banner.png`). Draw it centred above the lines, max width 1100 px, keeping its aspect. The lines follow under it with the same stagger.
5. **`StatsScene` table:** optional `scene.table_en: [[label, text], …]`.
   - Two columns: the label in bold `TYPE.subtitle` (40) ink, the text in `TYPE.caption` (32) ink2.
   - Rows 28 px apart, staggered in like `rows_en`.
   - `{stat:key}` filling works in both cells (`fillLine`), and a row whose text fills to null is dropped.
   - When `table_en` is absent, `rows_en` renders as today.
6. **`TitleScene` footers:** optional `scene.footers: [string, …]`, bottom-centre, stacked, `TYPE.subtitle` ink2. The old single `footer` still works.
7. **`validateScript`** (`src/timeline.js`): also check each zoom has `0 ≤ at < until ≤ duration` and a rect inside [0, 1] with w, h > 0.

## Test
- **New `tests/zoom.test.js`:**
  - outside windows → identity;
  - mid-window scale and centre for rect `[0.5, 0.5, 0.5, 0.5]` in a 1707×952 box;
  - easing at frame 0 and 9 of a window;
  - clamp at the edges (rect at `[0, 0, 0.2, 0.2]` never shows past the left / top edge);
  - cap 2.5.
- **Extend `timeline.test.js`:** a fixture with a bad zoom produces an error. The real `data/script.json` still validates.
- **Extend `copy.test.js` (or a new test):** the `table_en` fill drops a null row.
- **Keep green:** every existing test (`npm test` in `video/`).

Run only (**run it before you finish**):
```
cd video && npm test 2>&1 | tail -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/*.json`, `public/`, `package.json` dependencies, `web/`, anything outside `video/`.

## Final message
Changed files, one line each. New script fields with one example each. Nothing else.

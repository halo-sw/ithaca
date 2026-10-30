// Look tokens copied from the app. Do not invent other brand colours or gradients.
// Each value names its source line.

export const FONT_FAMILY =
  "'Pretendard Variable', -apple-system, 'Apple SD Gothic Neo', sans-serif"; // web/src/ui/ui.css:8 (--ui-font)

export const COLORS = {
  page: "#f6f4ef", // web/src/ui/ui.css:14 (--ui-page)
  card: "#ffffff", // web/src/ui/ui.css:14 (--ui-card)
  ink: "#1d1b18", // web/src/ui/ui.css:17 (--ui-ink)
  ink2: "#5f5a52", // web/src/ui/ui.css:17 (--ui-ink2)
  ink3: "#8f897f", // web/src/ui/ui.css:17 (--ui-ink3)
  accent: "#2f6fed", // web/src/ui/ui.css:18 (--ui-accent)
  ok: "#4a9b6b", // web/src/ui/ui.css:19 (--ui-ok) — verify pass step
  busy: "#d96c3c", // web/src/ui/ui.css:19 (--ui-busy) — verify fail steps
  homeA: "#b25a33", // web/src/ui/money.jsx:35 (HOME_COLORS.A)
  homeB: "#4a7ba7", // web/src/ui/money.jsx:35 (HOME_COLORS.B)
};

export const RADII = {
  chip: 8, // web/src/ui/ui.css:13 (--ui-r-chip)
  card: 12, // web/src/ui/ui.css:13 (--ui-r-card)
  sheet: 16, // web/src/ui/ui.css:13 (--ui-r-sheet)
  // The screen card is much bigger than app cards, so it uses a larger
  // radius in the same stepped scale (brief type scale is for 1080p).
  screenCard: 24,
  pill: 999,
};

// Type scale for 1080p (brief). Korean second lines render at 0.6x in ink2.
export const TYPE = {
  title: 72,
  subtitle: 40,
  caption: 32,
  callout: 28,
  source: 24,
  koScale: 0.6,
};

// Calm motion: fades + short slides only, 12–18 frames in and out.
export const MOTION = {
  fadeIn: 15,
  fadeOut: 15,
  stagger: 8, // frames between staggered lines
  slidePx: 24, // short vertical slide distance
};

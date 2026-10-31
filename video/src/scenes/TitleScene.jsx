import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import stats from "../../data/stats.json";
import { fillLines, fillSource } from "../copy.js";
import { appearOpacity, riseOffset, sceneOpacity } from "../fade.js";
import { COLORS, FONT_FAMILY, MOTION, TYPE } from "../theme.js";

// Centred lines on the page colour, staggered 8 frames per line. English
// first, then the Korean lines under them at 0.6 size in ink2. Optional
// image (a path under public/) centred above the lines, optional source
// bottom-left, optional footers (or the old single footer) bottom-centre.
export function TitleScene({ scene, durationInFrames }) {
  const frame = useCurrentFrame();
  const en = fillLines(scene.lines_en, stats);
  const ko = fillLines(scene.lines_ko, stats);
  const source = fillSource(scene.source, stats);
  const footers = fillLines(scene.footers, stats);
  const legacyFooter = fillSource(scene.footer, stats);
  // The old single footer keeps working: when no `footers` array is given
  // it renders exactly as before; otherwise it joins the stack.
  const footerStack =
    footers.length > 0
      ? [...footers, ...(legacyFooter ? [legacyFooter] : [])]
      : [];
  const lines = [
    ...en.map((text) => ({ text, korean: false })),
    ...ko.map((text) => ({ text, korean: true })),
  ];
  const koSize = Math.round(TYPE.title * TYPE.koScale);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        justifyContent: "center",
        alignItems: "center",
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingLeft: 96,
          paddingRight: 96,
        }}
      >
        {scene.image ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 48,
              opacity: appearOpacity(frame, 0),
            }}
          >
            <Img
              src={staticFile(scene.image)}
              style={{ maxWidth: 1100, display: "block" }}
            />
          </div>
        ) : null}
        {lines.map((line, i) => {
          const appearFrame = i * MOTION.stagger;
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: line.korean ? koSize : TYPE.title,
                fontWeight: line.korean ? 400 : 700,
                lineHeight: 1.25,
                color: line.korean ? COLORS.ink2 : COLORS.ink,
                textAlign: "center",
                maxWidth: 1728,
                marginTop:
                  i === 0 ? 0 : line.korean && !lines[i - 1].korean ? 28 : 20,
                opacity: appearOpacity(frame, appearFrame),
                transform: `translateY(${riseOffset(frame, appearFrame)}px)`,
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
      {source ? (
        <div
          style={{
            position: "absolute",
            left: 96,
            bottom: 64,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.source,
            color: COLORS.ink3,
          }}
        >
          {source}
        </div>
      ) : null}
      {footerStack.length > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 64,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          {footerStack.map((text, i) => (
            <div
              key={i}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.subtitle,
                color: COLORS.ink2,
                textAlign: "center",
              }}
            >
              {text}
            </div>
          ))}
        </div>
      ) : legacyFooter ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 64,
            textAlign: "center",
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.source,
            color: COLORS.ink2,
          }}
        >
          {legacyFooter}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

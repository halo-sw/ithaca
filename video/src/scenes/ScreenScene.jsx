import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import stats from "../../data/stats.json";
import { calloutWindows } from "../callouts.js";
import { fillLine } from "../copy.js";
import { riseOffset, sceneOpacity, windowOpacity } from "../fade.js";
import { BORDER, COLORS, FONT_FAMILY, RADII, SHADOW, TYPE } from "../theme.js";
import { ClipCard } from "./ClipCard.jsx";

// The clip in a rounded card (~85% width) with a caption bar under it.
// Callouts pop as pills near the top-right of the card.
export function ScreenScene({ scene, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const caption = fillLine(scene.caption_en, stats);
  const windows = calloutWindows(scene.callouts, scene.duration).map((w) => ({
    ...w,
    text: fillLine(w.text_en, stats),
    fromFrame: Math.round(w.at * fps),
    untilFrame: Math.round(w.until * fps),
  }));
  const cardWidth = Math.round(width * 0.85);
  const cardHeight = Math.round((cardWidth * 9) / 16);
  const cardTop = 24;
  const gap = 12;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        alignItems: "center",
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <div style={{ position: "relative", marginTop: cardTop }}>
        <ClipCard
          asset={scene.asset}
          sceneId={scene.id}
          width={cardWidth}
          height={cardHeight}
        />
        {windows.map((w, i) =>
          w.text === null || frame < w.fromFrame || frame >= w.untilFrame
            ? null
            : (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 24,
                    right: 24,
                    backgroundColor: COLORS.card,
                    border: BORDER,
                    borderRadius: RADII.pill,
                    boxShadow: SHADOW,
                    padding: "12px 28px",
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.callout,
                    fontWeight: 600,
                    color: COLORS.ink,
                    whiteSpace: "nowrap",
                    opacity: windowOpacity(frame, w.fromFrame, w.untilFrame),
                    transform: `translateY(${riseOffset(frame, w.fromFrame, 12, 12)}px)`,
                  }}
                >
                  {w.text}
                </div>
              )
        )}
      </div>
      {caption ? (
        <div
          style={{
            marginTop: gap,
            width: cardWidth,
            backgroundColor: COLORS.card,
            border: BORDER,
            borderRadius: RADII.card,
            padding: "10px 28px",
            boxSizing: "border-box",
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.caption,
            lineHeight: 1.35,
            color: COLORS.ink,
            textAlign: "center",
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

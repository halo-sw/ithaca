import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import stats from "../../data/stats.json";
import { fillLine, fillLines } from "../copy.js";
import { appearOpacity, riseOffset, sceneOpacity } from "../fade.js";
import { BORDER, COLORS, FONT_FAMILY, RADII, TYPE } from "../theme.js";
import { stepAppearFrame, stepTone } from "../verify.js";
import { ClipCard } from "./ClipCard.jsx";

// The clip on the left at 60% width with its caption under it; on the right
// the steps appear one by one, evenly spaced. Fail steps ("Check:…") get the
// busy colour, the final pass step the ok colour.
const TONE_COLORS = {
  fail: COLORS.busy,
  pass: COLORS.ok,
  normal: COLORS.ink,
};

export function VerifyScene({ scene, durationInFrames }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const caption = fillLine(scene.caption_en, stats);
  const steps = fillLines(scene.steps_en, stats);
  const margin = 64;
  const cardWidth = Math.round(width * 0.6);
  const cardHeight = Math.round((cardWidth * 9) / 16);
  const gap = 12;
  // Reserve two caption lines so the block stays centred either way.
  const captionReserve = Math.round(TYPE.caption * 1.35 * 2 + 20);
  const blockTop = Math.round(
    (height - (cardHeight + gap + captionReserve)) / 2
  );
  const stepsLeft = margin + cardWidth + margin;
  const stepsWidth = width - stepsLeft - margin;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: margin,
          top: blockTop,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ClipCard
          asset={scene.asset}
          sceneId={scene.id}
          width={cardWidth}
          height={cardHeight}
        />
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
      </div>
      <div
        style={{
          position: "absolute",
          left: stepsLeft,
          top: blockTop,
          width: stepsWidth,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {steps.map((text, i) => {
          const appearFrame = stepAppearFrame(i, steps.length, durationInFrames);
          const tone = stepTone(text, i === steps.length - 1);
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.subtitle,
                fontWeight: 600,
                lineHeight: 1.3,
                color: TONE_COLORS[tone],
                opacity: appearOpacity(frame, appearFrame),
                transform: `translateY(${riseOffset(frame, appearFrame)}px)`,
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import stats from "../../data/stats.json";
import { calloutWindows } from "../callouts.js";
import { fillLine } from "../copy.js";
import { sceneOpacity, windowOpacity } from "../fade.js";
import { CAPTION_BAR, COLORS, FONT_FAMILY, RADII, TYPE } from "../theme.js";
import { zoomTransform } from "../zoom.js";
import { ClipCard } from "./ClipCard.jsx";

// The clip as large as possible at the top of the frame (height 1080 -
// CAPTION_BAR, 16:9, page colour on both sides, radius 16, no shadow) with
// a full-width ink caption bar at the bottom. Callouts show as accent pills
// at the left of the bar; nothing is ever drawn over the clip.
export function ScreenScene({ scene, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const caption = fillLine(scene.caption_en, stats);
  const windows = calloutWindows(scene.callouts, scene.duration).map((w) => ({
    ...w,
    text: fillLine(w.text_en, stats),
    fromFrame: Math.round(w.at * fps),
    untilFrame: Math.round(w.until * fps),
  }));
  const active =
    windows.find(
      (w) =>
        w.text !== null && frame >= w.fromFrame && frame < w.untilFrame
    ) ?? null;
  const clipHeight = height - CAPTION_BAR;
  const clipWidth = Math.round((clipHeight * 16) / 9);
  const zoom = zoomTransform(scene.zooms, frame / fps, clipWidth, clipHeight, fps);
  const startFrom = Math.round((scene.clip_from ?? 0) * fps);
  const playbackRate = scene.playback_rate ?? 1;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <div
        style={{
          height: clipHeight,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ClipCard
          asset={scene.asset}
          sceneId={scene.id}
          width={clipWidth}
          height={clipHeight}
          zoom={zoom}
          startFrom={startFrom}
          playbackRate={playbackRate}
          radius={16}
          shadow="none"
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: CAPTION_BAR,
          backgroundColor: COLORS.ink,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 48,
          paddingRight: 48,
          boxSizing: "border-box",
        }}
      >
        {active ? (
          <div
            style={{
              flex: "none",
              backgroundColor: COLORS.accent,
              borderRadius: RADII.pill,
              padding: "12px 28px",
              marginRight: 32,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.callout,
              fontWeight: 600,
              color: "#ffffff",
              whiteSpace: "nowrap",
              opacity: windowOpacity(frame, active.fromFrame, active.untilFrame),
            }}
          >
            {active.text}
          </div>
        ) : null}
        {caption ? (
          <div
            style={{
              flex: 1,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.caption,
              lineHeight: 1.35,
              color: "#ffffff",
              textAlign: "center",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

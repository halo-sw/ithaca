import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import script from "../data/script.json";
import { sceneToFrames, totalDurationInFrames } from "./timeline.js";
import { COLORS, FONT_FAMILY, MOTION, TYPE } from "./theme.js";
import { useFonts } from "./fonts.js";

// Part 2 placeholder: page colour, app type and a calm fade + short slide.
// Part 3 replaces this with the per-kind scenes.
function PlaceholderScene({ scene, durationInFrames }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, MOTION.fadeIn, durationInFrames - MOTION.fadeOut, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const dy = interpolate(frame, [0, MOTION.fadeIn], [MOTION.slidePx, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${dy}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.title,
          fontWeight: 700,
          color: COLORS.ink,
        }}
      >
        {scene.id} — {scene.kind}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.subtitle,
          color: COLORS.ink2,
        }}
      >
        {scene.start}s + {scene.duration}s
      </div>
    </AbsoluteFill>
  );
}

export function Demo() {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.page }}>
      {script.scenes.map((scene) => {
        const { from, durationInFrames } = sceneToFrames(scene, script.fps);
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={durationInFrames}
            name={scene.id}
          >
            <PlaceholderScene
              scene={scene}
              durationInFrames={durationInFrames}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        width={script.width}
        height={script.height}
        fps={script.fps}
        durationInFrames={totalDurationInFrames(script)}
      />
    </>
  );
}

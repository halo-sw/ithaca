import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import script from "../data/script.json";
import { sceneToFrames, totalDurationInFrames } from "./timeline.js";
import { COLORS, FONT_FAMILY, TYPE } from "./theme.js";
import { useFonts } from "./fonts.js";
import { TitleScene } from "./scenes/TitleScene.jsx";
import { ScreenScene } from "./scenes/ScreenScene.jsx";
import { VerifyScene } from "./scenes/VerifyScene.jsx";
import { StatsScene } from "./scenes/StatsScene.jsx";

function UnknownScene({ scene }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.subtitle,
          color: COLORS.ink2,
        }}
      >
        {scene.id}: unknown kind “{scene.kind}”
      </div>
    </AbsoluteFill>
  );
}

function Scene({ scene, durationInFrames }) {
  switch (scene.kind) {
    case "title":
      return <TitleScene scene={scene} durationInFrames={durationInFrames} />;
    case "screen":
      return <ScreenScene scene={scene} durationInFrames={durationInFrames} />;
    case "verify":
      return <VerifyScene scene={scene} durationInFrames={durationInFrames} />;
    case "stats":
      return <StatsScene scene={scene} durationInFrames={durationInFrames} />;
    default:
      return <UnknownScene scene={scene} />;
  }
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
            <Scene scene={scene} durationInFrames={durationInFrames} />
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

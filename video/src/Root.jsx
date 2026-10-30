import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import script from "../data/script.json";
import { sceneToFrames, totalDurationInFrames } from "./timeline.js";

function PlaceholderScene({ scene }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f6f4ef",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: 64,
          fontWeight: 700,
          color: "#1d1b18",
        }}
      >
        {scene.id} — {scene.kind}
      </div>
      <div style={{ fontFamily: "sans-serif", fontSize: 32, color: "#5f5a52" }}>
        {scene.start}s + {scene.duration}s
      </div>
    </AbsoluteFill>
  );
}

export function Demo() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f6f4ef" }}>
      {script.scenes.map((scene) => {
        const { from, durationInFrames } = sceneToFrames(scene, script.fps);
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={durationInFrames}
            name={scene.id}
          >
            <PlaceholderScene scene={scene} />
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

import React from "react";
import { Img, OffthreadVideo, staticFile } from "remotion";
import { assetStatus } from "../assets.js";
import assetManifest from "../assets.generated.json";
import { BORDER, COLORS, FONT_FAMILY, RADII, SHADOW, TYPE } from "../theme.js";

// A rounded card showing the scene clip (video / image) or, when the asset
// has not been recorded yet, a placeholder with the scene id + expected path.
// A clip shorter than its scene holds its last frame (the video element
// clamps past its end); a longer clip is cut by the surrounding Sequence.
// `zoom` ({ scale, tx, ty } from zoom.js) is applied as a CSS transform on
// the inner media; the card keeps overflow hidden. `startFrom` is in frames,
// `playbackRate` passes through to the video element.
export function ClipCard({
  asset,
  sceneId,
  width,
  height,
  zoom,
  startFrom = 0,
  playbackRate = 1,
  radius = RADII.screenCard,
  shadow = SHADOW,
}) {
  const status = assetStatus(asset, assetManifest.files);
  const cardStyle = {
    width,
    height,
    backgroundColor: COLORS.card,
    borderRadius: radius,
    boxShadow: shadow,
    border: status === "missing" ? `2px dashed ${COLORS.ink3}` : BORDER,
    overflow: "hidden",
    position: "relative",
    flex: "none",
  };
  const zoomStyle =
    zoom && (zoom.scale !== 1 || zoom.tx !== 0 || zoom.ty !== 0)
      ? {
          transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
        }
      : undefined;
  if (status === "video") {
    return (
      <div style={cardStyle}>
        <OffthreadVideo
          src={staticFile(asset)}
          startFrom={startFrom}
          playbackRate={playbackRate}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            ...zoomStyle,
          }}
        />
      </div>
    );
  }
  if (status === "image") {
    return (
      <div style={cardStyle}>
        <Img
          src={staticFile(asset)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            ...zoomStyle,
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        ...cardStyle,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        padding: 48,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.subtitle,
          fontWeight: 600,
          color: COLORS.ink,
        }}
      >
        {sceneId}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.callout,
          color: COLORS.ink2,
          textAlign: "center",
        }}
      >
        {asset || "(no asset)"}
      </div>
    </div>
  );
}

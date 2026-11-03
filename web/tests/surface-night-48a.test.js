// 48a textured night surface: albedo-driven ambient shared by every
// painted night entry — GPU-free (fake materials/shaders, no three.js).

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SURFACE_NIGHT_GAIN,
  SURFACE_NIGHT_KEY,
  SURFACE_NIGHT_UNIFORM,
  applySurfaceNight,
  clearSurfaceNight,
  patchSurfaceNight,
  setSurfaceNightFactor,
  surfaceNightFactor,
} from "../src/render/surface-night.js";

const COMMON_FRAG = [
  "#include <common>",
  "void main() {",
  "vec4 diffuseColor = vec4( diffuse, opacity );",
  "vec3 totalEmissiveRadiance = emissive;",
  "#include <map_fragment>",
  "#include <color_fragment>",
  "#include <emissivemap_fragment>",
  "#include <lights_physical_fragment>",
  "}",
].join("\n");

const AMBIENT_LINE =
  `totalEmissiveRadiance += diffuseColor.rgb * ${SURFACE_NIGHT_UNIFORM};`;

// Same anchors/shape as textures.js patchLitMaterial (facade windows).
function mimicFacadePatch(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader, renderer) {
    if (typeof prev === "function") prev.call(this, shader, renderer);
    shader.uniforms.uNight = { value: 0 };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>",
        "#include <common>\nuniform float uNight;\nuniform vec3 uLampColor;")
      .replace("#include <emissivemap_fragment>",
        "totalEmissiveRadiance = uLampColor * uNight;\n");
    mat.userData.shader = shader;
  };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    const p = typeof prevKey === "function" ? prevKey.call(this) : "";
    return `${p}:lit`;
  };
}

// Same anchor/shape as aerial/detail.js withDetailFragment (map blend).
function mimicDetailPatch(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader, renderer) {
    if (typeof prev === "function") prev.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.5), 0.5);\n#include <map_fragment>");
    mat.userData.shader = shader;
  };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    const p = typeof prevKey === "function" ? prevKey.call(this) : "";
    return `${p}|aerial-detail-46a`;
  };
}

function fakeMaterial() {
  return { userData: {}, needsUpdate: false };
}

function compile(mat) {
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\nvoid main() {}",
    fragmentShader: COMMON_FRAG,
  };
  mat.onBeforeCompile.call(mat, shader, null);
  return shader;
}

beforeEach(() => {
  clearSurfaceNight();
});

describe("surface-night-48a", () => {
  it("day 0 adds exactly zero: emission appearance unmodified", () => {
    const mat = fakeMaterial();
    patchSurfaceNight(mat);
    const shader = compile(mat);
    const k = applySurfaceNight(mat, 0);
    assert.equal(k, 0);
    assert.equal(shader.uniforms[SURFACE_NIGHT_UNIFORM].value, 0);
    // Albedo-driven term, present but gated: no constant colour fill.
    assert.ok(shader.fragmentShader.includes(AMBIENT_LINE));
    assert.ok(!shader.fragmentShader.includes("0x"));
    assert.equal(surfaceNightFactor(), 0);
  });

  it("night uses the processed albedo, after map/detail work", () => {
    const mat = fakeMaterial();
    patchSurfaceNight(mat);
    const shader = compile(mat);
    applySurfaceNight(mat, 1);
    assert.equal(shader.uniforms[SURFACE_NIGHT_UNIFORM].value,
      1 * SURFACE_NIGHT_GAIN);
    const frag = shader.fragmentShader;
    const at = frag.indexOf(AMBIENT_LINE);
    assert.ok(at >= 0, "ambient from diffuseColor");
    assert.ok(at < frag.indexOf("#include <lights_physical_fragment>"));
    assert.ok(frag.indexOf("#include <map_fragment>") < at,
      "night reads albedo after map processing");
  });

  it("detail already in the shader keeps working underneath night", () => {
    const mat = fakeMaterial();
    mimicDetailPatch(mat);
    patchSurfaceNight(mat);
    const shader = compile(mat);
    applySurfaceNight(mat, 1);
    assert.ok(shader.fragmentShader.includes("mix(sampledDiffuseColor.rgb"));
    const at = shader.fragmentShader.indexOf(AMBIENT_LINE);
    assert.ok(at > shader.fragmentShader.indexOf("mix(sampledDiffuseColor.rgb"),
      "night ambient reads the detail-blended albedo");
  });

  it("facade window patch survives in both registration orders", () => {
    for (const facadeFirst of [true, false]) {
      const mat = fakeMaterial();
      if (facadeFirst) {
        mimicFacadePatch(mat);
        patchSurfaceNight(mat);
      } else {
        patchSurfaceNight(mat);
        mimicFacadePatch(mat);
      }
      const shader = compile(mat);
      applySurfaceNight(mat, 1);
      assert.ok(shader.fragmentShader.includes("totalEmissiveRadiance = uLampColor"),
        `windows survive (facadeFirst=${facadeFirst})`);
      assert.ok(shader.fragmentShader.includes(AMBIENT_LINE),
        `ambient present (facadeFirst=${facadeFirst})`);
      assert.equal(shader.uniforms[SURFACE_NIGHT_UNIFORM].value, 1);
      assert.ok("uNight" in shader.uniforms);
    }
  });

  it("repeated patching is idempotent and the key is stable", () => {
    const mat = fakeMaterial();
    patchSurfaceNight(mat);
    patchSurfaceNight(mat);
    applySurfaceNight(mat, 1);
    patchSurfaceNight(mat);
    const shader = compile(mat);
    const decls = shader.fragmentShader.split(
      `uniform float ${SURFACE_NIGHT_UNIFORM};`).length - 1;
    assert.equal(decls, 1);
    const lines = shader.fragmentShader.split(AMBIENT_LINE).length - 1;
    assert.equal(lines, 1);
    const k1 = mat.customProgramCacheKey.call(mat);
    const k2 = mat.customProgramCacheKey.call(mat);
    assert.equal(k1, k2);
    assert.ok(k1.includes(SURFACE_NIGHT_KEY));
  });

  it("late destination entries land on the stored factor", () => {
    const home = fakeMaterial();
    patchSurfaceNight(home);
    compile(home);
    applySurfaceNight(home, 1);
    // Destination material arrives later, after the factor is stored.
    const late = fakeMaterial();
    const k = applySurfaceNight(late, surfaceNightFactor());
    assert.equal(k, 1);
    const shader = compile(late);
    assert.equal(shader.uniforms[SURFACE_NIGHT_UNIFORM].value, 1);
  });

  it("return to day restores: uniform back to zero, no recompile", () => {
    const mat = fakeMaterial();
    patchSurfaceNight(mat);
    const shader = compile(mat);
    applySurfaceNight(mat, 1);
    assert.equal(shader.uniforms[SURFACE_NIGHT_UNIFORM].value, 1);
    mat.needsUpdate = false;
    applySurfaceNight(mat, 0);
    assert.equal(shader.uniforms[SURFACE_NIGHT_UNIFORM].value, 0);
    assert.equal(mat.needsUpdate, false, "uniform update never recompiles");
    assert.equal(surfaceNightFactor(), 0);
  });

  it("injected code carries no division: no divide-by-zero path", () => {
    const mat = fakeMaterial();
    patchSurfaceNight(mat);
    const shader = compile(mat);
    const line = shader.fragmentShader.split("\n")
      .find((l) => l.includes(SURFACE_NIGHT_UNIFORM) && l.includes("+="));
    assert.ok(line);
    assert.ok(!line.includes("/"), `no division in: ${line}`);
  });

  it("disposed materials stop updating; live ones continue; re-patch idempotent", () => {
    function eventedMaterial() {
      const listeners = {};
      const mat = {
        userData: {},
        needsUpdate: false,
        addEventListener(type, fn) {
          (listeners[type] ??= []).push(fn);
        },
        removeEventListener(type, fn) {
          const arr = listeners[type];
          if (arr) {
            const i = arr.indexOf(fn);
            if (i >= 0) arr.splice(i, 1);
          }
        },
        dispatch(type) {
          for (const fn of [...(listeners[type] ?? [])]) fn.call(mat);
        },
      };
      return { mat, listeners };
    }
    const a = eventedMaterial();
    const b = eventedMaterial();
    patchSurfaceNight(a.mat);
    patchSurfaceNight(b.mat);
    const shaderA = compile(a.mat);
    const shaderB = compile(b.mat);
    applySurfaceNight(a.mat, 1);
    assert.equal(shaderA.uniforms[SURFACE_NIGHT_UNIFORM].value, 1);
    assert.equal(shaderB.uniforms[SURFACE_NIGHT_UNIFORM].value, 1);
    a.mat.dispatch("dispose");
    assert.equal((a.listeners.dispose ?? []).length, 0,
      "dispose listener unregisters itself");
    setSurfaceNightFactor(0.5);
    assert.equal(shaderA.uniforms[SURFACE_NIGHT_UNIFORM].value, 1,
      "disposed material shader no longer updated");
    assert.equal(shaderB.uniforms[SURFACE_NIGHT_UNIFORM].value, 0.5,
      "live material shader still updated");
    patchSurfaceNight(b.mat);
    patchSurfaceNight(b.mat);
    const shaderB2 = compile(b.mat);
    const decls = shaderB2.fragmentShader.split(
      `uniform float ${SURFACE_NIGHT_UNIFORM};`).length - 1;
    assert.equal(decls, 1);
  });
});

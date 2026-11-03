// 48a: textured night ambient shared by every painted night surface.
//
// Cause: applyPaintedNight set mat.emissive to a solid night colour while
// moonlight leaves the diffuse near black, so aerial imagery and roof
// textures disappeared beneath a flat emissive; and the facade occupancy
// patch (patchLitMaterial) replaces totalEmissiveRadiance with windows
// only, leaving unlit walls black.
//
// Fix: one chained onBeforeCompile patch (idempotent, chain-safe like the
// facade and aerial-detail patches) injects at
// `#include <lights_physical_fragment>` — after map / aerial-detail /
// vertex-colour processing AND after the facade window assignment, so all
// registration orders compose:
//
//   totalEmissiveRadiance += diffuseColor.rgb * uSurfaceNight;
//
// diffuseColor at that point is the fully processed albedo (material night
// tint x map x aerial-detail blend x vertex colours), so high-detail ground
// work and fallback land-use variation stay readable after dark. No extra
// texture fetch, no per-frame allocation: the factor is one uniform per
// compiled program, updated only when the night factor changes (never a
// recompile). Day (factor 0) adds exactly 0.0, so the day look and the
// program cache are untouched.
//
// No bounded divide is needed: the CPU tint (look.js nightTint / lerpHex)
// already maps the diffuse to the night albedo, so the in-shader ambient
// uses it directly — the "other stable method", with no division at all.
// Palette stays in look.js; this module adds no colour.

export const SURFACE_NIGHT_KEY = "surface-night-48a";
export const SURFACE_NIGHT_UNIFORM = "uSurfaceNight";

// Calm-night gain on the albedo ambient: 1 renders the authored night
// albedo as-is (textured). Above 1 would wash the lamp heads.
export const SURFACE_NIGHT_GAIN = 1;

const LIGHTS_TAG = "#include <lights_physical_fragment>";
const COMMON_TAG = "#include <common>";
const FRAG_DECL = `uniform float ${SURFACE_NIGHT_UNIFORM};`;
const NIGHT_LINE =
  `totalEmissiveRadiance += diffuseColor.rgb * ${SURFACE_NIGHT_UNIFORM};`;

const patched = new Set();
let pendingFactor = 0; // shaders compile lazily; new programs start here

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// Stored factor (late destination entries compile straight to it).
export function surfaceNightFactor() {
  return pendingFactor;
}

// Patch once per material; composes with existing onBeforeCompile /
// customProgramCacheKey (facade windows, aerial detail, fade) in either
// registration order, keeping `this` as the material.
export function patchSurfaceNight(material) {
  if (!material || typeof material !== "object") return material;
  try {
    material.userData = material.userData ?? {};
    if (material.userData[SURFACE_NIGHT_KEY]) return material;
    const prevOBC = material.onBeforeCompile;
    const prevKey = material.customProgramCacheKey;
    material.onBeforeCompile = function (shader, renderer) {
      if (typeof prevOBC === "function") prevOBC.call(this, shader, renderer);
      shader.uniforms[SURFACE_NIGHT_UNIFORM] = {
        value: pendingFactor * SURFACE_NIGHT_GAIN,
      };
      let frag = shader.fragmentShader ?? "";
      if (frag.includes(COMMON_TAG)) {
        frag = frag.replace(COMMON_TAG, `${COMMON_TAG}\n${FRAG_DECL}`);
      } else {
        frag = `${FRAG_DECL}\n${frag}`;
      }
      if (frag.includes(LIGHTS_TAG)) {
        frag = frag.replace(LIGHTS_TAG, `${NIGHT_LINE}\n${LIGHTS_TAG}`);
      }
      shader.fragmentShader = frag;
      material.userData.shader = shader;
    };
    // prevKey is usually Material.prototype.customProgramCacheKey, which
    // reads this.onBeforeCompile — it must keep the material as `this`.
    material.customProgramCacheKey = function () {
      let prev = "";
      try {
        if (typeof prevKey === "function") prev = prevKey.call(this) ?? "";
        else if (typeof prevKey === "string") prev = prevKey;
      } catch {
        prev = "";
      }
      return `${prev}|${SURFACE_NIGHT_KEY}`;
    };
    material.userData[SURFACE_NIGHT_KEY] = true;
    material.needsUpdate = true;
    patched.add(material);
    // 48c: drop disposed materials so the Set cannot retain them. The
    // listener removes only its own material and unregisters itself (no
    // renderer-wide clear). Materials without an event API skip this.
    if (typeof material.addEventListener === "function") {
      const onDispose = () => {
        patched.delete(material);
        try {
          if (typeof material.removeEventListener === "function") {
            material.removeEventListener("dispose", onDispose);
          }
        } catch {
          // ignore dead materials
        }
        try {
          if (material.userData) {
            delete material.userData[SURFACE_NIGHT_KEY];
            if (material.userData.shader) delete material.userData.shader;
          }
        } catch {
          // ignore dead materials
        }
      };
      try {
        material.addEventListener("dispose", onDispose);
      } catch {
        // ignore materials with a throwing event API
      }
    }
  } catch {
    // Frozen / fake materials stay unpatched.
  }
  return material;
}

// Factor across every patched material (0 by day): uniform stores only,
// never a recompile, never an allocation.
export function setSurfaceNightFactor(t) {
  const k = clamp01(t);
  pendingFactor = k;
  for (const m of patched) {
    try {
      const shader = m.userData ? m.userData.shader : null;
      const u = shader && shader.uniforms
        ? shader.uniforms[SURFACE_NIGHT_UNIFORM]
        : null;
      if (u) u.value = k * SURFACE_NIGHT_GAIN;
    } catch {
      // ignore dead materials
    }
  }
  return k;
}

// Patch a night-table material and carry the given factor (defaults to the
// stored one, so late destination entries land on the current night).
export function applySurfaceNight(material, t = pendingFactor) {
  const k = setSurfaceNightFactor(t);
  patchSurfaceNight(material);
  return k;
}

// Test isolation (mirrors clearTextureCache in textures.js).
export function clearSurfaceNight() {
  patched.clear();
  pendingFactor = 0;
}

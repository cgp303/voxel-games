# Performance & Memory Audit

> **Date:** 2026-11-17  ·  **Scope:** CPU / GPU efficiency, memory leaks, unused code and assets
> Read-only review — no code was changed.

## Summary

- **CPU is mostly in good shape.** Collision, debris, sparks, terrain and weapon pools are pooled and avoid per-frame allocation.
- **GPU is the main risk to 60 fps**, especially on phones (render size, materials, draw calls).
- **Biggest memory issue:** music is decoded fully into RAM.

---

## At a glance

| ID | Issue | Impact | Effort |
|----|-------|:------:|:------:|
| [G1](#g1--fixed-12801280-render-size-on-every-device) | Fixed 1280×1280 render size on all devices | 🔴 High | Medium |
| [G2](#g2--antialias-is-wasted-when-effects-are-on) | `antialias` wasted when effects are on | 🟡 Medium | Low |
| [G3](#g3--weapon-meshes-always-draw-every-slot) | Weapon meshes always draw every slot | 🔴 High | Medium |
| [G4](#g4--expensive-materials-on-simple-voxel-models) | Expensive, double-sided materials | 🟠 Med–High | Low |
| [G5](#g5--one-draw-call-per-text-character) | One draw call per text character | 🟠 Med–High | High |
| [G6](#g6--greedy-meshing-is-off) | Greedy meshing is off | 🟠 Med–High | Low |
| [G7](#g7--frustum-culling-works-by-accident) | Frustum culling works by accident | ⚪ Correctness | Low |
| [G8](#g8--camera-far-plane-beyond-fog) | Camera far plane beyond fog | 🟢 Low | Low |
| [G9](#g9--half-float-effect-buffers-on-mobile) | Half-float effect buffers on mobile | 🟡 Medium | Low |
| [C1](#c1--invader-meshes-draw-and-upload-dead-slots--fixed) | Invader meshes draw dead slots | 🟡 Medium (revised) | Medium |
| [C2](#c2--per-frame-allocation-in-boss-tracking--fixed) | Per-frame allocation in boss tracking | 🟢 Low | Low |
| [C3](#c3--small-per-frame-garbage--fixed) | Small per-frame garbage | 🟢 Low | Low |
| [C4](#c4--explosion-data-rebuilt-on-every-hit) | Explosion data rebuilt on every hit | 🟢 Low | Low |
| [C5](#c5--all-terrain-styles-built-at-startup) | All terrain styles built at startup | 🟡 Medium | Medium |
| [M1](#m1--music-decoded-fully-into-ram) | Music decoded fully into RAM | 🔴 High | Low |
| [M2](#m2--ogg-only-no-fallback) | Ogg only, no fallback | 🟡 Medium | Low |
| [M3](#m3--invader-instance-slots-can-leak--fixed-by-c1) | Invader instance slots can leak | 🟢 Low | Low |
| [M4](#m4--clear-would-dispose-a-shared-material) | `clear()` would dispose a shared material | ⚪ Latent | Low |
| [M5](#m5--window-listeners-and-debug-global) | Window listeners and debug global | 🟢 Low | Low |

---

## 1. GPU

### G1 — Fixed 1280×1280 render size on every device

- **Where:** [constants.ts](src/config/data/constants.ts) (`VIEW`), [Renderer.ts](src/scene/Renderer.ts)
- **Problem:** Phones render at the same size as desktop. With effects on, each frame draws the scene at full size, then FXAA, then a bloom-mix pass, plus a smaller bloom pipeline.
- **Fix:** Add a render-size setting to `QUALITY` (about 720–960 on mobile) and let CSS upscale. Optionally lower it automatically when frame time exceeds ~16.6 ms.

### G2 — `antialias` is wasted when effects are on

- **Where:** [Renderer.ts](src/scene/Renderer.ts)
- **Problem:** The scene is drawn into off-screen buffers, which don't get this antialiasing, and FXAA already smooths edges. The memory cost is still paid.
- **Fix:** `antialias: QUALITY.antialias && !FX.enabled`

### G3 — Weapon meshes always draw every slot

- **Where:** [InvaderWeaponPool.ts](src/systems/InvaderWeaponPool.ts)
- **Problem:** `mesh.count = config.maxCount` is permanent; hidden slots are just scaled to zero. That's 11 meshes × 32 slots, plus boss weapons (up to 50 each), processed every frame in both the main and shadow passes — even with nothing on screen.
- **Fix:** Pack live weapons into the lowest slots and set `mesh.count` to the live count, as `SparkSystem` already does.

### G4 — Expensive materials on simple voxel models

- **Where:** [constants.ts](src/config/data/constants.ts) (`INVADER_MESH_MATERIAL`), [ChunkField.ts](src/world/terrain/ChunkField.ts)
- **Problem:** Invaders, terrain and text use `MeshStandardMaterial` with `DoubleSide`. The models are closed, so back faces are wasted work; `normalScale` does nothing without a normal map.
- **Fix:** Use `FrontSide`. On mobile at least, switch to `MeshLambertMaterial` — with flat vertex colours it should look almost identical.

### G5 — One draw call per text character

- **Where:** [VoxelText.ts](src/systems/text/VoxelText.ts)
- **Problem:** Each character is its own mesh, never frustum-culled, and drawn in the main, bloom and shadow passes. The HUD alone (~20 characters) is about 60 draw calls per frame; the demo marquee adds many more.
- **Fix:** Merge each text line into one mesh (or one instanced mesh per glyph). Set `HUD.castShadow = false` — it floats in front of the camera.

### G6 — Greedy meshing is off

- **Where:** [constants.ts](src/config/data/constants.ts) (`DEFAULT_VOXEL_MESH_OPTIONS`)
- **Problem:** `greedy: false`, even though [GreedyMesher.ts](src/voxel/GreedyMesher.ts) exists and is tested.
- **Fix:** Enable it for invader, player and weapon models. It typically cuts triangles 2–5×, in every instance and every pass.

### G7 — Frustum culling works by accident

- **Where:** [AssetManager.ts](src/assets/AssetManager.ts) (`getOrCreateInstancedMesh`)
- **Problem:** three.js computes instanced-mesh bounds once, on first render. These meshes start with 0 instances, so the bounds become an empty sphere at the origin — they only draw because the origin is in view.
- **Fix:** Set `frustumCulled = false` explicitly, as debris, sparks and the boss already do.

### G8 — Camera far plane beyond fog

- **Where:** [Camera.ts](src/scene/Camera.ts)
- **Problem:** `far = 1200`, but fog hides everything past 550.
- **Fix:** Set `far` to about 600.

### G9 — Half-float effect buffers on mobile

- **Where:** [Renderer.ts](src/scene/Renderer.ts)
- **Problem:** Effect buffers default to half-float colour (~26 MB at 1280²).
- **Fix:** On mobile, give the main effect pipeline an 8-bit buffer. Keep the bloom pipeline at high precision for its brighter-than-white glow.

---

## 2. CPU

### C1 — Invader meshes draw (and upload) dead slots — ✅ fixed

- **Where:** [EntityManager.ts](src/entities/EntityManager.ts) (`acquireInvader`, `releaseToPool`), [AssetManager.ts](src/assets/AssetManager.ts)
- **Problem (revised):** The per-frame `needsUpdate` flag in `markInstancedMeshesDirty` is mostly legitimate for invaders, because live invaders move every frame, so the matrices do need uploading. The real waste was that `mesh.count` only grew. A destroyed invader's slot went on a free list and stayed inside the drawn range as a zero-scale matrix. After a big wave the mesh kept uploading and vertex-processing (main and shadow passes) up to its high-water mark.
- **Fix applied:** Live invaders are packed in slots `0..n-1` per mesh. When one is released, the last live invader's matrix is moved into its slot and `mesh.count` shrinks, as in G3. The free-slot list in `AssetManager` is removed. The blanket dirty flag is left in place, since it is cheap now that only live slots are drawn.

### C2 — Per-frame allocation in boss tracking — ✅ fixed

- **Where:** [Boss.ts](src/entities/Boss.ts) (`trackPlayer`)
- **Problem:** `this.rollQuat.clone().invert()` allocated a quaternion every frame during boss fights.
- **Fix applied:** Reuses the existing `armInverse` scratch field.

### C3 — Small per-frame garbage — ✅ fixed

- **Where:** [PlaySession.ts](src/systems/PlaySession.ts), [PlayScreen.ts](src/screens/PlayScreen.ts), [ScoreHud.ts](src/systems/text/ScoreHud.ts), [Input.ts](src/core/Input.ts)
- **Problem:**
  - `updatePlayer` built two closures and a `keys.some(...)` callback.
  - `wasAnyPressed(...DEBUG.skipWaveKeys)` created a new array.
  - `ScoreHud.update` formatted the score string even when unchanged.
- **Fix applied:** `Input` has loop-based `wasAnyPressed(keys)` and `isAnyDown(keys)`, taking an array. The closures are now module-level helpers. `ScoreHud` compares the raw numbers first and only formats when one changed.

### C4 — Explosion data rebuilt on every hit

- **Where:** [PlaySession.ts](src/systems/PlaySession.ts), [VoxelText.ts](src/systems/text/VoxelText.ts)
- **Problem:** `voxelsToCloud(...)` (falling pieces, arm weapons) and `tintedCloud` (text) allocate fresh arrays per hit.
- **Fix:** Cache per model, or per glyph and colour.

### C5 — All terrain styles built at startup

- **Where:** [App.ts](src/app/App.ts) (`styles.buildAll()`)
- **Problem:** Every style, including noise-based ones, is built at boot — slower startup and all chunk data held in memory.
- **Fix:** Build the demo style and the first level's style up front; build later ones during between-wave pauses.

---

## 3. Memory and leaks

### M1 — Music decoded fully into RAM

- **Where:** [AudioManager.ts](src/audio/AudioManager.ts), [manifests.ts](src/assets/manifests.ts)
- **Problem:** Howler uses Web Audio by default, which decodes `astro-force-psy.ogg` and `astro-force-game-track.ogg` to raw PCM (~23 MB per stereo minute at 48 kHz). Two multi-minute tracks can exceed 100 MB — a common cause of mobile Safari tab crashes. Both are also preloaded at startup.
- **Fix:** Use `html5: true` (streaming) for music and long loops, and `preload: false` for the in-game track.

### M2 — Ogg only, no fallback

- **Problem:** Older iOS Safari can't play `.ogg`.
- **Fix:** Provide `src: [ogg, mp3]`.

### M3 — Invader instance slots can leak — ✅ fixed by C1

- **Where:** [EntityManager.ts](src/entities/EntityManager.ts) (`releaseToPool`)
- **Problem:** When a pool was full (`MAX_POOL_PER_TYPE`), the instance slot wasn't returned to the free list, so the mesh's count grew until the next reset.
- **Fix applied:** Slots are now freed on every release, independent of whether the invader object is pooled.

### M4 — `clear()` would dispose a shared material

- **Where:** [AssetManager.ts](src/assets/AssetManager.ts)
- **Problem:** `clear()` → `disposeObject3D` would dispose the shared `INVADER_MESH_MATERIAL`. Nothing calls `clear()` today.
- **Fix:** Skip shared materials when disposing.

### M5 — Window listeners and debug global

- **Where:** [App.ts](src/app/App.ts), [Renderer.ts](src/scene/Renderer.ts)
- **Problem:** `resize` / `orientationchange` listeners are anonymous, so `App.stop()` can't remove them; `window.renderer` is a debug global.
- **Fix:** Store the handlers and remove them in `stop()`; expose `window.renderer` only in dev.

### ✅ Checked and clean

Dispose paths in screens, `PlaySession`, `TextFlyby`, high-score entry listeners, the boss and its arms, sparks, debris and the terrain batch. No build-up of scene objects or GPU resources across Demo → Play → Game Over cycles.

---

## 4. Unused code, assets and config

### Build output

- [vite.config.ts](vite.config.ts) builds the **bezier editor** and **group-attack tool** into production `dist`. Use a separate tools build or a mode flag.
- `sourcemap: true` ships `.js.map` files. Use `false` or `'hidden'` for release.
- `public/` contains **83 `.vxm` + 83 `.vxm.png`** VoxEdit source files, all copied to `dist`. Move them to e.g. `art-src/`.

### Unreferenced assets (still shipped)

| Type | Files |
|------|-------|
| Models | `inv1.vox`–`inv6.vox`, `inv14.vox`, `asdf.vxm`, `boss2/boss2.vox`, `boss4/boss4BU.json`, `boss4/scorpionMount.vxm*`, `font/co/` |
| Audio | `invader-lazer1a/b/c.mp3`, `gameover-b.mp3`, `mine-clonk-2.mp3`, `boss1-lazers.wav`, `mine-loop1.wav` |
| Duplicate | `mineHit` and `mineHit2` load the same file as two sounds |

### Unused packages and code

- **npm:** `gsap` and `vox-parser` are never imported (the game uses its own [VoxParser.ts](src/voxel/VoxParser.ts)).
- **Legacy code with no live callers:**
  - [EXAMPLES.ts](src/voxel-landscape/EXAMPLES.ts)
  - [FileLoader.ts](src/ui/FileLoader.ts)
  - `spawnInvaderGrid` in [PlayField.ts](src/world/PlayField.ts) and the deprecated `GAME.invader*` config
  - `getOrCreateMeshTemplate` and `VoxelGeometry.createMesh` (used only by `EXAMPLES`)
  - `stopAnimation`, `onWindowResize` and commented-out blocks in [Renderer.ts](src/scene/Renderer.ts)
- **Repo-root clutter:** `bezier-page.*`, `bezier-ts.*`, `vite-execution*.log`, `SESSION_*.md`

### Debug flags left on

In [constants.ts](src/config/data/constants.ts): `DEBUG.invinciblePlayer: true` and `DEBUG.enableWaveSkip: true`. Turn off for release or tie to `import.meta.env.DEV`.

---

## Suggested order

1. **Quick, low-risk wins** — M1, G2, G4 (`FrontSide`), G6, C2, G8, debug flags, build and asset cleanup.
2. **Biggest win for phones** — G1 (lower mobile render size, optionally adaptive).
3. **Cut draw calls and uploads** — G3 and C1 (both done: live instances are packed, `mesh.count` follows them).
4. **Larger refactors** — G5 (merged text meshes), C5 (on-demand terrain styles).

## Measuring

1. Set `DEBUG.showFPS = true`.
2. Set `MOBILE_QUALITY.mode: 'on'` and test on a mid-range Android phone.
3. Use the Chrome DevTools **Performance** panel for frame times.
4. Check draw calls with `renderer.info.render.calls` (exposed as `window.renderer`).

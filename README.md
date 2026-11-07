# Voxel Galaga — How This Project Fits Together

This README explains the **current game structure** in plain language.
It is written so you can understand what each part does, why folders exist, and where to put new code — without needing to reverse-engineer everything.

> Goal right now: **architecture clarity + invader entry intro**, not finished combat.
> A lot of folders are still **scaffolding for later** (player, shots, collision). Below separates **what is real today** from **what is reserved**.

---

## 1. What this project is (right now)

You are building a small **Galaga-style voxel game** on top of **Three.js + TypeScript + Vite**.

### What already works
- A 3D world with **procedural scrolling terrain**
- **Invader `.vox` models** loaded once and cloned per ship
- **Off-stage → formation entry intro** (mirrored L/R pairs, Bezier paths, bank/roll, dock)
- The same intro runs in **Demo** and **Play** via `PlaySession`
- Three modes (screens):
  - **Demo** — attract / title (info card + high scores) + entry intro
  - **Play** — gameplay shell (HUD, locked camera) + entry intro
  - **Game Over** — short card, then back to demo high scores
- Shared animation loop, keyboard input, score/lives object, high-score helpers

### What is NOT real gameplay yet
- No player ship movement
- No shooting / collision
- No dive AI after docking
- No win/lose from combat (**G** = fake death → cancel entry + Game Over)

So if it feels like a lot of structure for little “game,” that is fair. The foundation is in place; combat plugs in next.

---

## 2. The big idea in one picture

```
main.ts
  └─ App                         ← stage manager
       ├─ Engine                 ← one frame loop
       ├─ Scene / Camera / Renderer
       ├─ PlayField              ← terrain + invaderRoot (meshes only)
       ├─ Game                   ← score, lives, mode
       ├─ Input / EventBus       ← keys + GameEvents
       ├─ AssetManager           ← .vox templates
       └─ ScreenManager
            ├─ DemoScreen  ──┐
            ├─ PlayScreen  ──┼─ each owns a temporary PlaySession
            └─ GameOverScreen┘

PlaySession (per Demo/Play enter)
  ├─ FormationController   ← slot homes (root may drift)
  ├─ EntryDirector         ← pair queue + spawn policy
  └─ EntityManager         ← Invader actors (roster only)
```

**Important rules:**
- Only **one screen** is active at a time.
- **PlayField** stays mounted; screens do not rebuild terrain every mode change.
- **EntityManager does not** own spawn policy or formation motion — only the actor list.
- Frame order inside `PlaySession.update`: **formation → entry → entities**.

---

## 3. Boot sequence

### Entry
[`src/main.ts`](src/main.ts) — `new App()` then `app.start()`.

### App constructor
[`src/app/App.ts`](src/app/App.ts) builds shared tools (scene, engine, input, assets, game, playField, screens, context) and wires transitions.

### App.start()
1. Keyboard + Engine loop
2. `bootstrapWorld()` once:
   - scrolling terrain
   - load + **cache invader mesh template** (no static grid)
   - attach PlayField, frame camera
3. First screen = **Demo** (starts entry intro)

### Every frame
1. `playField.updateTerrain(dt, camera, fogDepth)`
2. `screens.update(dt)` → active screen → `session.update(dt)` when Demo/Play
3. `renderer.render()`
4. `input.endFrame()`

---

## 4. Screens

### Screen + ScreenManager
[`src/screens/Screen.ts`](src/screens/Screen.ts), [`ScreenManager.ts`](src/screens/ScreenManager.ts)

- `enter` / `exit` / `update`
- `set(next)` = exit active → enter next
- Always transition with `ctx.screens.set(...)`

### DemoScreen
[`src/screens/DemoScreen.ts`](src/screens/DemoScreen.ts)

- Attract display: a looping sequence of flat voxel-text displays that emerge from behind the camera and creep
  toward the horizon (HIGH SCORES → INVADER VALUES → controls → game name, which pauses at its `stopZ`)
  — see `DemoMarquee`, `DEMO*` in `constants.ts`, and `TopTenScores` for the (dummy) score data
- Free camera orbit
- **`PlaySession.start`** on enter → entry intro
- **Enter** → Play
- Dispose session on exit

### PlayScreen
[`src/screens/PlayScreen.ts`](src/screens/PlayScreen.ts)

- HUD, locked camera, `game.resetRun()`
- **Fresh `PlaySession`** on enter (intro again)
- **Esc** → Demo (session disposed; Demo enter restarts intro)
- **G** → `session.onPlayerDeath()` then Game Over

### GameOverScreen
[`src/screens/GameOverScreen.ts`](src/screens/GameOverScreen.ts)

- Timed “GAME OVER” card → Demo high scores
- Does not own a PlaySession

---

## 5. Invader entry architecture (the new core)

### PlaySession
[`src/systems/PlaySession.ts`](src/systems/PlaySession.ts)

Façade owned by Demo/Play screens:

| API | Role |
|-----|------|
| `start(ctx)` | Formation setup + begin entry queue |
| `update(dt)` | formation → entry → entities |
| `cancelEntry(reason)` | Stop new spawns; in-flight keep going |
| `onPlayerDeath()` | Cancel queue + emit `player:died` |
| `clearCombatants()` | Wipe entities/meshes without new intro |
| `restartIntro()` | Full clear + new entry (same session) |
| `dispose()` | Cancel/clear on screen exit |

### FormationController
[`src/systems/FormationController.ts`](src/systems/FormationController.ts)

- Builds slot grid from `FORMATION` (+ terrain height for hover Y)
- `getWorldHome(slot)` is **live every frame** (root can move)
- Helpers: left half, center column, mirror slot, alternating center side

### EntryDirector
[`src/systems/EntryDirector.ts`](src/systems/EntryDirector.ts)

- Queues L/R pairs (and odd center column alternating sides)
- Cadence from `ENTRY.invadersPerSecond` (2 ⇒ pair every 1s)
- Spawns: clone template → `Invader` → `playField.attachInvader` → `entities.add`
- Overlapping in-flight pairs are intentional

### Invader
[`src/entities/Invader.ts`](src/entities/Invader.ts)

- Modes: `entering` → `formation` (stubs for fire/dive later)
- Cubic Bezier with **live P3** (home moves with formation)
- Orientation: base mesh quat + look along tangent + Z bank from yaw rate
- Dock: slerp to formation rest pose

### Paths
[`src/systems/path/cubicBezier.ts`](src/systems/path/cubicBezier.ts)

- Sample position / derivative
- Build mirrored entry controls from `ENTRY` + spawn side + live home

### PlayField role
[`src/world/PlayField.ts`](src/world/PlayField.ts)

- `invaderRoot` holds meshes (static parent — **not** under scrolling terrain)
- `attachInvader` / `clearInvaders` / `getInvaderRoot`
- Legacy `spawnInvaderGrid` still exists but **App no longer uses it**

### Edge-case policy (locked)
```
Player death     → cancelEntry (queue stops; in-flight optional keep)
Esc → Demo       → dispose Play session; Demo enter = new intro
Demo / Play enter → new PlaySession.start
Screen exit      → dispose
```

### Events
[`src/app/types.ts`](src/app/types.ts) — `GameEvents`:

| Event | When |
|-------|------|
| `intro:started` | session start / restartIntro |
| `entry:cancelled` | death / manual / dispose-with-pending / restart |
| `entry:complete` | queue empty + nobody still entering |
| `player:died` | `onPlayerDeath()` |
| `invader:killed` | reserved for combat scoring |

---

## 6. Shared world vs screen UI

### Shared world = PlayField
Terrain + invader mesh root, created by App, reused across modes.

### Screen UI = temporary DOM
Demo card, Play HUD, Game Over card — created in `enter`, removed in `exit`.

**Rule:** lasting 3D → world/entities; temporary chrome → screen DOM.

---

## 7. GameContext

[`src/app/GameContext.ts`](src/app/GameContext.ts)

| Field | Meaning |
|------|---------|
| `scene` / `camera` / `renderer` | 3D stack |
| `input` | keyboard |
| `events` | EventBus (`GameEvents`) |
| `assets` | `.vox` templates |
| `game` | score, lives, mode, highScores |
| `playField` | terrain + invaderRoot |
| `screens` | mode changes |

Screens do not import `App`; they use context.

---

## 8. Core utilities

| Module | Role |
|--------|------|
| [`Engine`](src/core/Engine.ts) | Single `requestAnimationFrame` loop |
| [`Time`](src/core/Time.ts) | `delta` / `elapsed` |
| [`Input`](src/core/Input.ts) | `isDown` / `wasPressed` + `endFrame` |
| [`EventBus`](src/core/EventBus.ts) | `on` / `off` / `emit` |

Always multiply motion by `dt`.

---

## 9. Game state

[`src/app/Game.ts`](src/app/Game.ts) — scoreboard data only:

- `mode`, `score`, `lives`, `highScores`
- `resetRun()`, `addScore()`, `loseLife()`

Combat should write score via events → `Game.addScore` later (not fully wired yet).

---

## 10. Rendering

| File | Role |
|------|------|
| [`Scene`](src/scene/Scene.ts) | scene, lights, fog |
| [`Camera`](src/scene/Camera.ts) | camera + OrbitControls |
| [`Renderer`](src/scene/Renderer.ts) | WebGL draw |

- Demo: orbit enabled  
- Play / Game Over: locked  

---

## 11. Voxels and assets

- [`src/voxel/`](src/voxel/) — parse `.vox`, geometry
- [`src/assets/`](src/assets/) — load/cache by key
- [`src/voxel-landscape/`](src/voxel-landscape/) — procedural terrain
- `public/assets/vox/` — browser-fetchable files

**Invader path today:**
1. `manifests.ts` key `invader`
2. App bootstrap preloads it (`preloadManifest`, behind the preload curtain) + `getOrCreateMeshTemplate`
3. EntryDirector clones template per ship

**Terrain path:** `TerrainStyleRegistry` (builds every `TERRAIN_STYLES` entry once into a shared `ChunkLibrary`) → `new ScrollingTerrain(library, registry.get(WAVE_DEMO.terrain), …)` → `playField.setTerrain` + `playField.setTerrainStyles`.

**Terrain system** ([`src/world/terrain/`](src/world/terrain/)):
- Terrain is built from 32×8×32 voxel **chunks**. Each is greedy meshed once into a `ChunkLibrary`; its id is what styles store.
- A **style** (`ITerrainStyle`) is a wrapping 2D array of chunk ids with `introRows` (played once) and a `loopStartRow`/`loopEndRow` wrap point.
- `TerrainTrack` is the endless row sequence. `track.queueStyle(style)` (or via `playField.getTerrain()`) switches style on the next row nobody has asked for yet, i.e. beyond the fog.
- `ScrollingTerrain` draws only the rows inside the camera frustum up to the fog depth (one `BatchedMesh` draw call, per-chunk frustum culling) and answers ground height/slope queries.
- **Terrain per wave:** every wave config (`levels/waves.ts`) has a required `terrain: TerrainStyleId`. When it differs from what is showing, `PlaySession` calls `playField.requestTerrainStyle(id, seconds)` the moment the between-waves pause starts (the same moment the NEXT WAVE / BOSS text is triggered): the new style starts at the far edge and the ground speeds up (`TerrainTransition`) so that it covers the view `TERRAIN_TRANSITION.settleSeconds` after the pause ends. Tune it in `TERRAIN_TRANSITION` (constants): `settleSeconds`, `arrivalMarginZ` (how much old terrain may remain along the bottom of the view), `maxSpeedZ` (raise it if the terrain lands late; the speed needed is about distance / (pause + settle)), and the ramps. Session start and wave skip get the same deadline (never snapped). A request replaces one that has not appeared yet.
- **Edge convention:** every *neutral* chunk (procedural ones) must follow `ChunkLibrary.edgeProfile` (flat height 3 by default); `add()` rejects chunks that do not. That is what lets any neutral chunk or style sit next to any other and lets border faces be dropped.
- **Hand-authored tiles:** MagicaVoxel tiles of exactly 32×8×32 voxels (file x across, **file y up**, file z along travel; no z-up swap). Add the `.vox` to `ASSET_PATHS`, list it in an `IHandAuthoredStyleSpec` (see `ATARIA_1_STYLE` in `TerrainConfig.ts`: `tiles` are manifest keys, `grid[row][col]` indexes them) register it in `TERRAIN_STYLES` under a `TerrainStyleId` (the registry builds it from the preloaded tile models). Tiles are *open* chunks: any content, floating voxels allowed, border faces kept; neutral chunks beside them get their border faces back automatically.

---

## 12. Tunables — [`src/data/constants.ts`](src/data/constants.ts)

| Block | Controls |
|-------|----------|
| `FORMATION` | cols/rows/spacing, origin, hover, optional root velocity |
| `ENTRY` | spawn cadence, off-screen margin, Bezier bulge, path duration, bank/orient/dock |
| `VIEW` / `CAMERA` | letterbox buffer + framing |
| `DEMO` / `GAME_OVER` | panel and card timings |
| `TERRAIN` / `TERRAIN_TRANSITION` | scroll speed, belt width (`cols`), row pool (`maxRows`); terrain-change speed boost (`settleSeconds`, `arrivalMarginZ`, ramps, `maxSpeedZ`) |
| `GAME` | lives (+ deprecated legacy grid fields) |

**If the intro feels wrong, tune `ENTRY` first** (`pathDuration`, `bulgeDepth`, `bankGain`, `orientSmooth`), then `FORMATION.originZ` / `spacing`.

High scores: [`src/data/highscores.ts`](src/data/highscores.ts).

---

## 13. What is real vs scaffolding

| Area | Status |
|------|--------|
| App / Engine / Screens / PlayField | **Real** |
| Scene / Camera / Renderer / voxels / terrain | **Real** |
| `PlaySession` / `FormationController` / `EntryDirector` / `Invader` | **Real** |
| EntityManager + Entity base | **Real** (roster + movement helpers) |
| `GameEvents` on EventBus | **Real** (intro/death hooks; combat scoring later) |
| Player / shots / collision / dive AI | **Not built** |
| `ui/FileLoader.ts` | Old PoC helper |

---

## 14. Where to put new work

### Real combat (suggested order)
1. **Player ship** entity + Play input
2. **Shots** + spawn from player / invader fire stub
3. **Collision** system
4. `invader:killed` → `Game.addScore`
5. Real death → already `onPlayerDeath` + Game Over path
6. Dive / attack patterns after formation dock
7. Name entry → `trySubmitScore`

### Add a `.vox`
1. File in `public/assets/vox/`
2. Key in `manifests.ts` (`{ src, preload }`: `preload: true` loads behind the preload curtain, `false` loads in the background after it)
3. Load via AssetManager; clone template

### Change feel
Edit `FORMATION` / `ENTRY` in `constants.ts` first.

---

## 15. Player-facing flow

```
App starts
  → Demo (attract UI + entry intro)
      Enter
  → Play (HUD + fresh entry intro)
      Esc                 → Demo (fresh intro again)
      G (placeholder die) → cancel entry + Game Over (~3s)
                              → Demo on high scores
```

Controls:
- **Enter** — start play (Demo)
- **Esc** — quit play to demo
- **G** — fake death / game over
- Mouse orbit — Demo only

---

## 16. Folder map

```
src/
  main.ts
  app/           App, Game, GameContext, types (GameEvents, Entry/Formation types)
  core/          Engine, Time, Input, EventBus, viewport
  screens/       Demo, Play, GameOver + manager
  world/         PlayField, terrain/ (chunks, styles, track, scrolling belt)
  scene/         Scene, Camera, Renderer
  assets/        AssetManager, manifests
  voxel/         .vox parse + mesh
  voxel-landscape/
  data/          constants (FORMATION, ENTRY, …), highscores
  entities/      Entity, EntityManager, Invader
  systems/       PlaySession, FormationController, EntryDirector, path/cubicBezier
  ui/            legacy helpers
```

---

## 17. Eight rules to remember

1. **App** wires the universe once; **no static invader grid** at boot.
2. **Engine** owns the only frame loop.
3. **One Screen** active; Demo/Play each own a **PlaySession**.
4. **PlayField** is the shared set (terrain + invaderRoot meshes).
5. **Formation** owns homes; **EntryDirector** owns spawn policy; **EntityManager** is roster-only.
6. Frame order: **formation → entry → entities**.
7. **Game** is scoreboard data; **GameEvents** for lifecycle hooks.
8. Put combat in **Play / entities / systems**; don’t reintroduce a second main loop.

---

## 18. Commands

```bash
cd c:\voxel-game
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

Group attack set tool (authoring helper for `src/config/pattern-config/GroupAttackSets.ts`, lives in `group-attack-set-tool/`):

```bash
npm run group-tool
```

---

## 19. Milestone status

**Done:** Galaga-style invader entry (formation, Bezier pairs, orientation/bank, Demo+Play session, death/cancel hooks).

**Next gameplay:** player ship, shots, collision, scoring from kills, dive AI.

Earlier READMEs described a “load any .vox and orbit it” PoC, then a screen shell with a static invader grid. This version documents the **entry-intro architecture** that replaced the static grid.

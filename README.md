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
1. `playField.updateScroll(dt)`
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

- Attract UI (info ↔ high scores)
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
2. App bootstrap `loadManifestAsset` + `getOrCreateMeshTemplate`
3. EntryDirector clones template per ship

**Terrain path:** `TerrainService.buildScrollingPair` → `playField.setScrollingTerrain`.

---

## 12. Tunables — [`src/data/constants.ts`](src/data/constants.ts)

| Block | Controls |
|-------|----------|
| `FORMATION` | cols/rows/spacing, origin, hover, optional root velocity |
| `ENTRY` | spawn cadence, off-screen margin, Bezier bulge, path duration, bank/orient/dock |
| `VIEW` / `CAMERA` | letterbox buffer + framing |
| `DEMO` / `GAME_OVER` | panel and card timings |
| `TERRAIN` | scroll speed |
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
2. Key in `manifests.ts`
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
  world/         PlayField, TerrainService
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

---

## 19. Milestone status

**Done:** Galaga-style invader entry (formation, Bezier pairs, orientation/bank, Demo+Play session, death/cancel hooks).

**Next gameplay:** player ship, shots, collision, scoring from kills, dive AI.

Earlier READMEs described a “load any .vox and orbit it” PoC, then a screen shell with a static invader grid. This version documents the **entry-intro architecture** that replaced the static grid.

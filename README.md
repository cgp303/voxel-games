# Voxel Galaga — How This Project Fits Together

This README explains the **current game structure** in plain language.
It is written so you can understand what each part does, why folders exist, and where to put new code — without needing to reverse-engineer everything.

> Goal right now: **architecture clarity**, not “this is finished gameplay.”
> A lot of folders are **scaffolding for later**. That can feel over-engineered. Below separates **what is real today** from **what is reserved for later**.

---

## 1. What this project is (right now)

You are building a small **Galaga-style voxel game** on top of **Three.js + TypeScript + Vite**.

### What already works
- A 3D world with **procedural terrain**
- A grid of **invader models** loaded from `.vox` files
- Three “modes” (screens):
  - **Demo** — attract / title mode (info card + high scores)
  - **Play** — gameplay mode shell (HUD, locked camera)
  - **Game Over** — short “GAME OVER” card, then back to demo high scores
- One shared animation loop
- Keyboard input
- Score / lives state object (ready for real combat later)
- High-score save/load helpers (`localStorage`)

### What is NOT real gameplay yet
- No player ship movement
- No shooting
- No collision
- No enemy AI
- No win/lose from actual combat (press **G** as a fake “game over”)

So if it feels like a lot of structure for little “game,” that is fair. The structure is the foundation. Gameplay gets plugged into it.

---

## 2. The big idea in one picture

Think of the app like a stage play:

```
main.ts
  └─ App                    ← the stage manager / producer
       ├─ Engine            ← the metronome (one frame loop forever)
       ├─ Scene/Camera/Renderer  ← the stage + lights + camera + projector
       ├─ PlayField         ← the set (terrain + invaders), stays up
       ├─ Game              ← the scoreboard (score, lives, mode)
       ├─ Input / EventBus  ← controllers / walkie-talkies
       ├─ AssetManager      ← prop closet (.vox models)
       └─ ScreenManager     ← “which act is on stage?”
            ├─ DemoScreen
            ├─ PlayScreen
            └─ GameOverScreen
```

**Important rule:**
- Only **one screen** is active at a time.
- The **world** (terrain + invaders) is shared and usually stays mounted.
- Each screen owns its own **UI overlay** (DOM cards/HUD) and cleans it up when it leaves.

---

## 3. Boot sequence (what happens when you run the game)

### Entry
[`src/main.ts`](src/main.ts)

This file is intentionally tiny:

1. `new App()`
2. `app.start()`

It does **not** build the world. It just starts the app.

### App constructor
[`src/app/App.ts`](src/app/App.ts)

App builds the shared toolbox:

- Three.js **scene**, **camera**, **renderer**
- **Engine** (frame loop)
- **Input**, **EventBus**
- **AssetManager**
- **Game** (score/lives/mode)
- **PlayField** + **TerrainService**
- The three screens
- A **GameContext** object (the backpack of shared tools every screen gets)
- Wires screen transitions:
  - Demo → Play
  - Play → Demo **and** Play → GameOver
  - GameOver → Demo

### App.start()
1. Starts keyboard listening
2. Starts the Engine loop
3. Bootstraps the world once:
   - generate terrain
   - load invader `.vox`
   - spawn invader grid on PlayField
   - frame the camera
4. Sets the first screen to **Demo**

### Every frame after that
Engine calls App’s tick, which does:

1. `screens.update(deltaSeconds)`  ← active screen logic
2. `renderer.render()`             ← draw 3D
3. `input.endFrame()`              ← clear “just pressed” keys
4. update FPS label

That is the whole heartbeat.

---

## 4. Screens: the “phases” of the game

### What a Screen is
[`src/screens/Screen.ts`](src/screens/Screen.ts)

A screen is just an object with:

- `id` — name (`'demo'`, `'play'`, `'game_over'`)
- `enter(ctx)` — turn this mode on (create UI, set camera rules, set `game.mode`)
- `exit()` — clean up this mode’s stuff (remove HUD/card)
- `update(dt)` — run every frame while active
- optional `resize()`

Screens do **not** own the whole engine. They borrow tools from `GameContext`.

### ScreenManager
[`src/screens/ScreenManager.ts`](src/screens/ScreenManager.ts)

This is the traffic cop:

- only one active screen
- `set(nextScreen)` does:
  1. `active.exit()`
  2. make `next` active
  3. `next.enter(ctx)`
- blocks overlapping transitions with a `transitioning` flag

If you want to change modes, almost always do:

```ts
ctx.screens.set(someScreen)
```

Do **not** invent a second animation loop or a second “main game class.”

---

### DemoScreen (`id: 'demo'`)
[`src/screens/DemoScreen.ts`](src/screens/DemoScreen.ts)

**Job:** attract mode / title loop over the shared world.

**Does:**
- sets `game.mode = 'demo'`
- enables free camera orbit (look around)
- shows a centered green terminal-style card
- swaps every few seconds between:
  - **info** (controls + invader point values)
  - **high scores**
- **Enter** starts Play

**Does not:**
- run combat
- destroy the terrain/invaders when leaving (world stays)

**Handy method:**
- `showHighScores()` — jump straight to high-score panel (used after Game Over)

Timing constant: `DEMO.attractPanelSeconds` in [`src/data/constants.ts`](src/data/constants.ts)

---

### PlayScreen (`id: 'play'`)
[`src/screens/PlayScreen.ts`](src/screens/PlayScreen.ts)

**Job:** gameplay mode shell.

**Does:**
- sets `game.mode = 'play'`
- calls `game.resetRun()` (score 0, lives reset)
- locks camera (no orbit during play)
- shows top-left HUD (`SCORE`, `LIVES`, key hints)
- **Esc** → back to Demo (**skips** Game Over)
- **G** → Game Over screen (placeholder for real death/win later)

**Where real gameplay should go later:**
- create player / bullets / systems in `enter()`
- move/shoot/collide in `update(dt)`
- dispose them in `exit()`

Right now Play is mostly “mode + HUD + transition keys.”

---

### GameOverScreen (`id: 'game_over'`)
[`src/screens/GameOverScreen.ts`](src/screens/GameOverScreen.ts)

**Job:** short interstitial card between real game end and demo cycling.

**Does:**
- sets `game.mode = 'game_over'`
- keeps camera locked
- shows “GAME OVER” card
- waits `GAME_OVER.displaySeconds` (currently 3s)
- then goes to Demo and calls `showHighScores()`

**Does not (by design):**
- skip on key press
- handle Esc quit (Esc is handled in Play and goes straight to Demo)

---

## 5. Shared world vs screen UI (this is the key mental model)

### Shared world = PlayField
[`src/world/PlayField.ts`](src/world/PlayField.ts)

PlayField is one Three.js group that holds:
- terrain mesh
- invader root group (all invader clones)

It is created by App and reused by Demo/Play/GameOver.

Why?
- so switching modes does not rebuild the whole landscape every time
- Demo can show the same battlefield as Play

Built by:
1. [`TerrainService`](src/world/TerrainService.ts) → generates terrain mesh from config
2. [`AssetManager`](src/assets/AssetManager.ts) → loads invader model
3. `playField.spawnInvaderGrid(template)` → clones invaders into a grid

### Screen UI = temporary DOM
Examples:
- Demo overlay card
- Play HUD
- Game Over card

These are HTML `div`s appended to `document.body`, removed on `exit()`.
They sit **on top of** the WebGL canvas. They are not 3D meshes.

**Rule of thumb**
- lasting 3D stuff → world / entities / scene
- temporary menus/HUD → screen DOM overlay

---

## 6. GameContext: the backpack every screen gets

[`src/app/GameContext.ts`](src/app/GameContext.ts)

When a screen enters, it receives one object with everything shared:

| Field | Meaning |
|------|---------|
| `scene` | Three.js scene wrapper |
| `camera` | camera + orbit controls |
| `renderer` | draws the frame |
| `input` | keyboard state |
| `events` | pub/sub bus (ready, barely used yet) |
| `assets` | load/cache `.vox` meshes |
| `game` | score, lives, mode, highScores |
| `playField` | shared terrain + invaders |
| `screens` | request screen changes |

This is why screens don’t import `App` directly.
They ask the context for tools.

If something feels “hard to reach” from a screen, first check: **should it be on GameContext?**

---

## 7. Core systems (the always-on utilities)

### Engine
[`src/core/Engine.ts`](src/core/Engine.ts)

Owns the **only** `requestAnimationFrame` loop.

App registers one tick callback. Engine:
1. updates Time
2. calls that callback

Do not start another loop in Renderer or screens.

### Time
[`src/core/Time.ts`](src/core/Time.ts)

Gives you:
- `delta` — seconds since last frame (use this for movement)
- `elapsed` — total time since engine start

Always multiply motion by `dt` so speed stays stable if FPS dips.

### Input
[`src/core/Input.ts`](src/core/Input.ts)

Keyboard helper:
- `isDown('ArrowLeft')` — held this frame
- `wasPressed('Enter')` — pressed **this** frame only
- `endFrame()` — clears edge presses (App does this every frame)

Screens should use this instead of adding their own `keydown` listeners (unless you have a special case).

### EventBus
[`src/core/EventBus.ts`](src/core/EventBus.ts)

Simple `on` / `off` / `emit`.
It exists so systems can talk without hard-wiring everything.
**Currently almost unused.** You can ignore it until gameplay needs messages like `"playerDied"` or `"invaderKilled"`.

---

## 8. Game state (scoreboard, not rendering)

[`src/app/Game.ts`](src/app/Game.ts)

Holds:
- `mode`: `'demo' | 'play' | 'game_over'`
- `score`
- `lives`
- `highScores`

Helpers:
- `resetRun()` — new play session
- `addScore(points)`
- `loseLife()` — returns `true` if dead (`lives <= 0`)

Screens set `mode` on enter.
FPS label also shows mode, which is handy while debugging.

This is **data**, not graphics.

---

## 9. Rendering stack (the 3D side)

| File | Role |
|------|------|
| [`src/scene/Scene.ts`](src/scene/Scene.ts) | Three.js scene, lights, fog helpers |
| [`src/scene/Camera.ts`](src/scene/Camera.ts) | camera + OrbitControls |
| [`src/scene/Renderer.ts`](src/scene/Renderer.ts) | WebGL draw / post-process |

Mental model:
- **Scene** = what exists
- **Camera** = from where you look
- **Renderer** = take a photo each frame

Camera policy by mode:
- Demo: controls enabled (browse)
- Play / Game Over: controls disabled (locked)

---

## 10. Voxels and assets (how models get into the world)

### Folders
- [`src/voxel/`](src/voxel/) — parse `.vox`, store voxels, build mesh geometry
- [`src/assets/`](src/assets/) — higher-level loading/caching by name
- [`src/voxel-landscape/`](src/voxel-landscape/) — procedural terrain generator (noise, palette, config)
- `public/assets/vox/` — files the browser can fetch in dev/build

### Typical asset path
1. Register path in [`src/assets/manifests.ts`](src/assets/manifests.ts)  
   example: `invader: 'assets/vox/inv5.vox'`
2. `assets.loadManifestAsset('invader')`
3. parser reads `.vox`
4. voxels → geometry (with face culling)
5. `getOrCreateMeshTemplate('invader')`
6. clone that template into the scene / PlayField

### Terrain path
1. pick a config (example: `CRYSTAL_TERRAIN_CONFIG`)
2. `TerrainService.buildStatic(config)`
3. `playField.setTerrain(result)`
4. camera framing via `playField.frameCamera(...)`

You usually do world bootstrap in App once, not inside every screen.

---

## 11. Data helpers

### Constants
[`src/data/constants.ts`](src/data/constants.ts)

Central knobs:
- invader grid size
- camera framing factors
- demo panel swap time
- game-over card duration

If you are hardcoding magic numbers in screens, consider moving them here.

### High scores
[`src/data/highscores.ts`](src/data/highscores.ts)

Already has:
- `loadHighScores()`
- `saveHighScores()`
- `trySubmitScore(name, score)`

Demo reads `game.highScores`.
App loads them at startup.

Name-entry UI is not built yet. Saving after a real run is a small glue step when you want it.

---

## 12. What is “real” vs “empty scaffolding”

This is the anti-confusion chart.

| Area | Status | Meaning |
|------|--------|---------|
| App / Engine / Screens / PlayField | **Real** | Use these now |
| Scene / Camera / Renderer | **Real** | Use these now |
| Voxel load + mesh build | **Real** | Use these now |
| Terrain generation | **Real** | Use these now |
| Demo / Play / GameOver flow | **Real** | Use these now |
| Game score/lives object | **Real data shell** | Ready for combat to write into |
| High score storage helpers | **Real** | UI/submit flow incomplete |
| `entities/` | **Stub** | Base classes only; no Player/Bullet yet |
| `systems/` | **Empty reserved folder** | Put collision/AI/etc later |
| EventBus | **Built, mostly idle** | Optional until needed |
| `ui/FileLoader.ts` | **Old PoC helper** | From earlier “load any .vox” demo era |

### Why it feels over-engineered
Because the project is structured like a **growing game**, while current behavior is still mostly:
- show world
- switch modes
- show cards

That is normal for an early phase. You do **not** need to fill every folder tomorrow.

**Practical rule:**
- put code where the responsibility already lives
- only create new systems/entities when Play logic starts hurting as one file

---

## 13. Where should I put new work?

### Add / change a mode (screen)
1. Make `src/screens/MyScreen.ts` implementing `Screen`
2. Construct it in `App`
3. Wire `setTransitions(...)`
4. Transition with `ctx.screens.set(myScreen)`

### Add real gameplay
Mostly in **PlayScreen** first:
- spawn player mesh in `enter`
- read input in `update`
- move objects with `dt`
- on death: `ctx.screens.set(gameOverScreen)`

When PlayScreen gets fat, split out:
- `entities/Player.ts`
- `systems/CollisionSystem.ts`
- maybe events on EventBus

### Add a new `.vox` model
1. Put file in `public/assets/vox/`
2. Add key to `manifests.ts`
3. Load via AssetManager
4. Clone mesh template into scene/PlayField/entity

### Save a score after a run
Before/after moving to Game Over (your choice):

```ts
import { trySubmitScore } from '../data/highscores';
ctx.game.highScores = trySubmitScore('AAA', ctx.game.score);
```

Demo high-score panel will show updated list once `game.highScores` is refreshed.

### Change timings / feel knobs
Edit [`src/data/constants.ts`](src/data/constants.ts) first.

---

## 14. Current player-facing flow

```
App starts
  → Demo (info ↔ high scores every few seconds)
      Enter
  → Play (HUD, locked camera)
      Esc                 → Demo immediately
      G (placeholder end) → Game Over card (~3s)
                              → Demo on high scores panel
```

Controls today:
- **Enter** start play (from Demo)
- **Esc** quit play to demo
- **G** fake game over
- mouse orbit only in Demo

---

## 15. Folder map (quick reference)

```
src/
  main.ts                 Entry: new App().start()
  app/
    App.ts                Builds everything, starts loop, boots world
    Game.ts               Score/lives/mode state
    GameContext.ts        Shared tools injected into screens
    types.ts              Shared types (GameMode, ScoreEntry)
  core/
    Engine.ts             Single rAF loop
    Time.ts               delta/elapsed
    Input.ts              keyboard polling
    EventBus.ts           pub/sub (mostly future)
  screens/
    Screen.ts             Interface
    ScreenManager.ts      One active screen
    DemoScreen.ts         Attract mode
    PlayScreen.ts         Gameplay mode shell
    GameOverScreen.ts     Timed game-over card
  world/
    PlayField.ts          Shared terrain + invader group
    TerrainService.ts     Builds terrain mesh for PlayField
  scene/
    Scene.ts Camera.ts Renderer.ts
  assets/
    AssetManager.ts       Load/cache models by key
    manifests.ts          Key → file path table
  voxel/                  .vox parse + voxel mesh building
  voxel-landscape/        Procedural terrain generation
  data/
    constants.ts          Tunables
    highscores.ts         localStorage score helpers
  entities/               Future gameplay objects (stub)
  systems/                Future gameplay systems (empty)
  ui/                     Old/helper UI bits
```

---

## 16. “If I only remember 8 rules”

1. **App** wires the universe once.
2. **Engine** owns time and the frame loop.
3. **Only one Screen** is active.
4. **PlayField** is the shared 3D set.
5. **Screens own temporary UI**, and must clean it up in `exit()`.
6. **GameContext** is how screens reach shared tools.
7. **Game** is scoreboard state, not rendering.
8. Put new combat code in **Play first**; extract entities/systems when it gets messy.

---

## 17. Getting started commands

```bash
cd c:\voxel-game
npm install
npm run dev
```

Then open the local Vite URL (usually `http://localhost:5173`).

Build:

```bash
npm run build
npm run preview
```

---

## 18. How to think about “next implementation” without drowning

A sane order:

1. **Player ship** in Play (mesh + left/right move)
2. **Shooting** (spawn bullet entities)
3. **Hit tests** (bullet vs invader)
4. **Score/lives** updates through `Game`
5. Real death → already-built **GameOver** path
6. Optional name entry → `trySubmitScore`
7. Only then deeper systems (AI patterns, waves, audio, etc.)

You do **not** need to fill `systems/` or perfect EventBus before that.

---

## 19. Old README note

Earlier versions of this file described a simpler “load any .vox and orbit it” proof of concept.
The project has since grown into a **screen-based game shell** with shared world + demo/play/game-over flow.
This document is the current map of that shell.

---

## 20. License / refs

- Three.js, Vite, TypeScript stack
- MagicaVoxel `.vox` models via parser pipeline
- See package.json for exact dependency versions

If something in the code disagrees with this README, trust the code and update this file — this is a guide, not a compiler.

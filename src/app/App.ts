import '../style.css';
import * as THREE from 'three';
import { GameScene } from '../scene/Scene';
import { AudioEventTrigger } from '../audio/AudioEventTrigger';
import { GameCamera } from '../scene/Camera';
import { GameRenderer } from '../scene/Renderer';
import { Engine } from '../core/Engine';
import { Input } from '../core/Input';
import { EventBus } from '../core/EventBus';
import { AssetManager } from '../assets/AssetManager';
import { VoxelFont } from '../systems/text/VoxelFont';
import type { AssetKey } from '../assets/manifests';
import { ScreenManager } from '../screens/ScreenManager';
import { DemoScreen } from '../screens/DemoScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { GameOverScreen } from '../screens/GameOverScreen';
import { HighScoreEntryScreen } from '../screens/HighScoreEntryScreen';
import { TopTenScores } from '../config/data/TopTenScores';
import { Game } from './Game';
import type { IGameContext, IHandAuthoredStyleSpec, IParsedVoxModel, ITerrainStyle } from '../config/interfaces/interfaces';
import { loadHighScores } from '../config/data/highscores';
import { PlayField } from '../world/PlayField';
import { ChunkLibrary } from '../world/terrain/ChunkLibrary';
import { ScrollingTerrain } from '../world/terrain/ScrollingTerrain';
import { buildProceduralStyle } from '../world/terrain/ProceduralStyleBuilder';
import { buildHandAuthoredStyle } from '../world/terrain/HandAuthoredStyle';
import { ATARI_STYLE, ATARIA_1_STYLE, CRYSTAL_STYLE, STEEL_BLOCK_STYLE } from '../voxel-landscape/TerrainConfig';
import { VIEW, INSTANCED_ASSETS, BOSS, HUD, MOBILE_QUALITY_ACTIVE, MOBILE_CONTROLS, MOBILE_CONTROLS_ACTIVE, TERRAIN, QUALITY } from '../config/data/constants';
import { computeMobileLayout, getUiRoot } from '../core/viewport';
import { MobileControlHud } from '../ui/MobileControlHud';
import { ScoreHud } from '../systems/text/ScoreHud';
import { AudioManager } from '../audio/AudioManager';
import { Preloader } from '../ui/Preloader';


/**
 * Application root: builds shared core + world, wires Engine loop, starts Demo.
 * Top-level screens: Demo (attract + high scores), Play, and Game Over.
 */
export class App {
    private readonly scene: GameScene;
    private readonly renderer: GameRenderer;
    private readonly camera: GameCamera;

    private readonly engine = new Engine();
    private readonly input = new Input();
    private readonly events = new EventBus();
    private readonly assets = new AssetManager();
    private readonly font = new VoxelFont();
    private readonly game = new Game();
    private readonly screens = new ScreenManager();
    private readonly playField = new PlayField();
    private readonly preloader = new Preloader();

    private readonly demoScreen = new DemoScreen();
    private readonly playScreen = new PlayScreen();
    private readonly gameOverScreen = new GameOverScreen();
    private readonly highScoreEntryScreen = new HighScoreEntryScreen();

    private fpsDisplay: HTMLDivElement | null = null;
    private scoreHud: ScoreHud | null = null;
    private mobileControlHud: MobileControlHud | null = null;
    private frameCount = 0;
    private fpsLastMs = performance.now();
    private worldReady = false;
    private audioEventTrigger: AudioEventTrigger | null = null;
    private audioManager: AudioManager | null = null;

    constructor() {
        this.scene = new GameScene();
        this.renderer = new GameRenderer(this.scene, null);


        this.camera = new GameCamera(this.renderer);
        this.renderer.setCamera(this.camera);
        this.audioManager = new AudioManager();

        this.audioEventTrigger = new AudioEventTrigger(this.events, this.audioManager);
        this.audioEventTrigger.attach();

        this.demoScreen.setTransitions(this.playScreen);
        this.playScreen.setTransitions(this.demoScreen, this.gameOverScreen);
        this.gameOverScreen.setTransitions(this.demoScreen, this.highScoreEntryScreen);
        this.highScoreEntryScreen.setTransitions(this.demoScreen);

        const ctx: IGameContext = {
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            input: this.input,
            events: this.events,
            assets: this.assets,
            font: this.font,
            game: this.game,
            playField: this.playField,
            screens: this.screens,
        };
        this.screens.setContext(ctx);

        this.game.highScores = loadHighScores();
        this.createFpsDisplay();

        if (MOBILE_CONTROLS_ACTIVE) {
            this.mobileControlHud = new MobileControlHud(this.input, MOBILE_CONTROLS);
            this.input.setAutoFireEnabled(MOBILE_CONTROLS.autoFire);
        }

        // Initial frame fit (Renderer also fits in ctor; re-assert after FPS mount)
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('orientationchange', () => this.onResize());
    }

    public async start(): Promise<void> {
        // Live scores load alongside the world so the first demo can show them; failures keep the cached table.
        void TopTenScores.fetchFromServer();

        this.input.start();
        this.input.setTapListening(MOBILE_CONTROLS_ACTIVE && MOBILE_CONTROLS.tapToStart);

        // Engine owns the only animation loop (do not call renderer.startAnimation)
        this.engine.setTick((time) => {
            this.playField.updateTerrain(time.delta, this.camera.camera, this.terrainFogDepth());
            this.screens.update(time.delta);
            this.scoreHud?.update();
            this.mobileControlHud?.update();
            this.renderer.render();
            this.input.endFrame();
            this.updateFps();
        });
        this.engine.start();

        try {
            await this.bootstrapWorld();
        } catch (err) {
            console.error('[App] world bootstrap failed:', err);
        }

        await this.preloader.finish();
        this.assets.loadBackground();
        this.audioManager?.loadBackground();

        await this.screens.set(this.demoScreen);
        console.log('[App] started — Demo attract + invader entry intro');
    }

    public stop(): void {
        this.engine.stop();
        this.input.stop();
        this.audioEventTrigger?.detach();
        this.audioEventTrigger = null;
        this.scoreHud?.dispose();
        this.scoreHud = null;
        this.mobileControlHud?.dispose();
        this.mobileControlHud = null;
        this.screens.getActive()?.exit();
    }

    /** Builds a style from hand-authored tiles, loading their models through the asset manifest first. */
    private async buildHandAuthoredStyle(library: ChunkLibrary, spec: IHandAuthoredStyleSpec): Promise<ITerrainStyle> {
        const models: Record<string, IParsedVoxModel> = {};
        await Promise.all(
            spec.tiles.map(async (key) => {
                models[key] = await this.assets.loadManifestAsset(key as AssetKey);
            }),
        );
        return buildHandAuthoredStyle(library, spec, models);
    }

    /** Generate terrain, load invader mesh, attach PlayField once. */
    private async bootstrapWorld(): Promise<void> {
        if (this.worldReady) return;

        console.log('[App] generating terrain…');
        const buildStart = performance.now();
        const library = new ChunkLibrary();
        const style = buildProceduralStyle(library, CRYSTAL_STYLE);
        //const style = await this.buildHandAuthoredStyle(library, ATARIA_1_STYLE);
        const terrain = new ScrollingTerrain(library, style, {
            cols: TERRAIN.cols,
            maxRows: TERRAIN.maxRows,
            rowMargin: TERRAIN.rowMargin,
            framingDepth: TERRAIN.framingDepth,
            castShadow: QUALITY.terrainCastShadow,
        });
        this.playField.setTerrain(terrain);
        console.log(
            `[App] terrain "${style.name}": ${library.size} unique chunks of ${style.cols * style.rows} in ${(performance.now() - buildStart).toFixed(0)} ms`,
        );

        this.scene.setTerrainDimensions({
            w: terrain.bounds.width,
            h: terrain.bounds.height,
            d: terrain.bounds.depth,
        });
        this.scene.createLights();

        console.log('[App] preloading assets…');
        const track = this.preloader.track;
        // Every load is registered in this tick (before any is awaited) so the preload bar never moves backwards.
        await Promise.all([
            // Instanced meshes are built below, so their models are needed whatever their manifest flag says.
            this.assets.preloadManifest(track, INSTANCED_ASSETS.map(({ key }) => key as AssetKey)),
            this.font.load(this.assets, track),
            // A boss that fails to load only costs that boss (its wave ends at once), so the rest of the game still runs.
            ...BOSS.ids.map((id) =>
                track(this.assets.loadBoss(id)).catch((err) => console.error(`[App] boss "${id}" failed to load:`, err)),
            ),
            this.audioManager?.preload(track),
        ]);
        // Cache mesh template for EntryDirector / PlaySession (Phase 5+).
        // Combat invaders are not pre-placed; Demo/Play intro spawns them off-stage.


        // this.assets.getOrCreateMeshTemplate('invader1');

        // Pre-create instanced meshes for configured assets
        for (const { key, maxCount } of INSTANCED_ASSETS) {
            const mesh = this.assets.getOrCreateInstancedMesh(key, maxCount);
            this.scene.scene.add(mesh);
        }

        this.playField.attachTo(this.scene.scene);
        this.playField.frameCamera(this.camera);

        // The score / lives readout lives for the whole run of the app, across every screen.
        this.scoreHud = new ScoreHud(this.font, this.scene.scene, this.camera.camera, this.game, HUD);

        // Demo can free-look; Play will lock controls on enter
        this.camera.controls.enabled = true;

        this.worldReady = true;
        console.log(
            `[App] world ready — ${terrain.bounds.width}-wide chunk terrain, invader template cached (no static grid)`,
        );
    }

    /** Depth at which the fog fully hides the ground; the terrain is only built that far. */
    private terrainFogDepth(): number {
        const fog = this.scene.scene.fog;
        return fog instanceof THREE.Fog ? fog.far : this.camera.camera.far;
    }

    private onResize(): void {
        if (this.mobileControlHud) {
            const layout = computeMobileLayout(window.innerWidth, window.innerHeight, MOBILE_CONTROLS);
            this.renderer.applyFrameToWindow(layout.game);
            this.mobileControlHud.layout(layout);
        } else {
            this.renderer.applyFrameToWindow();
        }
        this.camera.onWindowResize();
        this.screens.resize(VIEW.internalWidth, VIEW.internalHeight);
    }

    private createFpsDisplay(): void {
        const el = document.createElement('div');
        el.id = 'fps-display';
        el.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: #00ff00;
      padding: 10px 15px;
      font-family: monospace;
      font-size: 36px;
      z-index: 100;
      border: 1px solid #00ff00;
      pointer-events: none;
    `;
        el.textContent = 'FPS: —';
        getUiRoot().appendChild(el);
        this.fpsDisplay = el;
    }

    private updateFps(): void {
        this.frameCount++;
        const now = performance.now();
        if (now >= this.fpsLastMs + 1000) {
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = `FPS: ${this.frameCount} | ${this.game.mode}${MOBILE_QUALITY_ACTIVE ? ' | mobile' : ''}`;
            }
            this.frameCount = 0;
            this.fpsLastMs = now;
        }
    }
}

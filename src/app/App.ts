import '../style.css';
import { GameScene } from '../scene/Scene';
import { GameCamera } from '../scene/Camera';
import { GameRenderer } from '../scene/Renderer';
import { Engine } from '../core/Engine';
import { Input } from '../core/Input';
import { EventBus } from '../core/EventBus';
import { AssetManager } from '../assets/AssetManager';
import { ScreenManager } from '../screens/ScreenManager';
import { DemoScreen } from '../screens/DemoScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { GameOverScreen } from '../screens/GameOverScreen';
import { Game } from './Game';
import type { GameContext } from './GameContext';
import { loadHighScores } from '../data/highscores';
import { TerrainService } from '../world/TerrainService';
import { PlayField } from '../world/PlayField';
import { CRYSTAL_TERRAIN_CONFIG } from '../voxel-landscape/TerrainConfig';
import { VIEW } from '../data/constants';
import { getUiRoot } from '../core/viewport';


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
    private readonly game = new Game();
    private readonly screens = new ScreenManager();
    private readonly terrainService = new TerrainService();
    private readonly playField = new PlayField();

    private readonly demoScreen = new DemoScreen();
    private readonly playScreen = new PlayScreen();
    private readonly gameOverScreen = new GameOverScreen();

    private fpsDisplay: HTMLDivElement | null = null;
    private frameCount = 0;
    private fpsLastMs = performance.now();
    private worldReady = false;

    constructor() {
        this.scene = new GameScene();
        this.renderer = new GameRenderer(this.scene, null);
        this.camera = new GameCamera(this.renderer);
        this.renderer.setCamera(this.camera);

        this.demoScreen.setTransitions(this.playScreen);
        this.playScreen.setTransitions(this.demoScreen, this.gameOverScreen);
        this.gameOverScreen.setTransitions(this.demoScreen);

        const ctx: GameContext = {
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            input: this.input,
            events: this.events,
            assets: this.assets,
            game: this.game,
            playField: this.playField,
            screens: this.screens,
        };
        this.screens.setContext(ctx);

        this.game.highScores = loadHighScores();
        this.createFpsDisplay();

        // Initial frame fit (Renderer also fits in ctor; re-assert after FPS mount)
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }

    public async start(): Promise<void> {
        this.input.start();

        // Engine owns the only animation loop (do not call renderer.startAnimation)
        this.engine.setTick((time) => {
            this.playField.updateScroll(time.delta);
            this.screens.update(time.delta);
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

        await this.screens.set(this.demoScreen);
        console.log('[App] started — Demo attract + invader entry intro');
    }

    public stop(): void {
        this.engine.stop();
        this.input.stop();
        this.screens.getActive()?.exit();
    }

    /** Generate terrain, load invader mesh, attach PlayField once. */
    private async bootstrapWorld(): Promise<void> {
        if (this.worldReady) return;

        console.log('[App] generating scrolling terrain…');
        const terrain = this.terrainService.buildScrollingPair(CRYSTAL_TERRAIN_CONFIG);
        this.playField.setScrollingTerrain(terrain);

        this.scene.setTerrainDimensions({
            w: terrain.width,
            h: terrain.height,
            d: terrain.tileDepth,
        });
        this.scene.createLights();

        console.log('[App] loading invader asset…');
        await this.assets.loadManifestAsset('invader1');
        // Cache mesh template for EntryDirector / PlaySession (Phase 5+).
        // Combat invaders are not pre-placed; Demo/Play intro spawns them off-stage.
        this.assets.getOrCreateMeshTemplate('invader1');

        this.playField.attachTo(this.scene.scene);
        this.playField.frameCamera(this.camera);

        // Demo can free-look; Play will lock controls on enter
        this.camera.controls.enabled = true;

        this.worldReady = true;
        console.log(
            `[App] world ready — terrain ${terrain.width}x${terrain.tileDepth} (x2 scroll), invader template cached (no static grid)`,
        );
    }

    private onResize(): void {
        this.renderer.applyFrameToWindow();
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
      font-size: 12px;
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
                this.fpsDisplay.textContent = `FPS: ${this.frameCount} | ${this.game.mode}`;
            }
            this.frameCount = 0;
            this.fpsLastMs = now;
        }
    }
}

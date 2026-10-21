import type { IGameContext, IScreen, ILevelProgress } from '../config/interfaces/interfaces';
import { PlaySession } from '../systems/PlaySession';
import type { DemoScreen } from './DemoScreen';
import type { GameOverScreen } from './GameOverScreen';
import { createBasicLevels } from '../systems/stages/levels-basic';
import { BOSS_WAVE_TEXT, DEBUG, NEXT_LEVEL_FLYBY, NEXT_LEVEL_TEXT } from '../config/data/constants';
import { TextFlyby } from '../systems/text/TextFlyby';

/**
 * Gameplay mode over the shared PlayField.
 * Restarts the invader entry intro on each enter; Esc returns to Demo (intro restarts there).
 */
export class PlayScreen implements IScreen {
  public readonly id = 'play';

  private ctx: IGameContext | null = null;
  private demoScreen: DemoScreen | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private session: PlaySession | null = null;
  private hud: HTMLDivElement | null = null;
  /** Centre-screen voxel text flown past between waves. Each runs on its own clock, so several can overlap. */
  private readonly flybys: TextFlyby[] = [];
  private wasBetweenWaves = false;

  // Last values written to the HUD; refreshHud() skips the DOM write when unchanged.
  private hudScore = NaN;
  private hudLives = NaN;
  private hudStageState = -1;
  private hudLevelIndex = -2;
  private hudWaveIndex = -2;
  private readonly progressScratch: ILevelProgress = { levelIndex: 0, levelName: '', waveIndex: 0, waveCount: 0 };

  public setTransitions(demo: DemoScreen, gameOver: GameOverScreen): void {
    this.demoScreen = demo;
    this.gameOverScreen = gameOver;
  }

  public enter(ctx: IGameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'play';
    ctx.game.resetRun();

    ctx.playField.attachTo(ctx.scene.scene);
    // Lock camera for play; free-look stays on Demo
    ctx.camera.controls.enabled = false;

    this.session?.dispose();
    this.session = new PlaySession();
    this.session.start(ctx, {
      levels: createBasicLevels(),
      spawnPlayer: true,
    });


    this.ensureHud();
    this.refreshHud();
    console.log('[PlayScreen] enter — entry intro; Esc=Demo, G=GameOver');
  }

  public exit(): void {
    this.session?.dispose();
    this.session = null;
    this.destroyHud();
    this.clearFlybys();
    if (this.ctx) {
      this.ctx.camera.controls.enabled = true;
    }
    this.ctx = null;
    console.log('[PlayScreen] exit');
  }

  public update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.demoScreen || !this.gameOverScreen) return;

    this.session?.update(dt);
    this.refreshHud();
    this.updateFlybys(dt);

    if (this.session?.gameOver) {
      this.handOverToGameOver(ctx);
      return;
    }
    // Quit play → Demo: session disposed on exit; Demo enter starts a fresh intro
    if (ctx.input.wasPressed('Escape')) {
      void ctx.screens.set(this.demoScreen);
      return;
    }

    // Test hook: dispose all invaders and jump to the next wave / level
    if (DEBUG.enableWaveSkip && ctx.input.wasAnyPressed(...DEBUG.skipWaveKeys)) {
      this.session?.advanceWave();
    }

    // Placeholder player-death / game-over path
    if (ctx.input.wasPressed('g') || ctx.input.wasPressed('G')) {
      this.session?.onPlayerDeath();
      this.handOverToGameOver(ctx);
    }
  }

  /**
   * Switches to the game over screen, which takes over the running session so the player's explosion and the
   * remaining invaders stay on screen (it disposes the session when it exits).
   */
  private handOverToGameOver(ctx: IGameContext): void {
    const gameOver = this.gameOverScreen;
    const session = this.session;
    if (!gameOver || !session) return;
    this.session = null;
    gameOver.adoptSession(session);
    void ctx.screens.set(gameOver);
  }

  private ensureHud(): void {
    if (this.hud) return;
    const el = document.createElement('div');
    el.id = 'play-hud';
    el.style.cssText = [
      'position: absolute',
      'top: 20px',
      'left: 20px',
      'background: rgba(0, 0, 0, 0.7)',
      'color: #7CFF7C',
      'padding: 10px 14px',
      'font-family: Courier New, monospace',
      'font-size: 14px',
      'z-index: 90',
      'border: 1px solid #00ff66',
      'pointer-events: none',
    ].join(';');
    document.getElementById('ui-root')?.appendChild(el);
    this.hud = el;
  }

  private destroyHud(): void {
    this.hud?.remove();
    this.hud = null;
    this.hudScore = NaN; // force a rewrite when the HUD is next created
  }

  /** Starts a voxel text flyby (BOSS when a boss fight follows, otherwise NEXT LEVEL) as each between-waves pause begins. */
  private updateFlybys(dt: number): void {
    const ctx = this.ctx;
    const session = this.session;
    const betweenWaves = session?.isBetweenWaves ?? false;
    if (ctx && session && betweenWaves && !this.wasBetweenWaves) {
      const display = session.nextWaveIsBoss ? BOSS_WAVE_TEXT : NEXT_LEVEL_TEXT;
      this.flybys.push(new TextFlyby(ctx.font, ctx.scene.scene, ctx.camera.camera, display, NEXT_LEVEL_FLYBY));
    }
    this.wasBetweenWaves = betweenWaves;

    for (let i = this.flybys.length - 1; i >= 0; i--) {
      if (this.flybys[i].update(dt)) this.flybys.splice(i, 1);
    }
  }

  private clearFlybys(): void {
    for (const flyby of this.flybys) flyby.dispose();
    this.flybys.length = 0;
    this.wasBetweenWaves = false;
  }

  /** Rewrites the DOM only when a displayed value changed (avoids per-frame text/DOM churn). */
  private refreshHud(): void {
    if (!this.hud || !this.ctx) return;
    const g = this.ctx.game;

    const stageState = this.session?.isStageCancelled()
      ? 1
      : this.session?.isStageComplete()
        ? 2
        : 0;

    const progress = this.session?.getProgress(this.progressScratch) ?? null;
    const levelIndex = progress ? progress.levelIndex : -1;
    const waveIndex = progress ? progress.waveIndex : -1;

    if (
      g.score === this.hudScore &&
      g.lives === this.hudLives &&
      stageState === this.hudStageState &&
      levelIndex === this.hudLevelIndex &&
      waveIndex === this.hudWaveIndex
    ) {
      return;
    }
    this.hudScore = g.score;
    this.hudLives = g.lives;
    this.hudStageState = stageState;
    this.hudLevelIndex = levelIndex;
    this.hudWaveIndex = waveIndex;

    const entryNote = stageState === 1 ? '  STAGE:cancelled' : stageState === 2 ? '  STAGE:ok' : '';
    const waveNote = progress
      ? `  ${progress.levelName} W${progress.waveIndex + 1}/${progress.waveCount}`
      : '';
    const skipNote = DEBUG.enableWaveSkip ? '  L=NextWave' : '';

    this.hud.textContent =
      'SCORE ' + g.score + '   LIVES ' + g.lives + '   ESC=Demo  G=Die' + skipNote + waveNote + entryNote;
  }

}

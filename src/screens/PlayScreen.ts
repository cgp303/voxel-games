import type { IGameContext, IScreen, ILevelProgress } from '../config/interfaces/interfaces';
import { PlaySession } from '../systems/PlaySession';
import type { DemoScreen } from './DemoScreen';
import type { GameOverScreen } from './GameOverScreen';
import { createBasicLevels } from '../systems/stages/levels-basic';
import { DEBUG } from '../config/data/constants';

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
      levels: createBasicLevels()
    });


    this.ensureHud();
    this.refreshHud();
    console.log('[PlayScreen] enter — entry intro; Esc=Demo, G=GameOver');
  }

  public exit(): void {
    this.session?.dispose();
    this.session = null;
    this.destroyHud();
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

    // Quit play → Demo: session disposed on exit; Demo enter starts a fresh intro
    if (ctx.input.wasPressed('Escape')) {
      void ctx.screens.set(this.demoScreen);
      return;
    }

    // Test hook: dispose all invaders and jump to the next wave / level
    if (DEBUG.enableWaveSkip && ctx.input.wasPressed(DEBUG.skipWaveKey)) {
      this.session?.advanceWave();
    }

    // Placeholder player-death / game-over path
    if (ctx.input.wasPressed('g') || ctx.input.wasPressed('G')) {
      this.session?.onPlayerDeath();
      void ctx.screens.set(this.gameOverScreen);
    }
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
    const skipNote = DEBUG.enableWaveSkip ? '  SPACE=NextWave' : '';

    this.hud.textContent =
      'SCORE ' + g.score + '   LIVES ' + g.lives + '   ESC=Demo  G=Die' + skipNote + waveNote + entryNote;
  }

}

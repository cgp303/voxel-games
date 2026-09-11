import type { GameContext } from '../app/GameContext';
import { PlaySession } from '../systems/PlaySession';
import type { Screen } from './Screen';
import type { DemoScreen } from './DemoScreen';
import type { GameOverScreen } from './GameOverScreen';
import { createBasicStages } from '../systems/stages/stages-basic';

/**
 * Gameplay mode over the shared PlayField.
 * Restarts the invader entry intro on each enter; Esc returns to Demo (intro restarts there).
 */
export class PlayScreen implements Screen {
  public readonly id = 'play';

  private ctx: GameContext | null = null;
  private demoScreen: DemoScreen | null = null;
  private gameOverScreen: GameOverScreen | null = null;
  private session: PlaySession | null = null;
  private hud: HTMLDivElement | null = null;

  public setTransitions(demo: DemoScreen, gameOver: GameOverScreen): void {
    this.demoScreen = demo;
    this.gameOverScreen = gameOver;
  }

  public enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'play';
    ctx.game.resetRun();

    ctx.playField.attachTo(ctx.scene.scene);
    // Lock camera for play; free-look stays on Demo
    ctx.camera.controls.enabled = false;

    this.session?.dispose();
    this.session = new PlaySession();
    this.session.start(ctx, {
      stageQueue: createBasicStages()
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
  }

  private refreshHud(): void {
    if (!this.hud || !this.ctx) return;
    const g = this.ctx.game;

    const entryNote = this.session?.isStageCancelled()
      ? '  STAGE:cancelled'
      : this.session?.isStageComplete()
        ? '  STAGE:ok'
        : '';

    this.hud.textContent =
      'SCORE ' + g.score + '   LIVES ' + g.lives + '   ESC=Demo  G=Die' + entryNote;
  }

}

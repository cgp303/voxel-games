import type { GameContext } from '../app/GameContext';
import type { Screen } from './Screen';
import type { DemoScreen } from './DemoScreen';

/**
 * Gameplay mode over the shared PlayField.
 * Phase 2: world visible, orbit locked; player/combat later.
 */
export class PlayScreen implements Screen {
  public readonly id = 'play';

  private ctx: GameContext | null = null;
  private demoScreen: DemoScreen | null = null;
  private hud: HTMLDivElement | null = null;

  public setTransitions(demo: DemoScreen): void {
    this.demoScreen = demo;
  }

  public enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'play';
    ctx.game.resetRun();

    ctx.playField.attachTo(ctx.scene.scene);
    // Lock camera for play; free-look stays on Demo
    ctx.camera.controls.enabled = false;

    this.ensureHud();
    this.refreshHud();
    console.log('[PlayScreen] enter — Esc returns to Demo');
  }

  public exit(): void {
    this.destroyHud();
    if (this.ctx) {
      this.ctx.camera.controls.enabled = true;
    }
    this.ctx = null;
    console.log('[PlayScreen] exit');
  }

  public update(_dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.demoScreen) return;

    this.refreshHud();

    if (ctx.input.wasPressed('Escape')) {
      void ctx.screens.set(this.demoScreen);
      return;
    }

    // Placeholder game-over: return to demo on high-score attract panel
    if (ctx.input.wasPressed('g') || ctx.input.wasPressed('G')) {
      void ctx.screens.set(this.demoScreen).then(() => {
        this.demoScreen?.showHighScores();
      });
    }
  }

  private ensureHud(): void {
    if (this.hud) return;
    const el = document.createElement('div');
    el.id = 'play-hud';
    el.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: #7CFF7C;
      padding: 10px 14px;
      font-family: "Courier New", monospace;
      font-size: 14px;
      z-index: 90;
      border: 1px solid #00ff66;
      pointer-events: none;
    `;
    document.body.appendChild(el);
    this.hud = el;
  }

  private destroyHud(): void {
    this.hud?.remove();
    this.hud = null;
  }

  private refreshHud(): void {
    if (!this.hud || !this.ctx) return;
    const g = this.ctx.game;
    this.hud.textContent = `SCORE ${g.score}   LIVES ${g.lives}   ESC=Demo  G=GameOver`;
  }
}

import type { GameContext } from '../app/GameContext';
import { GAME_OVER } from '../data/constants';
import type { DemoScreen } from './DemoScreen';
import type { Screen } from './Screen';

/**
 * Brief interstitial after a real game end.
 * Shows a GAME OVER card for a few seconds, then hands off to Demo high scores.
 */
export class GameOverScreen implements Screen {
  public readonly id = 'game_over';

  private ctx: GameContext | null = null;
  private demoScreen: DemoScreen | null = null;
  private elapsed = 0;
  private overlay: HTMLDivElement | null = null;
  private finished = false;

  public setTransitions(demo: DemoScreen): void {
    this.demoScreen = demo;
  }

  public enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'game_over';
    this.elapsed = 0;
    this.finished = false;

    ctx.playField.attachTo(ctx.scene.scene);
    // Keep play-style lock during the interstitial
    ctx.camera.controls.enabled = false;

    this.ensureOverlay();
    this.renderPanel();
    console.log('[GameOverScreen] enter — timed card, then Demo high scores');
  }

  public exit(): void {
    this.destroyOverlay();
    this.ctx = null;
    console.log('[GameOverScreen] exit');
  }

  public update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.demoScreen || this.finished) return;

    this.elapsed += dt;
    if (this.elapsed >= GAME_OVER.displaySeconds) {
      this.finished = true;
      const demo = this.demoScreen;
      void ctx.screens.set(demo).then(() => {
        demo.showHighScores();
      });
    }
  }

  private ensureOverlay(): void {
    if (this.overlay) return;

    const el = document.createElement('div');
    el.id = 'game-over-overlay';
    el.style.cssText = `
      position: fixed;
      left: 50%;
      top: 42%;
      transform: translate(-50%, -50%);
      min-width: 280px;
      max-width: min(420px, 90vw);
      padding: 24px 28px;
      background: rgba(0, 0, 0, 0.82);
      color: #7CFF7C;
      font-family: "Courier New", monospace;
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
      border: 2px solid #00ff66;
      box-shadow: 0 0 24px rgba(0, 255, 100, 0.25);
      z-index: 50;
      pointer-events: none;
      white-space: pre-line;
    `;
    document.body.appendChild(el);
    this.overlay = el;
  }

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private renderPanel(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = [
      '<div style="font-size:18px;letter-spacing:0.12em;margin-bottom:12px;color:#b8ffb8">VOXEL GALAGA</div>',
      '<div style="opacity:0.9;margin-bottom:8px">— GAME OVER —</div>',
    ].join('');
  }
}

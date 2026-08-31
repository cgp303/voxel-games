import type { GameContext } from '../app/GameContext';
import type { ScoreEntry } from '../app/types';
import { DEMO } from '../data/constants';
import type { Screen } from './Screen';
import type { PlayScreen } from './PlayScreen';

/** Attract panels cycled on the demo screen */
export type DemoAttractPanel = 'info' | 'highscores';

/**
 * Attract / title mode over the shared PlayField.
 * Alternates info (controls + invader values) and high scores every few seconds.
 */
export class DemoScreen implements Screen {
  public readonly id = 'demo';

  private ctx: GameContext | null = null;
  private playScreen: PlayScreen | null = null;

  private panel: DemoAttractPanel = 'info';
  private panelElapsed = 0;
  private overlay: HTMLDivElement | null = null;

  public setTransitions(play: PlayScreen): void {
    this.playScreen = play;
  }

  public enter(ctx: GameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'demo';
    this.panel = 'info';
    this.panelElapsed = 0;

    // Shared world stays mounted; demo allows orbit look-around
    ctx.playField.attachTo(ctx.scene.scene);
    ctx.camera.controls.enabled = true;

    this.ensureOverlay();
    this.renderPanel();
    console.log('[DemoScreen] enter — attract over terrain; Enter starts Play');
  }

  public exit(): void {
    this.destroyOverlay();
    this.ctx = null;
    console.log('[DemoScreen] exit');
  }

  public update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    if (ctx.input.wasPressed('Enter') && this.playScreen) {
      void ctx.screens.set(this.playScreen);
      return;
    }

    this.panelElapsed += dt;
    if (this.panelElapsed >= DEMO.attractPanelSeconds) {
      this.panelElapsed = 0;
      this.panel = this.panel === 'info' ? 'highscores' : 'info';
      this.renderPanel();
    }
  }

  /** Jump straight to high-score panel (e.g. after game over returns to demo) */
  public showHighScores(): void {
    this.panel = 'highscores';
    this.panelElapsed = 0;
    this.renderPanel();
  }

  private ensureOverlay(): void {
    if (this.overlay) return;

    const el = document.createElement('div');
    el.id = 'demo-attract-overlay';
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
    if (!this.overlay || !this.ctx) return;

    if (this.panel === 'info') {
      this.overlay.innerHTML = this.buildInfoHtml();
    } else {
      this.overlay.innerHTML = this.buildHighScoresHtml(this.ctx.game.highScores);
    }
  }

  private buildInfoHtml(): string {
    return [
      '<div style="font-size:18px;letter-spacing:0.12em;margin-bottom:12px;color:#b8ffb8">VOXEL GALAGA</div>',
      '<div style="opacity:0.9;margin-bottom:8px">— CONTROLS —</div>',
      '← → / A D   Move\n',
      'Space / Z     Fire\n',
      'Enter         Start\n',
      '<div style="margin:14px 0 8px;opacity:0.9">— INVADER VALUES —</div>',
      'Scout     50\n',
      'Fighter  100\n',
      'Elite    200\n',
      'Boss     800\n',
      `<div style="margin-top:16px;font-size:12px;opacity:0.65">Swaps to high scores in ${DEMO.attractPanelSeconds}s</div>`,
    ].join('');
  }

  private buildHighScoresHtml(scores: ScoreEntry[]): string {
    const header = [
      '<div style="font-size:18px;letter-spacing:0.12em;margin-bottom:12px;color:#b8ffb8">HIGH SCORES</div>',
    ];

    if (scores.length === 0) {
      return header
        .concat([
          '<div style="opacity:0.8;margin:12px 0">No scores yet</div>',
          '<div style="opacity:0.8">Be the first</div>',
          `<div style="margin-top:16px;font-size:12px;opacity:0.65">Swaps to info in ${DEMO.attractPanelSeconds}s</div>`,
        ])
        .join('');
    }

    const rows = [...scores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((entry, i) => {
        const rank = String(i + 1).padStart(2, ' ');
        const name = (entry.name || '---').slice(0, 10).padEnd(10, ' ');
        const score = String(entry.score).padStart(6, ' ');
        return `<div style="text-align:left;font-variant-numeric:tabular-nums">${rank}  ${escapeHtml(name)}  ${score}</div>`;
      });

    return header
      .concat(rows)
      .concat([
        `<div style="margin-top:16px;font-size:12px;opacity:0.65">Swaps to info in ${DEMO.attractPanelSeconds}s</div>`,
      ])
      .join('');
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import type { IGameContext, IScreen } from '../config/interfaces/interfaces';
import { PlaySession } from '../systems/PlaySession';
import type { DemoScreen } from './DemoScreen';
import type { GameOverScreen } from './GameOverScreen';
import { createBasicLevels } from '../systems/stages/levels-basic';
import { BOSS_WAVE_TEXT, DEBUG, NEXT_LEVEL_FLYBY, NEXT_LEVEL_TEXT } from '../config/data/constants';
import { TextFlyby } from '../systems/text/TextFlyby';
import { GameEvents } from '../config/types/types';
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
  /** Centre-screen voxel text flown past between waves. Each runs on its own clock, so several can overlap. */
  private readonly flybys: TextFlyby[] = [];
  private wasBetweenWaves = false;

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

    // play game start jingle
    ctx.events.emit(GameEvents.gameStart);

    console.log('[PlayScreen] enter — entry intro; Esc=Demo, G=GameOver');
  }

  public exit(): void {
    this.session?.dispose();
    this.session = null;
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

  /** Starts a voxel text flyby (BOSS when a boss fight follows, otherwise NEXT LEVEL) as each between-waves pause begins. */
  private updateFlybys(dt: number): void {
    const ctx = this.ctx;
    const session = this.session;
    const betweenWaves = session?.isBetweenWaves ?? false;
    if (ctx && session && betweenWaves && !this.wasBetweenWaves) {
      let display;
      if (session.nextWaveIsBoss) {
        display = BOSS_WAVE_TEXT;
        this.ctx?.events.emit(GameEvents.bossWave);
      } else {
        display = NEXT_LEVEL_TEXT;
        this.ctx?.events.emit(GameEvents.nextWave);
      }

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
}

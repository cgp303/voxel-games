import type { IGameContext, IScreen } from '../config/interfaces/interfaces';
import * as THREE from 'three';
import { EXPLOSION, GAME_OVER, GAME_OVER_ASSEMBLY, GAME_OVER_TEXT } from '../config/data/constants';
import { DebrisRenderer } from '../systems/fx/DebrisRenderer';
import { DebrisSystem } from '../systems/fx/DebrisSystem';
import { VoxelAssembler } from '../systems/text/VoxelAssembler';
import type { PlaySession } from '../systems/PlaySession';
import { VoxelText } from '../systems/text/VoxelText';
import { placeTextInFrontOfCamera } from '../systems/text/placeText';
import type { DemoScreen } from './DemoScreen';

/**
 * Interstitial after a real game end. It takes over the play session, so the player's explosion (which it
 * overlaps by GAME_OVER.overlapSeconds) and the remaining invaders stay on screen.
 * GAME OVER is built from glowing voxels that swoop in from all around; once it is whole it is shown for a few
 * seconds, then the letters (and, optionally, the invaders) explode and the screen hands off to the Demo high scores.
 */
export class GameOverScreen implements IScreen {
  public readonly id = 'game_over';

  private ctx: IGameContext | null = null;
  private demoScreen: DemoScreen | null = null;
  private text: VoxelText | null = null;
  private assembler: VoxelAssembler | null = null;
  private assemblyView: DebrisRenderer | null = null;
  private debris: DebrisSystem | null = null;
  /** The play session that ended in game over; kept running so its explosion and invaders stay visible. */
  private session: PlaySession | null = null;
  /** Time the finished text has been shown (seconds). */
  private elapsed = 0;
  /** Time since the last letter exploded (seconds). */
  private explodeTimer = 0;
  /** Time since the last remaining invader exploded (seconds). */
  private invaderTimer = 0;
  private nextChar = 0;
  private finished = false;

  public setTransitions(demo: DemoScreen): void {
    this.demoScreen = demo;
  }

  /** Takes over the play session that ended in game over; call just before switching to this screen. */
  public adoptSession(session: PlaySession): void {
    this.session?.dispose();
    this.session = session;
  }

  public enter(ctx: IGameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'game_over';
    this.elapsed = 0;
    this.explodeTimer = GAME_OVER.explodeIntervalSec;
    this.invaderTimer = GAME_OVER.invaderExplodeIntervalSec;
    this.nextChar = 0;
    this.finished = false;

    ctx.playField.attachTo(ctx.scene.scene);
    // Keep play-style lock during the interstitial
    ctx.camera.controls.enabled = false;

    this.text = new VoxelText(ctx.font, GAME_OVER_TEXT);
    this.text.setText(GAME_OVER_TEXT.text);
    placeTextInFrontOfCamera(this.text, ctx.camera.camera, GAME_OVER_TEXT);
    ctx.scene.scene.add(this.text.group);

    // The finished letters stay hidden while loose voxels build them.
    this.text.setVisible(false);
    this.assembler = new VoxelAssembler(
      this.text.worldVoxelCloud(),
      this.text.voxelSize,
      this.text.group.getWorldQuaternion(new THREE.Quaternion()),
      ctx.camera.camera,
      GAME_OVER_ASSEMBLY,
    );
    this.assemblyView = new DebrisRenderer(this.assembler.count);
    this.assemblyView.mesh.name = 'VoxelAssembler';
    this.assemblyView.mesh.castShadow = true;
    this.assemblyView.mesh.receiveShadow = true;
    this.assemblyView.sync(this.assembler);
    ctx.scene.scene.add(this.assemblyView.mesh);

    // The letters are debris-sized by the text scale, and fall onto the shared terrain.
    this.debris = new DebrisSystem(ctx.playField, {
      ...EXPLOSION,
      maxParticles: GAME_OVER.maxDebris,
      particleSize: GAME_OVER_TEXT.scale,
    });
    ctx.scene.scene.add(this.debris.mesh);

    console.log('[GameOverScreen] enter — voxel text, letters explode, then Demo high scores');
  }

  public exit(): void {
    this.text?.dispose();
    this.text = null;
    this.assembler = null;
    this.assemblyView?.dispose();
    this.assemblyView = null;
    this.debris?.dispose();
    this.debris = null;
    this.session?.dispose();
    this.session = null;
    this.ctx = null;
    console.log('[GameOverScreen] exit');
  }

  public update(dt: number): void {
    const ctx = this.ctx;
    const text = this.text;
    const debris = this.debris;
    if (!ctx || !text || !debris || !this.demoScreen || this.finished) return;

    debris.update(dt);
    // The adopted play session keeps running so the player's explosion and the invaders carry on behind the text.
    this.session?.update(dt);

    const assembler = this.assembler;
    if (assembler && this.assemblyView) {
      assembler.update(dt);
      this.assemblyView.sync(assembler);
      if (!assembler.done) return;
      text.setVisible(true);
      this.assemblyView.dispose();
      this.assemblyView = null;
      this.assembler = null;
      return;
    }

    this.elapsed += dt;
    if (this.elapsed < GAME_OVER.displaySeconds) return;

    // One letter per interval, first to last.
    this.explodeTimer += dt;
    while (this.nextChar < text.charCount && this.explodeTimer >= GAME_OVER.explodeIntervalSec) {
      this.explodeTimer -= GAME_OVER.explodeIntervalSec;
      text.explodeChar(this.nextChar++, debris);
    }

    // The remaining invaders blow up one at a time, in random order, alongside the letters.
    const session = this.session;
    if (session && GAME_OVER.explodeInvaders) {
      this.invaderTimer += dt;
      while (this.invaderTimer >= GAME_OVER.invaderExplodeIntervalSec) {
        this.invaderTimer -= GAME_OVER.invaderExplodeIntervalSec;
        if (!session.explodeRandomInvader()) {
          this.invaderTimer = 0;
          break;
        }
      }
    }

    const invadersGone = !session || !GAME_OVER.explodeInvaders || session.invaderCount === 0;
    const sessionQuiet = !session || !session.hasActiveDebris;
    if (this.nextChar >= text.charCount && debris.activeCount === 0 && invadersGone && sessionQuiet) {
      this.finished = true;
      const demo = this.demoScreen;
      void ctx.screens.set(demo).then(() => {
        demo.showHighScores();
      });
    }
  }
}

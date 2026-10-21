import type { IGameContext, IScreen } from '../config/interfaces/interfaces';
import { DEMO, DEMO_TABLE_STYLE, DEMO_TEXT, DEMO_TITLE_STYLE, INVADER_TYPES } from '../config/data/constants';
import { TopTenScores } from '../config/data/TopTenScores';
import { PlaySession } from '../systems/PlaySession';
import { DemoMarquee, type IMarqueeSlide } from '../systems/text/DemoMarquee';
import { leaderRow } from '../systems/text/leaderRow';
import type { VoxelFont } from '../systems/text/VoxelFont';
import type { PlayScreen } from './PlayScreen';
import { createWave } from '../systems/stages/WaveFactory';
import { WAVE_DEMO } from '../systems/stages/levels/waves';

/**
 * Attract / title mode over the shared PlayField.
 * Plays a looping sequence of voxel-text displays (high scores, invader values, controls, the game's name)
 * that emerge from behind the camera, and runs the same off-stage → formation invader intro as Play.
 */
export class DemoScreen implements IScreen {
  public readonly id = 'demo';

  private ctx: IGameContext | null = null;
  private playScreen: PlayScreen | null = null;
  private session: PlaySession | null = null;
  private marquee: DemoMarquee | null = null;

  public setTransitions(play: PlayScreen): void {
    this.playScreen = play;
  }

  public enter(ctx: IGameContext): void {
    this.ctx = ctx;
    ctx.game.mode = 'demo';

    // Shared world stays mounted; demo allows orbit look-around
    ctx.playField.attachTo(ctx.scene.scene);
    ctx.camera.controls.enabled = true;

    this.session?.dispose();
    this.session = new PlaySession();
    this.session.start(ctx, {
      stageQueue: createWave(WAVE_DEMO)
    });

    this.marquee = new DemoMarquee(ctx.font, ctx.scene.scene, ctx.camera.camera, buildSlides(ctx.font), DEMO);
    this.marquee.start();
    console.log('[DemoScreen] enter — attract intro + terrain; Enter starts Play');
  }

  public exit(): void {
    this.session?.dispose();
    this.session = null;
    this.marquee?.dispose();
    this.marquee = null;
    this.ctx = null;
    console.log('[DemoScreen] exit');
  }

  public update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    this.session?.update(dt);
    this.marquee?.update(dt);

    if (ctx.input.wasPressed('Enter') && this.playScreen) {
      void ctx.screens.set(this.playScreen);
    }
  }
}

/** The sequence, in order: high scores, invader values, controls, then the game's name (which loops back to the scores). */
function buildSlides(font: VoxelFont): IMarqueeSlide[] {
  const { highScores, invaderValues, controls, gameTitle } = DEMO_TEXT;
  return [
    {
      style: DEMO_TABLE_STYLE,
      lines: () => [
        highScores.title,
        '',
        ...TopTenScores.getScores().map((row) => leaderRow(font, row.name, String(row.score), highScores.rowWidth)),
      ],
    },
    {
      style: DEMO_TABLE_STYLE,
      lines: () => [
        invaderValues.title,
        '',
        ...invaderValues.invaders.map(({ name, type }) =>
          leaderRow(font, name, String(INVADER_TYPES[type].scoreValue), invaderValues.rowWidth),
        ),
      ],
    },
    { style: DEMO_TABLE_STYLE, lines: () => controls },
    { style: DEMO_TITLE_STYLE, lines: () => [gameTitle] },
  ];
}

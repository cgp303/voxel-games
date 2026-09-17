import type { Object3D } from 'three';
import type {
    FormationConfig,
    IntroStartedPayload,
    StageCancelledPayload,
} from '../app/types';
import { GameEvents } from '../app/types';
import type { GameContext } from '../app/GameContext';
import { EntityManager } from '../entities/EntityManager';
import { EntryPatternDirector } from './patterns/directors/EntryPatternDirector';
import { FormationController } from './FormationController';
import type { PatternDirector } from './patterns/interfaces';
import { Stage } from './stages/Stage';
import { StageQueue } from './stages/StageQueue';

export interface PlaySessionStartOptions {
    /** Asset key for invader mesh template (default: 'invader'). */
    invaderAssetKey?: string;
    formation?: Partial<FormationConfig>;
    stageQueue?: StageQueue;

}

/**
 * Owns one intro/combat simulation slice: formation + entry director + entities.
 * Screens call start / update / restartIntro / dispose; they do not own the sub-pieces.
 *
 * Frame order:
 *   1. formation.update  — live homes move first
 *   2. entry.update      — may spawn pairs
 *   3. entities.update   — path follow / dock to live homes
 *
 * Edge-case hooks (Phase 9):
 * - cancelEntry / onPlayerDeath — stop new spawns (queue cleared; in-flight keep going)
 * - restartIntro — full clear + new entry (in-mode retry)
 * - dispose — cancel + clear everything (screen exit)
 * - Demo/Play screen enter creates a fresh session (Esc→Demo restarts intro that way)
 */
export class PlaySession {
    public readonly invaders = new EntityManager();
    public readonly formation = new FormationController();

    private ctx: GameContext | null = null;
    private template: Object3D | null = null;
    private invaderAssetKey = 'invader1';
    private formationOverride: Partial<FormationConfig> = {};
    private started = false;

    private stageQueue: StageQueue | null = null;
    private currentStage: Stage | null = null;
    private director: PatternDirector | null = null;


    /**
     * Clear field, setup formation from terrain height, begin first stage
     */
    public start(ctx: GameContext, options: PlaySessionStartOptions = {}): void {
        this.ctx = ctx;

        this.invaderAssetKey = options.invaderAssetKey ?? 'invader1';
        this.formationOverride = options.formation ?? {};

        this.template = ctx.assets.getOrCreateMeshTemplate(this.invaderAssetKey);

        this.stageQueue = options.stageQueue ?? null;

        if (this.stageQueue) {
            this.currentStage = this.stageQueue.next();
            this.director = this.currentStage.director;
        } else {
            // Fallback mode: demo screen or legacy behavior
            this.director = new EntryPatternDirector();
        }

        this.bootIntro('start');
        this.started = true;
    }

    /**
     * Tear down actors and run the off-stage → formation intro again
     * on the same session instance (in-mode retry).
     * Demo/Play transitions typically dispose + new PlaySession instead.
     */
    public restartIntro(): void {
        if (!this.ctx || !this.template) {
            throw new Error('PlaySession.restartIntro: call start(ctx) first');
        }
        this.bootIntro('restart');
    }

    // /**
    //  * Stop scheduling new entry spawns. In-flight invaders keep flying/docking
    //  * unless the caller also clearCombatants() or dispose().
    //  */
    // public cancelEntry(reason: EntryCancelledPayload['reason'] = 'manual'): void {
    //     if (!this.started) return;
    //     if (this.entryDirector?.isCancelled() && this.entryDirector.queueRemaining === 0) return;

    //     this.entryDirector?.cancel();
    //     this.ctx?.events.emit(GameEvents.entryCancelled, {
    //         reason,
    //     } satisfies EntryCancelledPayload);
    // }

    /**
     * Player death policy: cancel the entry queue (decision #2).
     * Does not wipe already-spawned invaders — call clearCombatants() if needed.
     * Emits player:died for future lives / UI listeners.
     */
    public onPlayerDeath(): void {
        if (!this.started || !this.ctx) return;

        // Cancel current director/stage
        if (this.director && !this.director.isCancelled()) {
            this.director.cancel();

            this.ctx.events.emit(GameEvents.stageCancelled, {
                reason: 'player_death',
            } satisfies StageCancelledPayload);
        }

        this.ctx.events.emit(GameEvents.playerDied, undefined);
    }


    /**
     * Remove all session invaders and playfield invader meshes without
     * restarting entry (board wipe after death, etc.).
     */
    public clearCombatants(): void {
        this.invaders.clear();
        this.ctx?.playField.clearInvaders();
    }

    public update(dt: number): void {
        if (!this.started) return;

        this.formation.update(dt);
        this.director?.update(dt);

        this.invaders.update(dt);

        if (this.director?.isComplete()) {
            this.advanceStage();
        }

    }

    public isStarted(): boolean {
        return this.started;
    }

    public isStageCancelled(): boolean {
        return this.director?.isCancelled() ?? false;
    }

    public isStageComplete(): boolean {
        return this.director?.isComplete() ?? false;
    }


    public dispose(): void {
        if (this.started) {
            const hadPending =
                this.director?.isRunning() &&
                (this.director?.queueRemaining > 0 || !this.director?.isComplete());
            this.director?.cancel();
            if (hadPending) {
                this.ctx?.events.emit(GameEvents.stageCancelled, {
                    reason: 'dispose',
                } satisfies StageCancelledPayload);
            }
        }

        this.invaders.clear();
        this.ctx?.playField.clearInvaders();
        this.ctx = null;
        this.template = null;
        this.started = false;
    }

    private onlyEntryStage(): boolean {
        return this.stageQueue?.stages.length === 1 && this.stageQueue?.stages[0].name === 'Entry';
    }

    private advanceStage(): void {
        if (!this.stageQueue || !this.ctx || !this.template) return;
        if (this.onlyEntryStage()) {
            return;
        }

        this.currentStage = this.stageQueue.next();
        this.director = this.currentStage.director;

        this.director?.begin({
            formation: this.formation,
            invaders: this.invaders,
            playField: this.ctx.playField,
            template: this.template,
            config: this.currentStage.directorConfig,
            scene: this.ctx.scene.scene,
        });
    }

    private bootIntro(reason: IntroStartedPayload['reason']): void {
        const ctx = this.ctx;
        const template = this.template;
        if (!ctx || !template) return;

        // Full reset: stop any prior queue, drop actors, rebuild formation + queue.
        if (this.director?.isRunning()) {
            this.director?.cancel();

            ctx.events.emit(GameEvents.stageCancelled, {
                reason: 'restart',
            } satisfies StageCancelledPayload);
        } else {
            this.director?.cancel();
        }

        this.invaders.clear();
        ctx.playField.clearInvaders();


        const formationDescription = this.stageQueue?.getFormationDescription();
        if (!formationDescription) {
            throw new Error("StageQueue has no formation descriptor");
        }

        this.formation.setup(ctx.playField.bounds.height, formationDescription);


        this.director?.begin({
            formation: this.formation,
            invaders: this.invaders,
            playField: ctx.playField,
            template: this.template,
            config: this.currentStage?.directorConfig ?? {},
        });


        ctx.events.emit(GameEvents.introStarted, { reason } satisfies IntroStartedPayload);
    }
}

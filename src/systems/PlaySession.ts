import type { Object3D } from 'three';
import type {
    EntryCancelledPayload,
    EntryConfig,
    FormationConfig,
    IntroStartedPayload,
} from '../app/types';
import { GameEvents } from '../app/types';
import type { GameContext } from '../app/GameContext';
import { EntityManager } from '../entities/EntityManager';
import { EntryDirector } from './EntryDirector';
import { FormationController } from './FormationController';

export interface PlaySessionStartOptions {
    /** Asset key for invader mesh template (default: 'invader'). */
    invaderAssetKey?: string;
    formation?: Partial<FormationConfig>;
    entry?: Partial<EntryConfig>;
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
    public readonly entities = new EntityManager();
    public readonly formation = new FormationController();
    public readonly entry = new EntryDirector();

    private ctx: GameContext | null = null;
    private template: Object3D | null = null;
    private invaderAssetKey = 'invader1';
    private formationOverride: Partial<FormationConfig> = {};
    private entryOverride: Partial<EntryConfig> = {};
    private started = false;
    private entryCompleteEmitted = false;

    /**
     * Clear field, setup formation from terrain height, begin entry queue.
     */
    public start(ctx: GameContext, options: PlaySessionStartOptions = {}): void {
        this.ctx = ctx;
        this.invaderAssetKey = options.invaderAssetKey ?? 'invader1';
        this.formationOverride = options.formation ?? {};
        this.entryOverride = options.entry ?? {};

        this.template = ctx.assets.getOrCreateMeshTemplate(this.invaderAssetKey);
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

    /**
     * Stop scheduling new entry spawns. In-flight invaders keep flying/docking
     * unless the caller also clearCombatants() or dispose().
     */
    public cancelEntry(reason: EntryCancelledPayload['reason'] = 'manual'): void {
        if (!this.started) return;
        if (this.entry.isCancelled() && this.entry.queueRemaining === 0) return;

        this.entry.cancel();
        this.ctx?.events.emit(GameEvents.entryCancelled, {
            reason,
        } satisfies EntryCancelledPayload);
    }

    /**
     * Player death policy: cancel the entry queue (decision #2).
     * Does not wipe already-spawned invaders — call clearCombatants() if needed.
     * Emits player:died for future lives / UI listeners.
     */
    public onPlayerDeath(): void {
        if (!this.started || !this.ctx) return;

        this.cancelEntry('player_death');
        this.ctx.events.emit(GameEvents.playerDied, undefined);
    }

    /**
     * Remove all session entities and playfield invader meshes without
     * restarting entry (board wipe after death, etc.).
     */
    public clearCombatants(): void {
        this.entities.clear();
        this.ctx?.playField.clearInvaders();
    }

    public update(dt: number): void {
        if (!this.started) return;

        this.formation.update(dt);
        this.entry.update(dt);
        this.entities.update(dt);

        if (!this.entryCompleteEmitted && this.entry.isComplete()) {
            this.entryCompleteEmitted = true;
            this.ctx?.events.emit(GameEvents.entryComplete, undefined);
        }
    }

    public isEntryComplete(): boolean {
        return this.entry.isComplete();
    }

    public isStarted(): boolean {
        return this.started;
    }

    public isEntryCancelled(): boolean {
        return this.entry.isCancelled();
    }

    public dispose(): void {
        if (this.started) {
            const hadPending =
                this.entry.isRunning() &&
                (this.entry.queueRemaining > 0 || !this.entry.isComplete());
            this.entry.cancel();
            if (hadPending) {
                this.ctx?.events.emit(GameEvents.entryCancelled, {
                    reason: 'dispose',
                } satisfies EntryCancelledPayload);
            }
        }

        this.entities.clear();
        this.ctx?.playField.clearInvaders();
        this.ctx = null;
        this.template = null;
        this.started = false;
        this.entryCompleteEmitted = false;
    }

    private bootIntro(reason: IntroStartedPayload['reason']): void {
        const ctx = this.ctx;
        const template = this.template;
        if (!ctx || !template) return;

        // Full reset: stop any prior queue, drop actors, rebuild formation + queue.
        if (this.entry.isRunning()) {
            this.entry.cancel();
            ctx.events.emit(GameEvents.entryCancelled, {
                reason: 'restart',
            } satisfies EntryCancelledPayload);
        } else {
            this.entry.cancel();
        }

        this.entities.clear();
        ctx.playField.clearInvaders();
        this.entryCompleteEmitted = false;

        this.formation.setup(ctx.playField.bounds.height, this.formationOverride);

        this.entry.begin({
            formation: this.formation,
            entities: this.entities,
            playField: ctx.playField,
            template,
            entry: this.entryOverride,
        });

        ctx.events.emit(GameEvents.introStarted, { reason } satisfies IntroStartedPayload);
    }
}

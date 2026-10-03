// systems/patterns/directors/BasePatternDirector.ts

import type { DirectorContext, PatternDirector } from '../interfaces';
import type { FormationController } from '../../FormationController';
import type { EntityManager } from '../../../entities/EntityManager';

/**
 * Shared running/cancelled lifecycle for every PatternDirector.
 * Does not itself spawn or redirect invaders — see InvaderRepathDirector
 * (repaths already-spawned invaders) and EntryPatternDirector (spawns new ones).
 */
export abstract class BasePatternDirector implements PatternDirector {
    protected formation!: FormationController;
    protected invaders!: EntityManager;
    protected running = false;
    protected cancelled = false;

    public abstract readonly queueRemaining: number;
    public abstract begin(ctx: DirectorContext): void;
    public abstract update(dt: number): void;
    public abstract isComplete(): boolean;

    /** Capture the fields every director needs; call first from begin() overrides. */
    protected captureCommon(ctx: DirectorContext): void {
        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.running = true;
        this.cancelled = false;
    }

    public cancel(): void {
        this.cancelled = true;
        this.running = false;
        this.onCancel();
    }

    public isRunning(): boolean {
        return this.running && !this.cancelled;
    }

    public isCancelled(): boolean {
        return this.cancelled;
    }

    /** Hook for subclass-specific teardown on cancel (e.g. clearing a queue). */
    protected onCancel(): void {
        // no-op by default
    }
}

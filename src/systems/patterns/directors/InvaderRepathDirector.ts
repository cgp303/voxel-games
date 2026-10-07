// systems/patterns/directors/InvaderRepathDirector.ts

import type { IDirectorContext, IPatternBuilder } from '../../../config/interfaces/interfaces';
import type { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';
import type { Invader } from '../../../entities/Invader';
import { BasePatternDirector } from './BasePatternDirector';

/**
 * Redirects already-spawned formation invaders onto a builder-generated path.
 * Shared by every director that repaths existing invaders (column dives, column
 * vertical, figure-eight, group attacks). EntryPatternDirector spawns brand-new
 * invaders instead, so it extends BasePatternDirector directly.
 */
export abstract class InvaderRepathDirector extends BasePatternDirector {
    public queueRemaining = 0;

    protected config: Record<string, any> = {};
    protected builder!: IPatternBuilder;

    protected completionCooldown = 0;
    protected coolDownPeriod = 4;

    protected override captureCommon(ctx: IDirectorContext): void {
        super.captureCommon(ctx);
        this.config = ctx.config ?? {};
    }

    /** Advances the post-completion cooldown. Returns true while update() should stop early. */
    protected tickCooldown(dt: number): boolean {
        if (this.completionCooldown <= 0) return false;
        this.completionCooldown -= dt;
        if (this.completionCooldown <= 0) this.onCooldownElapsed();
        return true;
    }

    /** Fires once the post-completion cooldown drains; override if "complete" means more than an empty queue. */
    protected onCooldownElapsed(): void {
        this.queueRemaining = 0;
    }

    /** Look up the invader at a slot, build it a fresh path from its own position, and set it flying. */
    protected buildAndApply(slotKey: string, side: number): void {
        const invader = this.invaders?.getInvaderAtSlot(slotKey);
        if (invader && invader.active) {
            this.applyPattern(invader, this.builder.build(invader.position, side));
        }
    }

    /** Hand a (possibly shared) pattern to one invader. */
    protected applyPattern(invader: Invader, pattern: MultiSegmentPattern, extra?: Record<string, any>): void {
        invader.startPattern({
            pattern,
            formation: this.formation,
            entry: this.config.orientation,
            ...extra,
        });
    }

    public isComplete(): boolean {
        return this.queueRemaining <= 0;
    }
}

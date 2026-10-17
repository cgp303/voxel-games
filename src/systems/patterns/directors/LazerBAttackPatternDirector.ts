// systems/patterns/directors/LazerBAttackPatternDirector.ts

import { LazerBAttackPatternBuilder } from '../patterns/invader-patterns/LazerBAttackPatternBulder';
import type { IPatternBuilder, IRepeatingPatternDirectorContext } from '../../../config/interfaces/interfaces';
import { ColumnTriggerDirector } from './ColumnTriggerDirector';

export class LazerBAttackPatternDirector extends ColumnTriggerDirector {
    protected readonly msBetweenTriggers = 1.0;

    protected maxSetIterations = 1;
    protected setInteration = 0;

    protected createBuilder(): IPatternBuilder {
        return new LazerBAttackPatternBuilder();
    }

    public begin(ctx: IRepeatingPatternDirectorContext): void {
        super.begin(ctx);
        this.maxSetIterations = Math.max(1, ctx?.config?.maxSetIterations ?? ctx?.maxSetIterations ?? 1);
        this.setInteration = 0;

        // The base class sizes the queue from the trigger order; here the queue is open until
        // the last attack has launched and its (duration - overlap) cooldown has drained.
        this.queueRemaining = 1;
        this.triggerOrder = [];
        // First attack launches immediately; later ones are staggered by msBetweenTriggers.
        this.triggerTime = this.msBetweenTriggers;
    }

    /** Random mirrored pair that still has at least one invader in formation, or null if none remain. */
    protected pickAvailablePair(): string[] | null {
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;
        const candidates: string[][] = [];
        for (let col = 0; col <= maxCol; col++) {
            const mirrorCol = maxCol - col;
            for (let row = 0; row <= maxRow; row++) {
                const leftKey = `${col},${row}`;
                const rightKey = `${mirrorCol},${row}`;
                if (this.invaders?.getInvaderAtSlot(leftKey) || this.invaders?.getInvaderAtSlot(rightKey)) {
                    candidates.push([leftKey, rightKey]);
                }
            }
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    public override update(dt: number): void {
        if (!this.running || this.cancelled || this.queueRemaining <= 0) return;
        if (this.tickCooldown(dt)) return;

        this.triggerTime += dt;
        if (this.triggerTime < this.msBetweenTriggers) return;
        this.triggerTime = 0;

        const pair = this.pickAvailablePair();
        if (pair) {
            this.triggerOrder = [pair];
            this.currentIndex = 0;
            this.trigger();
            this.setInteration++;
        }

        // Done when all attacks have launched (or nobody is left to launch).
        if (!pair || this.setInteration >= this.maxSetIterations) {
            this.beginCompletion();
        }
    }

    /** The stage queue moves on once the last pattern is overlap seconds from finishing. */
    private beginCompletion(): void {
        const wait = this.builder.duration() - this.builder.overlap();
        if (wait > 0) {
            this.coolDownPeriod = wait;
            this.completionCooldown = wait;
        } else {
            this.queueRemaining = 0;
        }
    }
}
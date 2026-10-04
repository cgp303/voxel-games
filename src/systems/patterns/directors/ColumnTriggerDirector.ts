// systems/patterns/directors/ColumnTriggerDirector.ts

import type { IDirectorContext, IPatternBuilder } from '../../../config/interfaces/interfaces';
import { InvaderRepathDirector } from './InvaderRepathDirector';

import type { ColumnSpawnType } from '../../../config/types/types';

/**
 * Walks a precomputed trigger order at a fixed cadence, re-pathing the
 * invader(s) at each slot. Shared by ColumnDives, ColumnVertical, FigureEight —
 * they differ only in trigger-order shape, cadence, and which builder they use.
 */
export abstract class ColumnTriggerDirector extends InvaderRepathDirector {
    protected triggerOrder: string[][] = [];
    protected spawnType: ColumnSpawnType = 'LeftRightPairs';
    protected currentIndex = 0;
    protected triggerTime = 0;

    /** Seconds between triggers — set by each concrete director. */
    protected abstract readonly msBetweenTriggers: number;

    /** Concrete director picks its own builder (ColumnDives/ColumnVertical/FigureEight pattern). */
    protected abstract createBuilder(): IPatternBuilder;

    public begin(ctx: IDirectorContext): void {
        this.captureCommon(ctx);
        this.builder = this.createBuilder();

        this.spawnType = this.formation.getSpawnType() as ColumnSpawnType;
        this.triggerOrder = this.makeTriggerOrder();
        this.queueRemaining = this.triggerOrder.length;
        this.currentIndex = 0;
        this.triggerTime = 0;
        this.completionCooldown = 0;
    }

    public update(dt: number): void {
        if (!this.running || this.cancelled) return;
        if (this.tickCooldown(dt)) return;

        this.triggerTime += dt;

        // Finished all columns
        if (this.currentIndex >= this.triggerOrder.length) return;

        // Column pause gate
        if (this.triggerTime < this.msBetweenTriggers) return;
        this.triggerTime = 0;

        this.trigger();
        this.currentIndex++;

        // If done, start the completion cooldown
        if (this.currentIndex >= this.triggerOrder.length) {
            this.completionCooldown = this.coolDownPeriod;
        }
    }

    /** Back-row-to-front, mirrored-column walk. Override for a different shape (e.g. FigureEight's row pairing). */
    protected makeTriggerOrder(): string[][] {
        const order: string[][] = [];
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;
        const halfCol = maxCol / 2;
        for (let colLeft = 0; colLeft <= halfCol; colLeft++) {
            const colRight = maxCol - colLeft;
            for (let rowBack = maxRow; rowBack >= 0; rowBack--) {
                order.push([`${colLeft},${rowBack}`, `${colRight},${rowBack}`]);
            }
        }
        return order;
    }

    private trigger(): void {
        const group = this.triggerOrder[this.currentIndex];

        switch (this.spawnType) {
            case 'LeftRightPairs': {
                const [leftKey, rightKey] = group;
                this.buildAndApply(leftKey, 0);
                this.buildAndApply(rightKey, 1);
                return;
            }
            case 'Single':
                this.buildAndApply(group[0], 0);
                return;
            case 'Wave':
                for (const key of group) this.buildAndApply(key, 0);
                return;
            default:
                // Unknown spawn type — do nothing
                return;
        }
    }
}

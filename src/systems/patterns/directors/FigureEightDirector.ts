// systems/patterns/directors/FigureEightDirector.ts

import { FigureEightPatternBuilder } from '../patterns/FigureEightPatternBuilder';
import type { DirectorContext, PatternDirector } from '../interfaces';
export class FigureEightDirector implements PatternDirector {

    private running = false;
    private cancelled = false;
    public queueRemaining = 0;
    private formation;
    private invaders;
    private playField;
    private template;
    private config;
    private builder;
    private currentRow = 0;
    private currentCol = 0;
    private timeSinceLastTrigger = 0;
    private nextRowAt = 0;
    private msBetweenRows = 6000;

    private triggerDelay = 0.3 // conga line spacing

    begin(ctx: DirectorContext): void {
        this.running = true;
        this.cancelled = false;
        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.playField = ctx.playField;
        this.template = ctx.template;
        this.config = ctx.config ?? {};
        this.builder = new FigureEightPatternBuilder(ctx.scene);
        this.queueRemaining = this.formation.rows * this.formation.cols;
        this.currentRow = this.formation.rows - 1;
        this.currentCol = 0;
        this.timeSinceLastTrigger = 0;
    }

    update(dt: number): void {
        if (!this.running || this.cancelled) return;
        if (this.currentRow < 0) return;

        // Row pause gate
        if (performance.now() < this.nextRowAt) return;

        this.timeSinceLastTrigger += dt;
        if (this.timeSinceLastTrigger < this.triggerDelay) return;
        this.timeSinceLastTrigger = 0;

        const row = this.currentRow;
        const leftToRight = (row % 2 === 0);

        const cols = leftToRight
            ? [...Array(this.formation.cols).keys()]
            : [...Array(this.formation.cols).keys()].reverse();

        const col = cols[this.currentCol];

        const slot = this.formation.getSlot(col, row);
        const invader = this.invaders.getInvaderAtSlot(slot);

        if (invader && invader.active) {
            const pattern = this.builder.build(invader, row % 2);
            invader.startPattern({
                pattern,
                formation: this.formation,
                entry: this.config.orientation,
            });
        }

        this.currentCol++;

        if (this.currentCol >= this.formation.cols) {
            this.currentCol = 0;
            this.currentRow--;

            // schedule next row trigger
            this.nextRowAt = performance.now() + this.msBetweenRows;
        }

        if (this.currentRow < 0) {
            this.queueRemaining = 0;
        }
    }


    cancel(): void {
        this.cancelled = true;
        this.running = false;
    }

    isRunning(): boolean {
        return this.running;
    }

    isCancelled(): boolean {
        return this.cancelled;
    }

    isComplete(): boolean {
        return this.queueRemaining <= 0;
    }
}

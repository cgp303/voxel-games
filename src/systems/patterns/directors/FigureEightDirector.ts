// systems/patterns/directors/FigureEightDirector.ts

import { FigureEightPatternBuilder } from '../patterns/FigureEightPatternBuilder';
import type { DirectorContext, PatternDirector } from '../interfaces';
export class FigureEightDirector implements PatternDirector {

    public queueRemaining = 0;
    private running = false;
    private cancelled = false;
    private formation;
    private invaders;
    private config;
    private builder;
    private currentRow = 0;
    private currentCol = 0;
    private timeSinceLastTrigger = 0;
    private nextRowAt = 0;
    private msBetweenRows = 3500;
    private rowsPerTrigger = 2;
    private completionCooldown = 0;

    private triggerDelay = 0.3 // conga line spacing

    begin(ctx: DirectorContext): void {
        this.running = true;
        this.cancelled = false;
        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.config = ctx.config ?? {};
        this.builder = new FigureEightPatternBuilder(ctx.scene);
        this.queueRemaining = this.formation.rows * this.formation.cols;
        this.currentRow = this.formation.rows - 1;
        this.currentCol = 0;
        this.timeSinceLastTrigger = 0;
        this.completionCooldown = 0; // reset completion cooldown on begin
    }

    update(dt: number): void {
        // return if not active
        if (!this.running || this.cancelled) return;

        // return if in completion cooldown
        if (this.completionCooldown > 0) {
            this.completionCooldown -= dt;
            if (this.completionCooldown <= 0) {
                this.queueRemaining = 0;
            }
            return;
        }

        // return if all rows have been processed
        if (this.currentRow < 0) return;

        // Row pause gate
        if (performance.now() < this.nextRowAt) return;

        // pause between invader triggers
        this.timeSinceLastTrigger += dt;
        if (this.timeSinceLastTrigger < this.triggerDelay) return;

        // reset time since last trigger
        this.timeSinceLastTrigger = 0;


        let index = 0;
        while (index < this.rowsPerTrigger) {
            // determine current row and column direction
            const row = this.currentRow - index;
            const leftToRight = (row % 2 === 0);

            // determine column order based on direction
            const cols = leftToRight
                ? [...Array(this.formation.cols).keys()]
                : [...Array(this.formation.cols).keys()].reverse();

            const col = cols[this.currentCol];

            // get the slot and invader at the current column and row
            const key = `${col},${row}`;
            const invader = this.invaders.getInvaderAtSlot(key);

            // trigger the invader's pattern if it exists and is active
            if (invader && invader.active) {
                const pattern = this.builder.build(invader, row % 2);
                invader.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }
            index++;
        }



        // advance to the next column
        this.currentCol++;

        if (this.currentCol >= this.formation.cols) {
            // move to the next row
            this.currentCol = 0;
            this.currentRow -= 2;
            // schedule next row trigger
            this.nextRowAt = performance.now() + this.msBetweenRows;
        }

        if (this.currentRow < 0) {
            // all rows have been processed, start completion cooldown
            this.completionCooldown = this.msBetweenRows / 1000;
        }
    }

    /*
    // Cancel the director's operation
    */
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

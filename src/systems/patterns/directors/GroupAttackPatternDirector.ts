// systems/patterns/directors/GroupAttackPatternDirector.ts

import { GroupAttackPatternBuilder } from '../patterns/GroupAttackPatternBuilder';
import type { DirectorContext, PatternDirector } from '../interfaces';
export class GroupAttackPatternDirector implements PatternDirector {

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
    private nextColAt = 0;
    private msBetweenCols = 500;
    private colsPerTrigger = 1;
    private halCols = 0;
    private completionCooldown = 0;
    private coolDownPeriod = 2.5; // example value in milliseconds

    private triggerDelay = 0.3 // conga line spacing

    begin(ctx: DirectorContext): void {
        this.running = true;
        this.cancelled = false;
        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.config = ctx.config ?? {};
        this.builder = new GroupAttackPatternBuilder(ctx.scene);
        this.queueRemaining = this.formation.rows * this.formation.cols;
        this.currentRow = this.formation.rows - 1;
        this.currentCol = 0;
        this.timeSinceLastTrigger = 0;
        this.completionCooldown = 0; // reset completion cooldown on begin
        this.halCols = this.formation.cols / 2;
    }

    update(dt: number): void {

        ////////////////////////////////////////////
        // First deal with timing:
        ////////////////////////////////////////////

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

        // return if all columns have been processed
        if (this.currentCol >= this.halCols) return;

        // Row pause gate
        if (performance.now() < this.nextColAt) return;

        // pause between invader triggers
        this.timeSinceLastTrigger += dt;
        if (this.timeSinceLastTrigger < this.triggerDelay) return;

        // reset time since last trigger
        this.timeSinceLastTrigger = 0;


        ////////////////////////////////////////////
        // Select and Trigger Invaders
        ////////////////////////////////////////////
        let index = 0;
        while (index < this.colsPerTrigger) {

            // determine row
            const row = this.currentRow - index;

            // define arrays. reverse for right side columns
            const cols = [...Array(this.formation.cols).keys()];
            const revCols = [...Array(this.formation.cols).keys()].reverse();

            const colLeft = cols[this.currentCol];
            const colRight = revCols[this.currentCol];

            // get the slot and invader at the current column and row
            const slotLeft = this.formation.getSlot(colLeft, row);
            const slotRight = this.formation.getSlot(colRight, row);
            const invaderleft = this.invaders.getInvaderAtSlot(slotLeft);
            const invaderright = this.invaders.getInvaderAtSlot(slotRight);

            // trigger the invader's pattern if it exists and is active
            if (invaderleft && invaderleft.active) {
                const pattern = this.builder.build(invaderleft, 0);
                invaderleft.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }

            if (invaderright && invaderright.active) {
                const pattern = this.builder.build(invaderright, 1);
                invaderright.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }

            index++;
        }

        ////////////////////////////////////////////
        // Set up for the next iteration
        ////////////////////////////////////////////

        // advance to the next column
        this.currentRow--;

        if (this.currentRow < 0) {
            // move to the next column
            this.currentRow = this.formation.rows - 1;
            this.currentCol++;
            // schedule next column trigger
            this.nextColAt = performance.now() + this.msBetweenCols;
        }

        if (this.currentCol >= this.halCols) {
            // all columns have been processed, start completion cooldown
            this.completionCooldown = this.coolDownPeriod;
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

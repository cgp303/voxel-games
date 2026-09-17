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

    private triggerOrder: string[][] = [];
    private currentIndex = 0;
    private spawnType: string = "LeftRightPairs";
    private nextTriggerAt = 0;

    private msBetweenTriggers = 250;
    private completionCooldown = 0;
    private coolDownPeriod = 4;


    begin(ctx: DirectorContext): void {
        this.running = true;
        this.cancelled = false;

        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.config = ctx.config ?? {};
        this.builder = new FigureEightPatternBuilder(ctx.scene);

        // Build trigger order from spawnOrder
        this.spawnType = this.formation.getSpawnType();
        this.triggerOrder = this.makeTriggerOrder();
        this.queueRemaining = this.triggerOrder.length;

        this.currentIndex = 0;
        this.completionCooldown = 0;
        this.nextTriggerAt = 0;
    }

    private makeTriggerOrder(): string[][] {
        this.triggerOrder = [];
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;

        for (let row = maxRow; row >= 0; row -= 2) {
            for (let col = 0; col <= maxCol; col++) {

                const row1 = row;
                const row2 = row - 1;
                const colLeft = col;
                const colRight = maxCol - colLeft;
                const slot1 = `${colLeft},${row1}`;
                const slot2 = `${colRight},${row2}`;
                const group = [slot1, slot2];
                this.triggerOrder.push(group);

            }
        }

        return this.triggerOrder;
    }

    update(dt: number): void {
        if (!this.running || this.cancelled) return;

        // Completion cooldown
        if (this.completionCooldown > 0) {
            this.completionCooldown -= dt;
            if (this.completionCooldown <= 0) {
                this.queueRemaining = 0;
            }
            return;
        }

        // Finished all columns
        if (this.currentIndex >= this.triggerOrder.length) return;

        // Column pause gate
        if (performance.now() < this.nextTriggerAt) return;

        // Trigger the next column/group
        this.trigger();

        // Move to next column
        this.currentIndex++;

        // Schedule next column trigger
        this.nextTriggerAt = performance.now() + this.msBetweenTriggers;

        // If done, start cooldown
        if (this.currentIndex >= this.triggerOrder.length) {
            this.completionCooldown = this.coolDownPeriod;
        }
    }

    private trigger(): void {
        const group = this.triggerOrder[this.currentIndex];

        if (this.spawnType === "LeftRightPairs") {
            const [leftKey, rightKey] = group;

            const invLeft = this.invaders.getInvaderAtSlot(leftKey);
            const invRight = this.invaders.getInvaderAtSlot(rightKey);

            if (invLeft && invLeft.active) {
                const pattern = this.builder.build(invLeft, 0);
                invLeft.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }

            if (invRight && invRight.active) {
                const pattern = this.builder.build(invRight, 1);
                invRight.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }

            return;
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

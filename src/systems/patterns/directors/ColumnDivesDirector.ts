import { ColumnDivesPatternBuilder } from '../patterns/ColumnDivesPatternBuilder';
import type { DirectorContext, PatternDirector } from '../interfaces';

export class ColumnDivesDirector implements PatternDirector {

    public queueRemaining = 0;
    private running = false;
    private cancelled = false;

    private formation;
    private invaders;
    private config;
    private builder;

    private triggerOrder: string[][] = [];
    private spawnType: string = "LeftRightPairs";

    private currentIndex = 0;
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
        this.builder = new ColumnDivesPatternBuilder(ctx.scene);

        this.spawnType = this.formation.getSpawnType();

        this.triggerOrder = this.makeTriggerOrder();
        this.queueRemaining = this.triggerOrder.length;
        this.currentIndex = 0;
        this.nextTriggerAt = 0;
        this.completionCooldown = 0;
    }

    makeTriggerOrder(): string[][] {
        this.triggerOrder = [];
        const maxCol = this.formation.maxCol;
        const maxRow = this.formation.maxRow;
        const halfCol = maxCol / 2;
        for (let colLeft = 0; colLeft <= halfCol; colLeft++) {
            const colRight = maxCol - colLeft;
            for (let rowBack = maxRow; rowBack >= 0; rowBack--) {
                this.triggerOrder.push([`${colLeft},${rowBack}`, `${colRight},${rowBack}`]);
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

        if (this.spawnType === "Single") {
            const [key] = group;
            const inv = this.invaders.getInvaderAtSlot(key);

            if (inv && inv.active) {
                const pattern = this.builder.build(inv, 0);
                inv.startPattern({
                    pattern,
                    formation: this.formation,
                    entry: this.config.orientation,
                });
            }

            return;
        }

        if (this.spawnType === "Wave") {
            for (const key of group) {
                const inv = this.invaders.getInvaderAtSlot(key);
                if (inv && inv.active) {
                    const pattern = this.builder.build(inv, 0);
                    inv.startPattern({
                        pattern,
                        formation: this.formation,
                        entry: this.config.orientation,
                    });
                }
            }
            return;
        }

        // Unknown spawn type — do nothing
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

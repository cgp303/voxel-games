import type { IDirectorContext } from '../../../config/interfaces/interfaces';
import type { Boss } from '../../../entities/Boss';
import { BasePatternDirector } from './BasePatternDirector';

/**
 * The stage of a boss wave. It asks the session to bring the boss onto the field (the boss then flies, fires and
 * is shot by itself) and is complete once the boss is dead. The stage config names the boss: `{ bossId: 'boss1' }`.
 */
export class BossDirector extends BasePatternDirector {
    public readonly queueRemaining = 0;

    private readonly bossId: string;
    private boss: Boss | null = null;
    private began = false;

    constructor(bossId: string) {
        super();
        this.bossId = bossId;
    }

    public begin(ctx: IDirectorContext): void {
        this.captureCommon(ctx);
        const id = (ctx.config?.bossId as string | undefined) ?? this.bossId;
        this.boss = ctx.spawnBoss?.(id) ?? null;
        this.began = true;
        if (!this.boss) console.warn(`[BossDirector] no boss "${id}" could be spawned; the stage ends at once`);
    }

    public update(_dt: number): void {
        // The boss is an entity and runs itself.
    }

    /** True once the boss is dead (or gone, or could not be spawned). */
    public isComplete(): boolean {
        if (!this.began) return false;
        return !this.boss || this.boss.defeated || !this.boss.active;
    }
}

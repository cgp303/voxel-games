import { Vector3 } from 'three';
import type { EntrySide } from '../../../config/types/types';
import type { IEntryConfig, IFormationSlot, IPatternBuilder } from '../../../config/interfaces/interfaces';
import { ENTRY, INVADER_TYPES } from '../../../config/data/constants';
import { Invader } from '../../../entities/Invader';
import type { PlayField } from '../../../world/PlayField';
import { slotCol, slotRow } from '../formations/slotKey';
import { defaultOrientationConfig } from '../../../config/pattern-config/defaultOrientationConfig';
import type { IDirectorContext } from '../../../config/interfaces/interfaces';
import { BasePatternDirector } from './BasePatternDirector';
import { StandardEntryPatternBuilder } from '../patterns/invader-patterns/StandardEntryPatternBuilder';
import { SpiralEntryPatternBuilder } from '../patterns/invader-patterns/SpiralEntryPatternBuilder';
import { SwoopingDiveEntryPatternBuilder } from '../patterns/invader-patterns/SwoopingDiveEntryPatternBuilder';
import { FromAboveEntryPattern } from '../patterns/invader-patterns/FromAboveEntryPatternBuilder';
import { FromBelowEntryPattern } from '../patterns/invader-patterns/FromBelowEntryPatternBuilder';

type QueueJob =
    | { kind: 'pair'; left: IFormationSlot; right: IFormationSlot }
    | { kind: 'single'; slot: IFormationSlot };

export type EntryPatternBuilderType = 'standard' | 'spiral' | 'swoopingDive' | 'fromAbove' | 'fromBelow';

/**
 * Extended entry config to specify which entry pattern builder to use.
 */
export interface IEntryPatternDirectorConfig extends IEntryConfig {
    patternBuilder?: EntryPatternBuilderType;
}

export class EntryPatternDirector extends BasePatternDirector {
    private playField: PlayField | null = null;
    private entry: IEntryConfig = { ...ENTRY };
    private patternBuilder: IPatternBuilder = new StandardEntryPatternBuilder();

    private queue: QueueJob[] = [];
    private timer = 0;
    private pairIntervalSec = 1;
    private getInvaderTypeForSlot: IDirectorContext['getInvaderTypeForSlot'] = () => 'scout';

    private readonly homeScratch = new Vector3();
    private readonly spawnScratch = new Vector3();

    public begin(ctx: IDirectorContext): void {
        this.captureCommon(ctx);
        this.playField = ctx.playField;
        const entryConfig = (ctx.config ?? {}) as IEntryPatternDirectorConfig;
        this.entry = { ...ENTRY, ...entryConfig };
        this.patternBuilder = this.createPatternBuilder(entryConfig.patternBuilder ?? 'standard');
        this.getInvaderTypeForSlot = ctx.getInvaderTypeForSlot;

        const perSec = Math.max(0.01, this.entry.invadersPerSecond);
        this.pairIntervalSec = 2 / perSec;
        this.timer = 0;
        this.queue.length = 0;

        const spawnOrder = this.formation.getSpawnOrder();
        const spawnType = this.formation.getSpawnType();

        switch (spawnType) {
            case "LeftRightPairs":
                for (const [leftKey, rightKey] of spawnOrder) {
                    this.queue.push({
                        kind: 'pair',
                        left: { col: slotCol(leftKey), row: slotRow(leftKey) },
                        right: { col: slotCol(rightKey), row: slotRow(rightKey) }
                    });
                }
                break;
            case "Single":
                for (const [key] of spawnOrder) {
                    this.queue.push({
                        kind: 'single',
                        slot: { col: slotCol(key), row: slotRow(key) }
                    });
                }
                break;
            default:
                throw new Error(`Unknown spawnType: ${spawnType}`);
        }
    }

    public update(dt: number): void {
        if (!this.running || this.cancelled) return;
        if (!this.playField) return;
        if (this.queue.length === 0) return;

        this.timer -= dt;
        while (this.timer <= 0 && this.queue.length > 0 && !this.cancelled) {
            this.releaseNext(-this.timer);
            this.timer += this.pairIntervalSec;
        }
    }

    protected override onCancel(): void {
        this.queue.length = 0;
    }

    public get queueRemaining(): number {
        return this.queue.length;
    }

    public isComplete(): boolean {
        if (this.queue.length > 0) return false;
        for (const e of this.invaders?.getAll() ?? []) {
            if (e instanceof Invader && e.active && e.isEntering()) {
                return false;
            }
        }
        return true;
    }

    /** @param lateness seconds since the ideal release time, so spacing survives long frames. */
    private releaseNext(lateness: number): void {
        const job = this.queue.shift();
        if (!job) return;

        if (job.kind === 'pair') {
            this.spawnOne(job.left, 'left', lateness);
            this.spawnOne(job.right, 'right', lateness);
            return;
        }

        if (job.kind === 'single') {
            this.spawnOne(job.slot, 'center', lateness);
        }
    }

    private spawnOne(slot: IFormationSlot, side: EntrySide, lateness: number): void {
        const formation = this.formation!;
        const invaders = this.invaders!;
        const playField = this.playField!;
        const entry = this.entry;

        formation.getWorldHomeSlot(slot, this.homeScratch);
        const predictedEndPosition = formation.getAdjustedPositionForGroupReturn(this.homeScratch, this.patternBuilder.duration());

        const centerX = formation.getCenterX();
        const halfExtent = this.resolveHalfExtentX(playField);
        const sideSign: 1 | -1 = side === 'left' ? -1 : 1;

        this.spawnScratch.set(
            centerX + sideSign * (halfExtent + entry.spawnMarginX),
            this.homeScratch.y,
            this.homeScratch.z + entry.spawnZBias,
        );

        // Use the pattern builder to create the entry pattern
        const sideNum = side === 'left' ? 0 : 1;
        const pattern = this.patternBuilder.build(
            this.spawnScratch,
            sideNum,
            predictedEndPosition,
        );

        const typeId = this.getInvaderTypeForSlot(slot.col, slot.row);
        const typeDef = INVADER_TYPES[typeId];

        const invader = this.invaders!.acquireInvader(typeDef.assetKey);

        invader.reset({
            typeId,
            scoreValue: typeDef.scoreValue,
            slot,
            side,
            spawn: this.spawnScratch.clone(),
            pattern,
            formation,
            pathDuration: this.patternBuilder.duration(),
            entry: defaultOrientationConfig,
            poolAssetKey: typeDef.assetKey,
        });

        invaders.add(invader);
        if (lateness > 0) invader.update(lateness);
    }

    private createPatternBuilder(type: EntryPatternBuilderType): IPatternBuilder {
        switch (type) {
            case 'standard':
                return new StandardEntryPatternBuilder();
            case 'spiral':
                return new SpiralEntryPatternBuilder();
            case 'swoopingDive':
                return new SwoopingDiveEntryPatternBuilder();
            case 'fromAbove':
                return new FromAboveEntryPattern();
            case 'fromBelow':
                return new FromBelowEntryPattern();
            default:
                return new StandardEntryPatternBuilder();
        }
    }

    private resolveHalfExtentX(playField: PlayField): number {
        const w = playField.bounds.width;
        if (w > 0) return w * 0.5;
        return this.entry.halfExtentX;
    }
}
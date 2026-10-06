import { Object3D, Vector3 } from 'three';
import type { EntrySide } from '../../../config/types/types';
import type { IEntryConfig, IFormationSlot } from '../../../config/interfaces/interfaces';
import { ENTRY } from '../../../config/data/constants';
import { EntityManager } from '../../../entities/EntityManager';
import { Invader } from '../../../entities/Invader';
import type { PlayField } from '../../../world/PlayField';
import type { FormationController } from '../../FormationController';
import { buildEntryControlsFromConfig } from '../../path/cubicBezier';
import { BezierEntryPattern } from '../patterns/BezierEntryPattern';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { defaultOrientationConfig } from '../../../config/pattern-config/defaultOrientationConfig';
import type { IDirectorContext } from '../../../config/interfaces/interfaces';
import { BasePatternDirector } from './BasePatternDirector';


type QueueJob =
    | { kind: 'pair'; left: IFormationSlot; right: IFormationSlot }
    | { kind: 'single'; slot: IFormationSlot };


/**
 * Releases invaders off-stage in L/R pairs (plus alternating center column when odd),
 * builds mirrored entry paths, registers them with EntityManager.
 * Does not tick invaders — PlaySession runs formation → entry → invaders.
 * Spawns brand-new invaders (unlike InvaderRepathDirector subclasses, which redirect
 * already-spawned ones), so it extends BasePatternDirector directly.
 */
export class EntryPatternDirector extends BasePatternDirector {
    private playField: PlayField | null = null;
    private template: Object3D | null = null;
    private entry: IEntryConfig = { ...ENTRY };

    private queue: QueueJob[] = [];
    private timer = 0;
    private pairIntervalSec = 1;
    private assetKey: string = 'invader1'; // default asset key for invaders

    private readonly homeScratch = new Vector3();
    private readonly spawnScratch = new Vector3();

    public begin(ctx: IDirectorContext): void {
        this.captureCommon(ctx);
        this.playField = ctx.playField;
        const entryConfig = ctx.config ?? {};
        this.entry = { ...ENTRY, ...entryConfig };
        this.assetKey = ctx.assetKey ?? this.assetKey;

        const perSec = Math.max(0.01, this.entry.invadersPerSecond);
        // Two invaders per pair release.
        this.pairIntervalSec = 2 / perSec;
        this.timer = 0; // first pair on first eligible update (immediate)
        this.queue.length = 0;

        const spawnOrder = this.formation.getSpawnOrder();
        const spawnType = this.formation.getSpawnType();


        switch (spawnType) {
            case "LeftRightPairs":
                for (const [leftKey, rightKey] of spawnOrder) {
                    const [lcol, lrow] = leftKey.split(',').map(Number);
                    const [rcol, rrow] = rightKey.split(',').map(Number);

                    this.queue.push({
                        kind: 'pair',
                        left: { col: lcol, row: lrow },
                        right: { col: rcol, row: rrow }
                    });
                }
                break;
            case "Single":
                for (const [key] of spawnOrder) {
                    const [col, row] = key.split(',').map(Number);
                    this.queue.push({
                        kind: 'single',
                        slot: { col, row }
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
        console.log('[EntryPatternDirector] update', {
            running: this.running,
            cancelled: this.cancelled,
            queueLength: this.queue.length,
            timer: this.timer
        });
        this.timer -= dt;
        // Allow catch-up if frame hitch; still one release per interval tick.
        while (this.timer <= 0 && this.queue.length > 0 && !this.cancelled) {
            this.releaseNext();
            this.timer += this.pairIntervalSec;
        }
    }

    /** Clear any pending releases; in-flight invaders keep flying. */
    protected override onCancel(): void {
        this.queue.length = 0;
    }

    public get queueRemaining(): number {
        return this.queue.length;
    }

    /**
     * Queue drained and no invader still in entering mode.
     */
    public isComplete(): boolean {
        if (this.queue.length > 0) return false;
        for (const e of this.invaders?.getAll() ?? []) {
            if (e instanceof Invader && e.active && e.isEntering()) {
                return false;
            }
        }
        return true;
    }

    private releaseNext(): void {
        const job = this.queue.shift();
        if (!job) return;

        if (job.kind === 'pair') {
            this.spawnOne(job.left, 'left');
            this.spawnOne(job.right, 'right');
            return;
        }

        if (job.kind === 'single') {
            this.spawnOne(job.slot, 'center');
        }

    }

    private spawnOne(slot: IFormationSlot, side: EntrySide): void {

        const formation = this.formation!;
        const invaders = this.invaders!;
        const playField = this.playField!;
        const template = this.template!;
        const entry = this.entry;

        formation.getWorldHomeSlot(slot, this.homeScratch);

        const centerX = formation.getCenterX();
        const halfExtent = this.resolveHalfExtentX(playField);
        const sideSign: 1 | -1 = side === 'left' ? -1 : 1;

        this.spawnScratch.set(
            centerX + sideSign * (halfExtent + entry.spawnMarginX),
            this.homeScratch.y,
            this.homeScratch.z + entry.spawnZBias,
        );

        const controls = buildEntryControlsFromConfig(
            this.spawnScratch,
            this.homeScratch,
            centerX,
            side,
            entry,
        );

        const segment = new CubicBezierSegment(controls);
        const pattern = new BezierEntryPattern(segment, entry.pathDuration);

        // 1. Decide assetKey (need to pass this through DirectorContext)
        const assetKey = this.assetKey; // e.g., 'invader1'

        // 2. Acquire (pool handles clone + shadow traversal on first call only)
        const invader = this.invaders!.acquireInvader(assetKey);

        invader.reset({
            slot,
            side,
            spawn: this.spawnScratch.clone(),
            pattern,
            formation,
            pathDuration: entry.pathDuration,
            entry: defaultOrientationConfig,
            poolAssetKey: this.assetKey,
        });

        // playField.attachInvader(invader.object3d);
        invaders.add(invader);
    }

    private resolveHalfExtentX(playField: PlayField): number {
        const w = playField.bounds.width;
        if (w > 0) return w * 0.5;
        return this.entry.halfExtentX;
    }
}

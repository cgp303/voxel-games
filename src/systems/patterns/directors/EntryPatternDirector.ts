import { Object3D, Vector3 } from 'three';
import type { EntryConfig, EntrySide, FormationSlot } from '../../../app/types';
import { ENTRY } from '../../../data/constants';
import { EntityManager } from '../../../entities/EntityManager';
import { Invader } from '../../../entities/Invader';
import type { PlayField } from '../../../world/PlayField';
import type { FormationController } from '../../FormationController';
import { buildEntryControlsFromConfig } from '../../path/cubicBezier';
import { BezierEntryPattern } from '../patterns/BezierEntryPattern';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { defaultOrientationConfig } from '../../patterns/config/defaultOrientationConfig';
import type { DirectorContext, PatternDirector } from '../interfaces';


type QueueJob =
    | { kind: 'pair'; left: FormationSlot; right: FormationSlot }
    | { kind: 'single'; slot: FormationSlot };


export interface EntryDirectorBeginArgs {
    formation: FormationController;
    invaders: EntityManager;
    playField: PlayField;
    /** Shared mesh template from AssetManager (cloned per invader). */
    template: Object3D;
    entry?: Partial<EntryConfig>;
}

/**
 * Releases invaders off-stage in L/R pairs (plus alternating center column when odd),
 * builds mirrored entry paths, registers them with EntityManager.
 * Does not tick invaders — PlaySession runs formation → entry → invaders.
 */
export class EntryPatternDirector implements PatternDirector {
    private formation: FormationController | null = null;
    private invaders: EntityManager | null = null;
    private playField: PlayField | null = null;
    private template: Object3D | null = null;
    private entry: EntryConfig = { ...ENTRY };

    private queue: QueueJob[] = [];
    private timer = 0;
    private pairIntervalSec = 1;
    private running = false;
    private cancelled = false;

    private readonly homeScratch = new Vector3();
    private readonly spawnScratch = new Vector3();

    public begin(ctx: DirectorContext): void {
        this.formation = ctx.formation;
        this.invaders = ctx.invaders;
        this.playField = ctx.playField;
        this.template = ctx.template;
        const entryConfig = ctx.config ?? {};
        this.entry = { ...ENTRY, ...entryConfig };

        const perSec = Math.max(0.01, this.entry.invadersPerSecond);
        // Two invaders per pair release.
        this.pairIntervalSec = 2 / perSec;
        this.timer = 0; // first pair on first eligible update (immediate)
        this.cancelled = false;
        this.running = true;
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
        if (!this.formation || !this.invaders || !this.playField || !this.template) {
            return;
        }
        if (this.queue.length === 0) return;

        this.timer -= dt;
        // Allow catch-up if frame hitch; still one release per interval tick.
        while (this.timer <= 0 && this.queue.length > 0 && !this.cancelled) {
            this.releaseNext();
            this.timer += this.pairIntervalSec;
        }
    }

    /** Stop scheduling new spawns (in-flight invaders keep flying). */
    public cancel(): void {
        this.cancelled = true;
        this.queue.length = 0;
        this.running = false;
    }

    public isCancelled(): boolean {
        return this.cancelled;
    }

    public isRunning(): boolean {
        return this.running && !this.cancelled;
    }

    public get queueRemaining(): number {
        return this.queue.length;
    }

    /**
     * Queue drained and no invader still in entering mode.
     */
    public isComplete(): boolean {
        if (this.queue.length > 0) return false;
        if (!this.invaders) return true;
        for (const e of this.invaders.getAll()) {
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

    private spawnOne(slot: FormationSlot, side: EntrySide): void {

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

        const mesh = template.clone(true);
        mesh.traverse((child) => {
            const m = child as { castShadow?: boolean; receiveShadow?: boolean; isMesh?: boolean };
            if (m.isMesh) {
                m.castShadow = true;
                m.receiveShadow = true;
            }
        });

        const invader = new Invader(mesh);
        invader.init({
            slot,
            side,
            spawn: this.spawnScratch.clone(),
            pattern,
            formation,
            pathDuration: entry.pathDuration,
            entry: defaultOrientationConfig,
        });

        playField.attachInvader(mesh);
        invaders.add(invader);
    }

    private resolveHalfExtentX(playField: PlayField): number {
        const w = playField.bounds.width;
        if (w > 0) return w * 0.5;
        return this.entry.halfExtentX;
    }
}

import { SpatialGrid } from './SpatialGrid.ts';
import { clipSegmentToBox, traceSegmentThroughMask } from './segmentTests.ts';
import type { IMaskHit, ISlabResult } from './segmentTests.ts';
import type {
    ICollisionHit,
    ICollisionMover,
    ICollisionSystemConfig,
    ICollisionTarget,
} from './collisionTypes.ts';

const LAYER_SLOTS = 32;

function layerSlot(layer: number): number {
    return 31 - Math.clz32(layer);
}

/**
 * Staged collision detection between movers (swept paths) and targets (baked voxel footprints).
 *
 * Per mover: layer rules -> Y filter -> broadphase grid -> swept box test -> voxel mask walk.
 * Only the movers' paths are queried; the targets are what is inserted into the grid.
 * The returned hit list and its entries are reused every frame, so read them before the next update().
 */
export class CollisionSystem {
    private readonly grid: SpatialGrid;
    private readonly directLayers: number;
    private readonly targetLayers: number;
    private readonly gridLayers: number;
    private readonly moverTargets = new Int32Array(LAYER_SLOTS);
    // Indexed [moverSlot * LAYER_SLOTS + targetSlot].
    private readonly yTolerance = new Float64Array(LAYER_SLOTS * LAYER_SLOTS).fill(Infinity);

    private readonly gridTargets: (ICollisionTarget | null)[] = [];
    private gridCount = 0;
    private readonly directTargets: (ICollisionTarget | null)[] = [];
    private directCount = 0;

    private readonly hitPool: ICollisionHit[] = [];
    private hitCount = 0;
    private readonly result: ICollisionHit[] = [];

    private readonly slab: ISlabResult = { tEnter: 0, tExit: 1 };
    private readonly maskHit: IMaskHit = { t: 0 };
    private hitBucket = 0;
    // Per-mover scratch: the nearest hit so far and the hit object it is written into.
    private bestT = Infinity;
    private best: ICollisionHit | null = null;

    constructor(config: ICollisionSystemConfig) {
        this.grid = new SpatialGrid(config.grid, config.grid.cellSize);
        this.directLayers = config.directLayers;

        let targetLayers = 0;
        for (const rule of config.rules) {
            if (rule.mover === 0 || (rule.mover & (rule.mover - 1)) !== 0) {
                throw new RangeError('CollisionSystem: rule.mover must be a single layer bit');
            }
            const moverSlot = layerSlot(rule.mover);
            this.moverTargets[moverSlot] |= rule.targets;
            targetLayers |= rule.targets;

            const tolerance = rule.yTolerance ?? Infinity;
            for (let slot = 0; slot < LAYER_SLOTS; slot++) {
                if ((rule.targets & (1 << slot)) !== 0) {
                    this.yTolerance[moverSlot * LAYER_SLOTS + slot] = tolerance;
                }
            }
        }
        this.targetLayers = targetLayers;
        this.gridLayers = targetLayers & ~config.directLayers;
    }

    /** Hits for this frame, nearest first per mover. Cheap no-op when no mover is collidable. */
    public update(
        movers: readonly ICollisionMover[],
        targets: readonly ICollisionTarget[],
    ): readonly ICollisionHit[] {
        this.clearHits();

        let maxRadius = -1;
        for (const mover of movers) {
            if (!mover.collisionEnabled || this.moverTargets[layerSlot(mover.collisionLayer)] === 0) continue;
            if (mover.collisionRadius > maxRadius) maxRadius = mover.collisionRadius;
        }
        if (maxRadius < 0) return this.result;

        this.collectTargets(targets, maxRadius);
        if (this.gridCount > 0 || this.directCount > 0) {
            for (const mover of movers) {
                if (mover.collisionEnabled) this.testMover(mover);
            }
        }
        this.releaseTargets();

        for (let i = 0; i < this.hitCount; i++) this.result.push(this.hitPool[i]);
        return this.result;
    }

    private clearHits(): void {
        for (let i = 0; i < this.hitCount; i++) {
            this.hitPool[i].mover = null;
            this.hitPool[i].target = null;
        }
        this.hitCount = 0;
        this.result.length = 0;
    }

    private collectTargets(targets: readonly ICollisionTarget[], maxRadius: number): void {
        this.grid.begin();
        this.gridCount = 0;
        this.directCount = 0;

        for (const target of targets) {
            if (!target.collisionEnabled || (target.collisionLayer & this.targetLayers) === 0) continue;
            const models = target.collisionModels;
            if (!models) continue;

            if ((target.collisionLayer & this.directLayers) !== 0) {
                this.directTargets[this.directCount++] = target;
                continue;
            }

            const halfX = models.broadHalfX + maxRadius;
            const halfZ = models.broadHalfZ + maxRadius;
            const p = target.position;
            this.grid.insert(p.x - halfX, p.z - halfZ, p.x + halfX, p.z + halfZ);
            this.gridTargets[this.gridCount++] = target;
        }
        this.grid.build();
    }

    private releaseTargets(): void {
        for (let i = 0; i < this.gridCount; i++) this.gridTargets[i] = null;
        for (let i = 0; i < this.directCount; i++) this.directTargets[i] = null;
        this.gridCount = 0;
        this.directCount = 0;
    }

    private testMover(mover: ICollisionMover): void {
        const moverSlot = layerSlot(mover.collisionLayer);
        const allowed = this.moverTargets[moverSlot];
        if (allowed === 0) return;

        const ax = mover.previousPosition.x;
        const az = mover.previousPosition.z;
        const bx = mover.position.x;
        const bz = mover.position.z;
        const pierces = mover.collisionPierces === true;

        this.bestT = Infinity;
        this.best = this.reserveHit();
        const firstHit = this.hitCount;

        const found = (allowed & this.gridLayers) === 0
            ? 0
            : this.grid.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
        const candidates = this.grid.candidates;
        for (let i = 0; i < found; i++) {
            this.consider(mover, this.gridTargets[candidates[i]]!, moverSlot, allowed, pierces, ax, az, bx, bz);
        }
        for (let i = 0; i < this.directCount; i++) {
            this.consider(mover, this.directTargets[i]!, moverSlot, allowed, pierces, ax, az, bx, bz);
        }

        if (pierces) {
            this.sortHitsByT(firstHit, this.hitCount);
        } else if (this.bestT < Infinity) {
            this.hitCount++;
        }
        this.best = null;
    }

    /** Insertion sort of hitPool[from, to); a mover only pierces a handful of targets per frame. */
    private sortHitsByT(from: number, to: number): void {
        for (let i = from + 1; i < to; i++) {
            const hit = this.hitPool[i];
            let j = i - 1;
            while (j >= from && this.hitPool[j].t > hit.t) {
                this.hitPool[j + 1] = this.hitPool[j];
                j--;
            }
            this.hitPool[j + 1] = hit;
        }
    }

    /** Records the pair's hit: every hit for piercing movers, otherwise only the nearest. */
    private consider(
        mover: ICollisionMover,
        target: ICollisionTarget,
        moverSlot: number,
        allowed: number,
        pierces: boolean,
        ax: number, az: number, bx: number, bz: number,
    ): void {
        const t = this.testPair(mover, target, moverSlot, allowed, ax, az, bx, bz);
        if (t < 0) return;

        if (pierces) {
            this.fillHit(this.best!, mover, target, t, ax, az, bx, bz);
            this.hitCount++;
            this.best = this.reserveHit();
        } else if (t < this.bestT) {
            this.bestT = t;
            this.fillHit(this.best!, mover, target, t, ax, az, bx, bz);
        }
    }

    /** Runs the filter and narrow stages for one pair. Returns the hit fraction, or -1 for a miss. */
    private testPair(
        mover: ICollisionMover,
        target: ICollisionTarget,
        moverSlot: number,
        allowed: number,
        ax: number, az: number, bx: number, bz: number,
    ): number {
        if ((target as unknown) === (mover as unknown)) return -1;
        if ((target.collisionLayer & allowed) === 0 || !target.collisionEnabled) return -1;

        const tolerance = this.yTolerance[moverSlot * LAYER_SLOTS + layerSlot(target.collisionLayer)];
        if (Math.abs(mover.position.y - target.position.y) > tolerance) return -1;

        const models = target.collisionModels;
        if (!models) return -1;
        const model = models.get(mover.collisionRadius);
        const bucketIndex = model.bucketIndexForRoll(target.getCollisionRoll());
        const bucket = model.buckets[bucketIndex];

        const tx = target.position.x;
        const tz = target.position.z;
        const lax = ax - tx;
        const laz = az - tz;
        const lbx = bx - tx;
        const lbz = bz - tz;

        const slab = this.slab;
        if (!clipSegmentToBox(lax, laz, lbx, lbz, bucket.minX, bucket.minZ, bucket.maxX, bucket.maxZ, slab)) {
            return -1;
        }
        if (!traceSegmentThroughMask(bucket, lax, laz, lbx, lbz, slab.tEnter, slab.tExit, this.maskHit)) {
            return -1;
        }
        this.hitBucket = bucketIndex;
        return this.maskHit.t;
    }

    private fillHit(
        hit: ICollisionHit,
        mover: ICollisionMover,
        target: ICollisionTarget,
        t: number,
        ax: number, az: number, bx: number, bz: number,
    ): void {
        hit.mover = mover;
        hit.target = target;
        hit.t = t;
        hit.x = ax + (bx - ax) * t;
        hit.z = az + (bz - az) * t;
        hit.localX = hit.x - target.position.x;
        hit.localZ = hit.z - target.position.z;
        hit.bucket = this.hitBucket;
    }

    private reserveHit(): ICollisionHit {
        let hit = this.hitPool[this.hitCount];
        if (!hit) {
            hit = { mover: null, target: null, t: 0, x: 0, z: 0, localX: 0, localZ: 0, bucket: 0 };
            this.hitPool[this.hitCount] = hit;
        }
        return hit;
    }
}

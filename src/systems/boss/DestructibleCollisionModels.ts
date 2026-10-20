import type { ICollisionBucket, ICollisionModelSource, ICollisionModelVariant } from '../../config/interfaces/interfaces.ts';
import type { DestructibleVoxelModel } from './DestructibleVoxelModel.ts';

/** A boss never rolls its footprint (the lean is small), so there is one bucket whatever the roll. */
class SingleBucket implements ICollisionModelVariant {
    public readonly buckets: readonly ICollisionBucket[];

    constructor(bucket: ICollisionBucket) {
        this.buckets = [bucket];
    }

    public bucketIndexForRoll(): number {
        return 0;
    }
}

/**
 * Collision footprints of a boss that is being shot to pieces: the collision system's view of a
 * DestructibleVoxelModel. Masks are built on first use for each mover radius and rebuilt the next time they are
 * asked for after a part has been destroyed, so a shot always sees the boss as it is now (and flies deeper
 * through the holes).
 */
export class DestructibleCollisionModels implements ICollisionModelSource {
    public readonly broadHalfX: number;
    public readonly broadHalfZ: number;

    private readonly model: DestructibleVoxelModel;
    private readonly cellsPerUnit: number;
    private readonly variants = new Map<number, { revision: number; variant: SingleBucket }>();

    constructor(model: DestructibleVoxelModel, cellsPerUnit: number) {
        this.model = model;
        this.cellsPerUnit = cellsPerUnit;
        const padding = 2 / cellsPerUnit;
        this.broadHalfX = model.width / 2 + padding;
        this.broadHalfZ = model.depth / 2 + padding;
    }

    public get(radius: number): ICollisionModelVariant {
        const cached = this.variants.get(radius);
        if (cached && cached.revision === this.model.revision) return cached.variant;

        const variant = new SingleBucket(this.model.buildMask(radius, this.cellsPerUnit));
        this.variants.set(radius, { revision: this.model.revision, variant });
        return variant;
    }

    /** True when a circle of this radius centred at local X/Z (relative to the boss's centre) touches a living column. */
    public overlapsCircle(localX: number, localZ: number, radius: number): boolean {
        const bucket = (this.get(radius) as SingleBucket).buckets[0];
        const col = Math.floor((localX - bucket.minX) * bucket.cellsPerUnit);
        const row = Math.floor((localZ - bucket.minZ) * bucket.cellsPerUnit);
        if (col < 0 || row < 0 || col >= bucket.cols || row >= bucket.rows) return false;
        return bucket.data[row * bucket.cols + col] !== 0;
    }
}

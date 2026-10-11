const EPS = 1e-6;
import type { ICollisionVoxel, ICollisionBakeOptions, ICollisionBucket } from '../../config/interfaces/interfaces';


/** All roll buckets of one model, baked for one mover radius. */
export class CollisionModel {
    public readonly radius: number;
    public readonly buckets: readonly ICollisionBucket[];
    private readonly rollScale: number;

    constructor(radius: number, buckets: readonly ICollisionBucket[]) {
        this.radius = radius;
        this.buckets = buckets;
        this.rollScale = buckets.length / (Math.PI * 2);
    }

    public bucketIndexForRoll(roll: number): number {
        const count = this.buckets.length;
        const index = Math.round(roll * this.rollScale) % count;
        return index < 0 ? index + count : index;
    }
}

/**
 * Baked collision footprints for one voxel model, one CollisionModel per mover radius.
 * Variants are baked on first request and cached, so call get() ahead of play to avoid hitches.
 */
export class CollisionModelSet {
    /** Roll-independent half extents (origin to farthest edge), padded for mask quantisation; the broadphase size. */
    public readonly broadHalfX: number;
    public readonly broadHalfZ: number;

    private readonly options: ICollisionBakeOptions;
    private readonly count: number;
    // Voxel centres relative to the model centre (the instanced geometry is centred on its bounding box).
    private readonly lx: Float64Array;
    private readonly ly: Float64Array;
    // Mask rows covered by each voxel along Z; roll about Z never changes these.
    private readonly rowFirst: Int32Array;
    private readonly rowLast: Int32Array;
    private readonly variants: CollisionModel[] = [];

    constructor(voxels: readonly ICollisionVoxel[], options: ICollisionBakeOptions) {
        if (voxels.length === 0) throw new Error('CollisionModelSet: model has no voxels');
        if (!(options.rollBuckets >= 1) || !Number.isInteger(options.rollBuckets)) {
            throw new RangeError('CollisionModelSet: rollBuckets must be a positive integer');
        }
        if (!(options.maskResolution >= 1)) {
            throw new RangeError('CollisionModelSet: maskResolution must be at least 1');
        }

        this.options = options;
        this.count = voxels.length;
        const res = options.maskResolution;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const v of voxels) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
            if (v.z < minZ) minZ = v.z;
            if (v.z > maxZ) maxZ = v.z;
        }
        const centerX = (minX + maxX + 1) / 2;
        const centerY = (minY + maxY + 1) / 2;
        const centerZ = (minZ + maxZ + 1) / 2;

        this.lx = new Float64Array(this.count);
        this.ly = new Float64Array(this.count);
        this.rowFirst = new Int32Array(this.count);
        this.rowLast = new Int32Array(this.count);

        let radiusXY = 0;
        let extentZ = 0;
        for (let i = 0; i < this.count; i++) {
            const v = voxels[i];
            const lx = v.x + 0.5 - centerX;
            const ly = v.y + 0.5 - centerY;
            const lz = v.z + 0.5 - centerZ;
            this.lx[i] = lx;
            this.ly[i] = ly;
            this.rowFirst[i] = Math.ceil((lz - 0.5 - EPS) * res - 0.5);
            this.rowLast[i] = Math.floor((lz + 0.5 + EPS) * res - 0.5);

            // Farthest corner in the X/Y plane: any roll can swing it onto the X axis.
            radiusXY = Math.max(radiusXY, Math.hypot(Math.abs(lx) + 0.5, Math.abs(ly) + 0.5));
            extentZ = Math.max(extentZ, Math.abs(lz) + 0.5);
        }

        const padding = 2 / res;
        this.broadHalfX = radiusXY + padding;
        this.broadHalfZ = extentZ + padding;
    }

    /** Footprints baked for movers of the given radius (world units). */
    public get(radius: number): CollisionModel {
        for (const variant of this.variants) {
            if (variant.radius === radius) return variant;
        }
        const variant = this.bake(radius);
        this.variants.push(variant);
        return variant;
    }

    private bake(radius: number): CollisionModel {
        const { rollBuckets, maskResolution: res } = this.options;
        const cellRadius = Math.max(0, radius) * res;
        const pad = Math.ceil(cellRadius - EPS);
        const disc = discOffsets(cellRadius, pad);

        const colFirst = new Int32Array(this.count);
        const colLast = new Int32Array(this.count);
        const buckets: ICollisionBucket[] = [];
        for (let k = 0; k < rollBuckets; k++) {
            buckets.push(this.bakeBucket((k * Math.PI * 2) / rollBuckets, pad, disc, colFirst, colLast));
        }
        return new CollisionModel(radius, buckets);
    }

    private bakeBucket(
        angle: number,
        pad: number,
        disc: Int32Array,
        colFirst: Int32Array,
        colLast: Int32Array,
    ): ICollisionBucket {
        const res = this.options.maskResolution;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Half width of a rolled unit cube projected onto the X axis.
        const half = (Math.abs(cos) + Math.abs(sin)) / 2;

        let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
        for (let i = 0; i < this.count; i++) {
            const x = this.lx[i] * cos - this.ly[i] * sin;
            const first = Math.ceil((x - half - EPS) * res - 0.5);
            const last = Math.max(first, Math.floor((x + half + EPS) * res - 0.5));
            colFirst[i] = first;
            colLast[i] = last;
            if (first < minCol) minCol = first;
            if (last > maxCol) maxCol = last;
            if (this.rowFirst[i] < minRow) minRow = this.rowFirst[i];
            if (this.rowLast[i] > maxRow) maxRow = this.rowLast[i];
        }

        const originCol = minCol - pad;
        const originRow = minRow - pad;
        const cols = maxCol - minCol + 1 + pad * 2;
        const rows = maxRow - minRow + 1 + pad * 2;

        const solid = new Uint8Array(cols * rows);
        for (let i = 0; i < this.count; i++) {
            for (let row = this.rowFirst[i]; row <= this.rowLast[i]; row++) {
                const rowBase = (row - originRow) * cols - originCol;
                for (let col = colFirst[i]; col <= colLast[i]; col++) {
                    solid[rowBase + col] = 1;
                }
            }
        }

        const data = pad > 0 ? dilate(solid, cols, rows, disc) : solid;
        const minX = originCol / res;
        const minZ = originRow / res;
        return {
            minX,
            minZ,
            maxX: minX + cols / res,
            maxZ: minZ + rows / res,
            cols,
            rows,
            cellsPerUnit: res,
            data,
        };
    }
}

/** Flattened (dx, dz) cell offsets inside a disc of the given cell radius. */
function discOffsets(cellRadius: number, pad: number): Int32Array {
    const offsets: number[] = [];
    const limit = cellRadius * cellRadius + EPS;
    for (let dz = -pad; dz <= pad; dz++) {
        for (let dx = -pad; dx <= pad; dx++) {
            if (dx * dx + dz * dz <= limit) offsets.push(dx, dz);
        }
    }
    return Int32Array.from(offsets);
}

function dilate(solid: Uint8Array, cols: number, rows: number, disc: Int32Array): Uint8Array {
    const out = new Uint8Array(solid.length);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (solid[row * cols + col] === 0) continue;
            for (let k = 0; k < disc.length; k += 2) {
                const c = col + disc[k];
                const r = row + disc[k + 1];
                if (c >= 0 && c < cols && r >= 0 && r < rows) out[r * cols + c] = 1;
            }
        }
    }
    return out;
}

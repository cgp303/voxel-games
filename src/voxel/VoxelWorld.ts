import type { IVoxel, IVoxelBounds } from '../config/interfaces/interfaces';

export interface IVoxelWorldSize {
    x: number;
    y: number;
    z: number;
}

/**
 * Dense voxel storage backed by a typed array.
 *
 * Cell index = x + y * width + z * width * height. A cell holds 0 when empty,
 * otherwise `colorIndex + 1` (so palette index 0 is still a solid voxel).
 * No string keys or per-voxel objects are created.
 */
export class VoxelWorld {
    private width: number;
    private height: number;
    private depth: number;
    private cells: Uint16Array;
    private count = 0;
    private bounds: IVoxelBounds = {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        minZ: 0,
        maxZ: 0,
    };

    /**
     * @param size Expected extent in voxels. Pass the model/terrain size so the
     * array is allocated once; coordinates beyond it grow the array.
     */
    constructor(size: IVoxelWorldSize = { x: 1, y: 1, z: 1 }) {
        this.width = Math.max(1, Math.ceil(size.x));
        this.height = Math.max(1, Math.ceil(size.y));
        this.depth = Math.max(1, Math.ceil(size.z));
        this.cells = new Uint16Array(this.width * this.height * this.depth);
    }

    public setVoxel(x: number, y: number, z: number, colorIndex: number) {
        if (!(x >= 0 && y >= 0 && z >= 0) || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
            throw new RangeError(`VoxelWorld: coordinates must be non-negative integers (got ${x}, ${y}, ${z})`);
        }
        if (x >= this.width || y >= this.height || z >= this.depth) {
            this.grow(x + 1, y + 1, z + 1);
        }
        const index = x + y * this.width + z * this.width * this.height;
        if (this.cells[index] === 0) this.count++;
        this.cells[index] = colorIndex + 1;
        this.updateBounds(x, y, z);
    }

    public hasVoxel(x: number, y: number, z: number): boolean {
        if (x < 0 || y < 0 || z < 0 || x >= this.width || y >= this.height || z >= this.depth) {
            return false;
        }
        return this.cells[x + y * this.width + z * this.width * this.height] !== 0;
    }

    /** Palette index of the voxel at the position, or -1 when empty. Allocation-free. */
    public getColorIndex(x: number, y: number, z: number): number {
        if (x < 0 || y < 0 || z < 0 || x >= this.width || y >= this.height || z >= this.depth) {
            return -1;
        }
        return this.cells[x + y * this.width + z * this.width * this.height] - 1;
    }

    /** Convenience accessor; allocates an object, so avoid it in hot loops. */
    public getVoxel(x: number, y: number, z: number): IVoxel | undefined {
        const colorIndex = this.getColorIndex(x, y, z);
        return colorIndex < 0 ? undefined : { x, y, z, colorIndex };
    }

    public removeVoxel(x: number, y: number, z: number) {
        if (!this.hasVoxel(x, y, z)) return;
        this.cells[x + y * this.width + z * this.width * this.height] = 0;
        this.count--;
    }

    /** Visits every voxel in x-fastest, then y, then z order without allocating. */
    public forEachVoxel(visit: (x: number, y: number, z: number, colorIndex: number) => void): void {
        const { width, height, depth, cells } = this;
        let index = 0;
        for (let z = 0; z < depth; z++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++, index++) {
                    const cell = cells[index];
                    if (cell !== 0) visit(x, y, z, cell - 1);
                }
            }
        }
    }

    public getAllVoxels(): IVoxel[] {
        const voxels: IVoxel[] = [];
        this.forEachVoxel((x, y, z, colorIndex) => voxels.push({ x, y, z, colorIndex }));
        return voxels;
    }

    public clear() {
        this.cells.fill(0);
        this.count = 0;
        this.bounds = {
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
            minZ: 0,
            maxZ: 0,
        };
    }

    public getBounds(): IVoxelBounds {
        return this.bounds;
    }

    public getVoxelCount(): number {
        return this.count;
    }

    /** Allocated extent in voxels. */
    public getDimensions(): IVoxelWorldSize {
        return { x: this.width, y: this.height, z: this.depth };
    }

    /**
     * Raw cell storage for hot loops (0 = empty, otherwise colorIndex + 1).
     * Index with x + y * width + z * width * height. Treat as read-only.
     */
    public getCells(): Readonly<Uint16Array> {
        return this.cells;
    }

    private grow(minWidth: number, minHeight: number, minDepth: number) {
        const width = Math.max(this.width, minWidth);
        const height = Math.max(this.height, minHeight);
        const depth = Math.max(this.depth, minDepth);
        const cells = new Uint16Array(width * height * depth);

        for (let z = 0; z < this.depth; z++) {
            for (let y = 0; y < this.height; y++) {
                const from = y * this.width + z * this.width * this.height;
                const to = y * width + z * width * height;
                cells.set(this.cells.subarray(from, from + this.width), to);
            }
        }

        this.width = width;
        this.height = height;
        this.depth = depth;
        this.cells = cells;
    }

    private updateBounds(x: number, y: number, z: number) {
        this.bounds.minX = Math.min(this.bounds.minX, x);
        this.bounds.maxX = Math.max(this.bounds.maxX, x + 1);
        this.bounds.minY = Math.min(this.bounds.minY, y);
        this.bounds.maxY = Math.max(this.bounds.maxY, y + 1);
        this.bounds.minZ = Math.min(this.bounds.minZ, z);
        this.bounds.maxZ = Math.max(this.bounds.maxZ, z + 1);
    }
}

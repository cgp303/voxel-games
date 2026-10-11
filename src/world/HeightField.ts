import type { IGradient2 } from '../config/interfaces/interfaces';

/**
 * Terrain surface as one height per voxel column (the top face of column (x, z) sits at that height).
 * Coordinates are tile-local voxel units: x in [0, width), z in [0, depth). Pure data, no rendering types.
 */
export class HeightField {
    public readonly width: number;
    public readonly depth: number;

    private readonly heights: ArrayLike<number>;
    private readonly wrapZ: boolean;

    /**
     * @param heights Row-major column heights, heights[z * width + x].
     * @param wrapZ True when the tile repeats along Z (the scrolling belt); false when it ends at its edges.
     */
    constructor(heights: ArrayLike<number>, width: number, depth: number, wrapZ: boolean) {
        if (!(width >= 1) || !(depth >= 1) || heights.length !== width * depth) {
            throw new RangeError('HeightField: heights must hold width * depth entries');
        }
        this.heights = heights;
        this.width = width;
        this.depth = depth;
        this.wrapZ = wrapZ;
    }

    /** Surface height of the column containing (lx, lz), or -Infinity outside the terrain. */
    public heightAt(lx: number, lz: number): number {
        return this.column(Math.floor(lx), Math.floor(lz), -Infinity);
    }

    /**
     * Surface slope (rise per unit along X and Z) at (lx, lz), from the neighbouring columns.
     * Zero outside the terrain; at an edge the missing neighbour is replaced by the column itself.
     */
    public gradientAt(lx: number, lz: number, out: IGradient2): IGradient2 {
        const ix = Math.floor(lx);
        const iz = Math.floor(lz);
        const here = this.column(ix, iz, -Infinity);
        if (here === -Infinity) {
            out.x = 0;
            out.z = 0;
            return out;
        }
        out.x = (this.column(ix + 1, iz, here) - this.column(ix - 1, iz, here)) / 2;
        out.z = (this.column(ix, iz + 1, here) - this.column(ix, iz - 1, here)) / 2;
        return out;
    }

    private column(ix: number, iz: number, outside: number): number {
        if (ix < 0 || ix >= this.width) return outside;
        let row = iz;
        if (this.wrapZ) {
            row = iz % this.depth;
            if (row < 0) row += this.depth;
        } else if (iz < 0 || iz >= this.depth) {
            return outside;
        }
        return this.heights[row * this.width + ix];
    }
}

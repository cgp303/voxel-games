import type { IGradient2 } from '../../config/interfaces/interfaces.ts';
import { CHUNK_X, CHUNK_Z, type ChunkLibrary } from './ChunkLibrary.ts';
import type { TerrainTrack } from './TerrainTrack.ts';

/**
 * Where the terrain sequence sits in the world, and how far it has scrolled.
 *
 * The belt is `cols` chunks wide, centred on X = 0. Row r of the track occupies a 32-unit slab of Z, and rows
 * get higher toward +Z: the ground scrolls toward -Z (toward the camera) and new rows appear at the far end.
 * Pure data and maths (no rendering types), so it can be tested under Node.
 */
export class TerrainBelt {
    public readonly cols: number;
    /** World Z where row 0 starts while nothing has scrolled. */
    public zBase: number;
    /** Distance the ground has moved toward -Z so far (never negative). */
    public travelled = 0;

    private readonly library: ChunkLibrary;
    private readonly track: TerrainTrack;

    constructor(library: ChunkLibrary, track: TerrainTrack, options: { cols: number; zBase?: number }) {
        this.library = library;
        this.track = track;
        this.cols = options.cols;
        this.zBase = options.zBase ?? 0;
    }

    /** World X of the belt's left edge. */
    public get minX(): number {
        return (-this.cols * CHUNK_X) / 2;
    }

    public get width(): number {
        return this.cols * CHUNK_X;
    }

    public advance(distance: number): void {
        this.travelled += Math.max(0, distance);
    }

    /** World Z of the low-Z edge of `row`. */
    public rowMinZ(row: number): number {
        return this.zBase + row * CHUNK_Z - this.travelled;
    }

    /** The row containing world Z (may be negative before row 0). */
    public rowAt(z: number): number {
        return Math.floor((z - this.zBase + this.travelled) / CHUNK_Z);
    }

    /** Surface height at world X/Z, or -Infinity outside the belt or before the first row. */
    public heightAt(x: number, z: number): number {
        const localX = x - this.minX;
        const col = Math.floor(localX / CHUNK_X);
        if (col < 0 || col >= this.cols) return -Infinity;
        const row = this.rowAt(z);
        if (row < 0) return -Infinity;

        const entry = this.library.get(this.track.idAt(row, col));
        const lx = Math.min(CHUNK_X - 1, Math.max(0, Math.floor(localX - col * CHUNK_X)));
        const lz = Math.min(CHUNK_Z - 1, Math.max(0, Math.floor(z - this.rowMinZ(row))));
        return entry.heights[lx + lz * CHUNK_X];
    }

    /**
     * Surface slope (rise per unit along X and Z) at world X/Z, from the neighbouring columns, across chunk borders.
     * Zero outside the terrain; where a neighbour is missing the column itself stands in for it.
     */
    public gradientAt(x: number, z: number, out: IGradient2): IGradient2 {
        const here = this.heightAt(x, z);
        if (here === -Infinity) {
            out.x = 0;
            out.z = 0;
            return out;
        }
        out.x = (this.neighbourHeight(x + 1, z, here) - this.neighbourHeight(x - 1, z, here)) / 2;
        out.z = (this.neighbourHeight(x, z + 1, here) - this.neighbourHeight(x, z - 1, here)) / 2;
        return out;
    }

    private neighbourHeight(x: number, z: number, fallback: number): number {
        const height = this.heightAt(x, z);
        return height === -Infinity ? fallback : height;
    }
}

import type { ICollisionBucket, ISlabResult, IMaskHit } from '../../config/interfaces/interfaces.ts';


/**
 * Slab test: clips the segment a -> b (X/Z) against an axis-aligned box.
 * On success writes the overlapping parameter range to `out` and returns true.
 * A segment that starts inside the box enters at t = 0.
 */
export function clipSegmentToBox(
    ax: number, az: number, bx: number, bz: number,
    minX: number, minZ: number, maxX: number, maxZ: number,
    out: ISlabResult,
): boolean {
    let tEnter = 0;
    let tExit = 1;

    const dx = bx - ax;
    if (dx === 0) {
        if (ax < minX || ax > maxX) return false;
    } else {
        let t0 = (minX - ax) / dx;
        let t1 = (maxX - ax) / dx;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        if (t0 > tEnter) tEnter = t0;
        if (t1 < tExit) tExit = t1;
        if (tEnter > tExit) return false;
    }

    const dz = bz - az;
    if (dz === 0) {
        if (az < minZ || az > maxZ) return false;
    } else {
        let t0 = (minZ - az) / dz;
        let t1 = (maxZ - az) / dz;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        if (t0 > tEnter) tEnter = t0;
        if (t1 < tExit) tExit = t1;
        if (tEnter > tExit) return false;
    }

    out.tEnter = tEnter;
    out.tExit = tExit;
    return true;
}

/**
 * Grid walk (Amanatides-Woo) of the segment a -> b through a bucket's occupancy mask,
 * visiting cells from tEnter to tExit. Coordinates are relative to the target origin.
 * Returns true and writes the entry parameter of the first solid cell to `out`.
 */
export function traceSegmentThroughMask(
    bucket: ICollisionBucket,
    ax: number, az: number, bx: number, bz: number,
    tEnter: number, tExit: number,
    out: IMaskHit,
): boolean {
    const { cols, rows, data, cellsPerUnit } = bucket;

    // Work in cell units with the mask origin at (0, 0).
    const sx = (ax - bucket.minX) * cellsPerUnit;
    const sz = (az - bucket.minZ) * cellsPerUnit;
    const dx = (bx - ax) * cellsPerUnit;
    const dz = (bz - az) * cellsPerUnit;

    let col = clampCell(Math.floor(sx + dx * tEnter), cols);
    let row = clampCell(Math.floor(sz + dz * tEnter), rows);

    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const deltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const deltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let nextX = dx === 0 ? Infinity : ((dx > 0 ? col + 1 : col) - sx) / dx;
    let nextZ = dz === 0 ? Infinity : ((dz > 0 ? row + 1 : row) - sz) / dz;

    let t = tEnter;
    for (; ;) {
        if (data[row * cols + col] !== 0) {
            out.t = t;
            return true;
        }
        if (nextX < nextZ) {
            if (nextX > tExit) return false;
            if (nextX > t) t = nextX;
            nextX += deltaX;
            col += stepX;
            if (col < 0 || col >= cols) return false;
        } else {
            if (nextZ > tExit) return false;
            if (nextZ > t) t = nextZ;
            nextZ += deltaZ;
            row += stepZ;
            if (row < 0 || row >= rows) return false;
        }
    }
}

function clampCell(cell: number, count: number): number {
    return cell < 0 ? 0 : cell >= count ? count - 1 : cell;
}

import { VoxelWorld } from '../../voxel/VoxelWorld.ts';
import { dilate, discOffsets } from '../collision/CollisionModel.ts';
import type { IBossDefinition, ICollisionBucket, IVoxel, IVoxelCloud } from '../../config/interfaces/interfaces.ts';
import type { BossPartRole } from '../../config/types/types.ts';

const EPS = 1e-9;

/** One hittable part of a boss: a group of voxel columns (every height) that is destroyed as a whole. */
export interface IBossPartState {
    id: string;
    role?: BossPartRole;
    /** True for the auto-tiled armour, false for a part the JSON names. */
    hull: boolean;
    /** Hits it takes to destroy. */
    hitsMax: number;
    /** Hits left; the part is destroyed at 0. */
    hits: number;
    alive: boolean;
    /** Indices (x + z * width) of the voxel columns the part owns. */
    columns: number[];
}

/** What a hit did. `removed` and `chunk` are the voxels that left the model, ready to become debris. */
export interface IBossDamage {
    /** The part that took the hit, or -1 when nothing was hit. */
    part: number;
    destroyed: boolean;
    /** The core was destroyed: the boss is dead. */
    coreDestroyed: boolean;
    /** Voxels of the part that was destroyed. */
    removed: IVoxel[];
    /** Voxels of parts cut off from the anchor by this hit (they fall away). */
    chunk: IVoxel[];
    /** Indices of the parts that were cut off. */
    detachedParts: number[];
}

/**
 * The voxels of a boss, split into hittable parts. Parts are groups of voxel columns (the footprint is what shots
 * and the player care about; height is not used for collision), so destroying a part removes its whole columns.
 * Voxel columns the JSON does not name are tiled into armour parts. A part cut off from the anchor falls away.
 * Pure data and logic: the mesh, mask and effects are built from it elsewhere.
 * Model space: x and z are the footprint, y is height; positions given "local" are relative to the model's centre.
 */
export class DestructibleVoxelModel {
    public readonly width: number;
    public readonly height: number;
    public readonly depth: number;
    /** The living voxels; edited as parts are destroyed. */
    public readonly world: VoxelWorld;
    public readonly parts: IBossPartState[] = [];
    public readonly coreIndex: number;
    /** The part the rest must stay connected to: the one with role "anchor", else the core. */
    public readonly anchorIndex: number;

    private readonly columnPart: Int32Array;
    private readonly totalVoxels: number;
    private readonly partIndexById = new Map<string, number>();
    /** Columns of destroyed parts, for drip effects. */
    private readonly holes: number[] = [];
    /** Bumped on every change, so caches (mask, mesh) know when to rebuild. */
    private revisionCounter = 0;

    constructor(definition: IBossDefinition, voxels: readonly IVoxel[]) {
        this.width = definition.size.x;
        this.height = definition.size.y;
        this.depth = definition.size.z;
        this.world = new VoxelWorld({ x: this.width, y: this.height, z: this.depth });
        for (const v of voxels) {
            if (v.x >= this.width || v.y >= this.height || v.z >= this.depth) {
                throw new Error(`Boss "${definition.id}": the model has a voxel at ${v.x},${v.y},${v.z}, outside its declared size`);
            }
            this.world.setVoxel(v.x, v.y, v.z, v.colorIndex);
        }
        this.totalVoxels = this.world.getVoxelCount();

        const columns = this.width * this.depth;
        this.columnPart = new Int32Array(columns).fill(-1);
        const solid = new Uint8Array(columns);
        for (let z = 0; z < this.depth; z++) {
            for (let x = 0; x < this.width; x++) {
                if (this.columnHasVoxels(x, z)) solid[x + z * this.width] = 1;
            }
        }

        for (const def of definition.parts) {
            const index = this.parts.length;
            const part: IBossPartState = { id: def.id, role: def.role, hull: false, hitsMax: def.hits, hits: def.hits, alive: true, columns: [] };
            for (const [x0, z0, x1, z1] of def.rects) {
                for (let z = z0; z <= z1; z++) {
                    for (let x = x0; x <= x1; x++) {
                        const column = x + z * this.width;
                        if (!solid[column] || this.columnPart[column] >= 0) continue;
                        this.columnPart[column] = index;
                        part.columns.push(column);
                    }
                }
            }
            if (part.columns.length === 0) {
                throw new Error(`Boss "${definition.id}": part "${def.id}" covers no voxels`);
            }
            this.partIndexById.set(def.id, index);
            this.parts.push(part);
        }

        this.tileHull(definition, solid);

        this.coreIndex = this.parts.findIndex((p) => p.role === 'core');
        const anchor = this.parts.findIndex((p) => p.role === 'anchor');
        this.anchorIndex = anchor >= 0 ? anchor : this.coreIndex;
    }

    /** Changes whenever a part is destroyed. */
    public get revision(): number {
        return this.revisionCounter;
    }

    public get voxelCount(): number {
        return this.world.getVoxelCount();
    }

    /** Share (0..1) of the original voxels that have been lost. */
    public get damageFraction(): number {
        return this.totalVoxels === 0 ? 0 : 1 - this.world.getVoxelCount() / this.totalVoxels;
    }

    /** Index of the part with this id, or -1. */
    public indexOf(id: string): number {
        return this.partIndexById.get(id) ?? -1;
    }

    /** False for an unknown id. */
    public isAlive(id: string): boolean {
        const index = this.partIndexById.get(id);
        return index !== undefined && this.parts[index].alive;
    }

    /** The living part that owns column (x, z), or -1. */
    public partAtColumn(x: number, z: number): number {
        if (x < 0 || z < 0 || x >= this.width || z >= this.depth) return -1;
        return this.columnPart[x + z * this.width];
    }

    /**
     * The living part nearest to a point (local X/Z, relative to the model's centre) within `reach` world units,
     * measured to the nearest edge of its columns; ties go to the column nearest the front (smallest z).
     * Returns -1 when nothing is that close.
     */
    public nearestPart(localX: number, localZ: number, reach: number): number {
        const cx = localX + this.width / 2;
        const cz = localZ + this.depth / 2;
        const xFirst = Math.max(0, Math.floor(cx - reach));
        const xLast = Math.min(this.width - 1, Math.floor(cx + reach));
        const zFirst = Math.max(0, Math.floor(cz - reach));
        const zLast = Math.min(this.depth - 1, Math.floor(cz + reach));

        let best = -1;
        let bestDistance = reach * reach + EPS;
        let bestZ = Infinity;
        for (let z = zFirst; z <= zLast; z++) {
            for (let x = xFirst; x <= xLast; x++) {
                const part = this.columnPart[x + z * this.width];
                if (part < 0) continue;
                const dx = Math.max(x - cx, 0, cx - (x + 1));
                const dz = Math.max(z - cz, 0, cz - (z + 1));
                const distance = dx * dx + dz * dz;
                if (distance < bestDistance - EPS || (Math.abs(distance - bestDistance) <= EPS && z < bestZ)) {
                    best = part;
                    bestDistance = distance;
                    bestZ = z;
                }
            }
        }
        return best;
    }

    /**
     * Spends `power` hits on a part. When its hits run out the part is destroyed (its columns leave the model) and,
     * unless `cutOffLoose` is false, anything no longer connected to the anchor is cut off too. Destroying the core
     * ends the fight, so nothing is cut off then.
     */
    public damage(partIndex: number, power: number, cutOffLoose = true): IBossDamage {
        const result: IBossDamage = { part: partIndex, destroyed: false, coreDestroyed: false, removed: [], chunk: [], detachedParts: [] };
        const part = this.parts[partIndex];
        if (!part || !part.alive) return { ...result, part: -1 };

        part.hits -= power;
        if (part.hits > EPS) return result;
        part.hits = 0;

        result.destroyed = true;
        this.destroyPart(partIndex, result.removed);
        if (partIndex === this.coreIndex) {
            result.coreDestroyed = true;
            return result;
        }
        if (cutOffLoose) this.cutOffLooseParts(result);
        return result;
    }

    /** Every voxel still in the model. */
    public remainingVoxels(): IVoxel[] {
        return this.world.getAllVoxels();
    }

    /**
     * A random column on the rim of a hole (a destroyed column next to a living one), as local X/Z and the top
     * voxel height it had. Returns false when there is no hole yet. Used to drip fire from damage.
     */
    public randomRimPoint(random: () => number, out: { x: number; y: number; z: number }): boolean {
        const holes = this.holes;
        for (let attempt = 0; attempt < 8 && holes.length > 0; attempt++) {
            const column = holes[Math.floor(random() * holes.length)];
            const x = column % this.width;
            const z = (column - x) / this.width;
            if (
                this.partAtColumn(x - 1, z) < 0 && this.partAtColumn(x + 1, z) < 0 &&
                this.partAtColumn(x, z - 1) < 0 && this.partAtColumn(x, z + 1) < 0
            ) {
                continue;
            }
            out.x = x + 0.5 - this.width / 2;
            out.y = this.height;
            out.z = z + 0.5 - this.depth / 2;
            return true;
        }
        return false;
    }

    /**
     * Footprint of the living columns on a grid of `cellsPerUnit` cells per world unit, grown by `radius` (a mover of
     * that radius touches the mask when its centre is inside a solid cell). Same layout as a baked collision bucket.
     */
    public buildMask(radius: number, cellsPerUnit: number): ICollisionBucket {
        const res = cellsPerUnit;
        const cellRadius = Math.max(0, radius) * res;
        const pad = Math.ceil(cellRadius - EPS);
        const cols = this.width * res + pad * 2;
        const rows = this.depth * res + pad * 2;

        const solid = new Uint8Array(cols * rows);
        for (let z = 0; z < this.depth; z++) {
            for (let x = 0; x < this.width; x++) {
                if (this.columnPart[x + z * this.width] < 0) continue;
                for (let r = 0; r < res; r++) {
                    const rowBase = (pad + z * res + r) * cols + pad + x * res;
                    for (let c = 0; c < res; c++) solid[rowBase + c] = 1;
                }
            }
        }

        const data = pad > 0 ? dilate(solid, cols, rows, discOffsets(cellRadius, pad)) : solid;
        const minX = -this.width / 2 - pad / res;
        const minZ = -this.depth / 2 - pad / res;
        return { minX, minZ, maxX: minX + cols / res, maxZ: minZ + rows / res, cols, rows, cellsPerUnit: res, data };
    }

    private columnHasVoxels(x: number, z: number): boolean {
        for (let y = 0; y < this.height; y++) {
            if (this.world.hasVoxel(x, y, z)) return true;
        }
        return false;
    }

    /** Splits the columns no part owns into tiles, and each tile's connected pieces into armour parts. */
    private tileHull(definition: IBossDefinition, solid: Uint8Array): void {
        const { tile, hits } = definition.hull;
        const claimed = new Uint8Array(solid.length);
        const stack: number[] = [];
        let count = 0;

        for (let start = 0; start < solid.length; start++) {
            if (!solid[start] || this.columnPart[start] >= 0 || claimed[start]) continue;

            const index = this.parts.length;
            const part: IBossPartState = { id: `hull-${count++}`, hull: true, hitsMax: hits, hits, alive: true, columns: [] };
            const startX = start % this.width;
            const startZ = (start - startX) / this.width;
            const tileX = Math.floor(startX / tile.w);
            const tileZ = Math.floor(startZ / tile.d);

            claimed[start] = 1;
            stack.push(start);
            while (stack.length > 0) {
                const column = stack.pop()!;
                this.columnPart[column] = index;
                part.columns.push(column);
                const x = column % this.width;
                const z = (column - x) / this.width;
                for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
                    if (nx < 0 || nz < 0 || nx >= this.width || nz >= this.depth) continue;
                    if (Math.floor(nx / tile.w) !== tileX || Math.floor(nz / tile.d) !== tileZ) continue;
                    const next = nx + nz * this.width;
                    if (!solid[next] || this.columnPart[next] >= 0 || claimed[next]) continue;
                    claimed[next] = 1;
                    stack.push(next);
                }
            }
            this.parts.push(part);
        }
    }

    /** Removes a part's voxels from the model, appending them to `into`. */
    private destroyPart(partIndex: number, into: IVoxel[]): void {
        const part = this.parts[partIndex];
        part.alive = false;
        for (const column of part.columns) {
            const x = column % this.width;
            const z = (column - x) / this.width;
            for (let y = 0; y < this.height; y++) {
                const colorIndex = this.world.getColorIndex(x, y, z);
                if (colorIndex < 0) continue;
                into.push({ x, y, z, colorIndex });
                this.world.removeVoxel(x, y, z);
            }
            this.columnPart[column] = -1;
            this.holes.push(column);
        }
        this.revisionCounter++;
    }

    /** Destroys every living part with no column connected (through living columns) to the anchor or the core. */
    private cutOffLooseParts(result: IBossDamage): void {
        const seeds = [this.anchorIndex, this.coreIndex].filter((i) => this.parts[i].alive);
        if (seeds.length === 0) return;

        const reached = new Uint8Array(this.columnPart.length);
        const stack: number[] = [];
        for (const seed of seeds) {
            for (const column of this.parts[seed].columns) {
                if (!reached[column]) {
                    reached[column] = 1;
                    stack.push(column);
                }
            }
        }
        while (stack.length > 0) {
            const column = stack.pop()!;
            const x = column % this.width;
            const z = (column - x) / this.width;
            for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
                if (this.partAtColumn(nx, nz) < 0) continue;
                const next = nx + nz * this.width;
                if (reached[next]) continue;
                reached[next] = 1;
                stack.push(next);
            }
        }

        for (let i = 0; i < this.parts.length; i++) {
            const part = this.parts[i];
            if (!part.alive || part.columns.some((c) => reached[c])) continue;
            result.detachedParts.push(i);
            this.destroyPart(i, result.chunk);
        }
    }
}

/**
 * Voxels as debris offsets: one cube per voxel, relative to the model's centre (the origin a boss is placed by),
 * in the palette's true colour like buildVoxelCloud.
 */
export function voxelsToCloud(
    voxels: readonly IVoxel[],
    palette: ReadonlyArray<{ r: number; g: number; b: number }>,
    size: { x: number; y: number; z: number },
): IVoxelCloud {
    const count = voxels.length;
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const z = new Float32Array(count);
    const r = new Float32Array(count);
    const g = new Float32Array(count);
    const b = new Float32Array(count);
    const paletteSize = Math.max(palette.length, 1);
    for (let i = 0; i < count; i++) {
        const v = voxels[i];
        x[i] = v.x + 0.5 - size.x / 2;
        y[i] = v.y + 0.5 - size.y / 2;
        z[i] = v.z + 0.5 - size.z / 2;
        const color = palette[v.colorIndex % paletteSize];
        r[i] = (color?.r || 0) / 255;
        g[i] = (color?.g || 0) / 255;
        b[i] = (color?.b || 0) / 255;
    }
    return { count, x, y, z, r, g, b };
}

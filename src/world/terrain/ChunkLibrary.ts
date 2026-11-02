import type { IChunkEntry, IChunkSource, IGreedyOptions, IVoxelMeshBuffers } from '../../config/interfaces/interfaces.ts';
import { greedyQuadsFromCells, meshFromQuads } from '../../voxel/GreedyMesher.ts';

/** Terrain chunk size in voxels (1 voxel = 1 world unit). */
export const CHUNK_X = 32;
export const CHUNK_Y = 8;
export const CHUNK_Z = 32;
export const CHUNK_CELLS = CHUNK_X * CHUNK_Y * CHUNK_Z;

/** Height of the flat border chunks share unless the library is given another edge profile. */
export const DEFAULT_EDGE_HEIGHT = 3;

/**
 * Chunks only ever see the camera from above and sit edge to edge, so everything that cannot be seen is
 * dropped or used to merge faces: downward faces, faces on the chunk's side borders (neutral chunks), faces between voxels.
 */
const SEALED_MESH_OPTIONS: IGreedyOptions = {
    cullBottomFaces: true,
    cullDownFaces: true,
    coverHiddenFaces: true,
    solidLateralBorders: true,
    tryBothOrientations: true,
};

/** Same, but the border faces stay: right beside any chunk. */
const OPEN_MESH_OPTIONS: IGreedyOptions = { ...SEALED_MESH_OPTIONS, solidLateralBorders: false };

/**
 * All terrain chunks, each meshed once when added; the id returned by add() is what terrain styles store.
 *
 * Neutral chunks (the default) share one border convention: chunks are meshed as if the space past their side borders
 * were solid, which is only true when every neutral chunk's four borders are the same profile: along each border the
 * column at position i is solid up to `edgeProfile[i]` voxels and empty above. That lets any neutral chunk sit next to
 * any other, and any style switch to any other at a row boundary, without a visible seam. add() rejects neutral chunks
 * that break it.
 *
 * Open chunks (hand-authored tiles) may have any borders and keep their border faces. A neutral chunk next to an open one
 * needs its border faces back: openBuffers() is that mesh, which ChunkField picks per placement.
 */
export class ChunkLibrary {
    /** Border height along a chunk edge, one entry per voxel; entry 0 equals the last (corners are shared). */
    public readonly edgeProfile: Uint8Array;

    private readonly entries: IChunkEntry[] = [];
    /** What neutral chunks were made from, to mesh their border faces on demand. */
    private readonly sealedSources = new Map<number, IChunkSource>();
    private readonly openMeshes = new Map<number, IVoxelMeshBuffers>();

    constructor(edgeProfile: ArrayLike<number> = new Uint8Array(CHUNK_X).fill(DEFAULT_EDGE_HEIGHT)) {
        if (edgeProfile.length !== CHUNK_X || CHUNK_X !== CHUNK_Z) {
            throw new RangeError(`ChunkLibrary: edge profile needs ${CHUNK_X} entries`);
        }
        const profile = new Uint8Array(CHUNK_X);
        for (let i = 0; i < CHUNK_X; i++) {
            const height = edgeProfile[i];
            if (!Number.isInteger(height) || height < 0 || height > CHUNK_Y) {
                throw new RangeError(`ChunkLibrary: edge profile entry ${i} must be an integer 0-${CHUNK_Y} (got ${height})`);
            }
            profile[i] = height;
        }
        if (profile[0] !== profile[CHUNK_X - 1]) {
            throw new RangeError('ChunkLibrary: edge profile must start and end at the same height (chunk corners are shared)');
        }
        this.edgeProfile = profile;
    }

    public get size(): number {
        return this.entries.length;
    }

    /** Registers a chunk and returns its id. Throws if its cells are the wrong size, or a neutral chunk's borders are not the edge profile. */
    public add(source: IChunkSource): number {
        const name = source.name ?? `chunk ${this.entries.length}`;
        if (source.cells.length !== CHUNK_CELLS) {
            throw new RangeError(`ChunkLibrary: ${name} needs ${CHUNK_CELLS} cells (${CHUNK_X}x${CHUNK_Y}x${CHUNK_Z}), got ${source.cells.length}`);
        }
        const sealed = (source.borders ?? 'neutral') === 'neutral';
        if (sealed) {
            const mismatch = this.findBorderMismatch(source.cells);
            if (mismatch) {
                throw new RangeError(`ChunkLibrary: ${name} breaks the edge profile at ${mismatch}`);
            }
        }

        const id = this.entries.length;
        this.entries.push({
            id,
            name,
            sealed,
            buffers: meshChunk(source, sealed ? SEALED_MESH_OPTIONS : OPEN_MESH_OPTIONS),
            heights: columnHeights(source.cells),
        });
        if (sealed) this.sealedSources.set(id, source);
        return id;
    }

    public get(id: number): IChunkEntry {
        const entry = this.entries[id];
        if (!entry) throw new RangeError(`ChunkLibrary: no chunk with id ${id}`);
        return entry;
    }

    /** The chunk's mesh with its border faces kept, for placing it beside a chunk that is not neutral. */
    public openBuffers(id: number): IVoxelMeshBuffers {
        const entry = this.get(id);
        if (!entry.sealed) return entry.buffers;
        let buffers = this.openMeshes.get(id);
        if (!buffers) {
            buffers = meshChunk(this.sealedSources.get(id)!, OPEN_MESH_OPTIONS);
            this.openMeshes.set(id, buffers);
        }
        return buffers;
    }

    /** Describes the first border voxel that differs from the edge profile, or null when all four borders match. */
    private findBorderMismatch(cells: Uint16Array): string | null {
        for (let i = 0; i < CHUNK_X; i++) {
            for (let y = 0; y < CHUNK_Y; y++) {
                const solid = y < this.edgeProfile[i];
                const borders: Array<[string, number]> = [
                    ['x=0', cellIndex(0, y, i)],
                    ['x=31', cellIndex(CHUNK_X - 1, y, i)],
                    ['z=0', cellIndex(i, y, 0)],
                    ['z=31', cellIndex(i, y, CHUNK_Z - 1)],
                ];
                for (const [border, index] of borders) {
                    if ((cells[index] !== 0) !== solid) return `${border}, position ${i}, y=${y}`;
                }
            }
        }
        return null;
    }
}

function cellIndex(x: number, y: number, z: number): number {
    return x + y * CHUNK_X + z * CHUNK_X * CHUNK_Y;
}

function meshChunk(source: IChunkSource, options: IGreedyOptions): IVoxelMeshBuffers {
    const quads = greedyQuadsFromCells(source.cells, { x: CHUNK_X, y: CHUNK_Y, z: CHUNK_Z }, options);
    return meshFromQuads(quads, source.palette, true);
}

/** Highest solid voxel + 1 per column, index x + z * CHUNK_X. */
function columnHeights(cells: Uint16Array): Uint8Array {
    const heights = new Uint8Array(CHUNK_X * CHUNK_Z);
    for (let z = 0; z < CHUNK_Z; z++) {
        for (let x = 0; x < CHUNK_X; x++) {
            for (let y = CHUNK_Y - 1; y >= 0; y--) {
                if (cells[cellIndex(x, y, z)] !== 0) {
                    heights[x + z * CHUNK_X] = y + 1;
                    break;
                }
            }
        }
    }
    return heights;
}

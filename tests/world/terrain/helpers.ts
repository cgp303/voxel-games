import { CHUNK_CELLS, CHUNK_X, CHUNK_Y, CHUNK_Z, DEFAULT_EDGE_HEIGHT } from '../../../src/world/terrain/ChunkLibrary.ts';
import type { IChunkSource } from '../../../src/config/interfaces/interfaces.ts';

const PALETTE = [
    { r: 255, g: 0, b: 0, a: 255 },
    { r: 0, g: 255, b: 0, a: 255 },
];

/**
 * A chunk whose border is `edgeHeight` high and whose interior is `interiorHeight(x, z)` high,
 * coloured by `colorIndex`. The default edge height matches ChunkLibrary's default profile.
 */
export function makeChunk(
    interiorHeight: (x: number, z: number) => number,
    options: { edgeHeight?: number; colorIndex?: number; name?: string } = {},
): IChunkSource {
    const edgeHeight = options.edgeHeight ?? DEFAULT_EDGE_HEIGHT;
    const cells = new Uint16Array(CHUNK_CELLS);
    for (let z = 0; z < CHUNK_Z; z++) {
        for (let x = 0; x < CHUNK_X; x++) {
            const border = x === 0 || z === 0 || x === CHUNK_X - 1 || z === CHUNK_Z - 1;
            const height = border ? edgeHeight : Math.min(CHUNK_Y, interiorHeight(x, z));
            for (let y = 0; y < height; y++) cells[x + y * CHUNK_X + z * CHUNK_X * CHUNK_Y] = (options.colorIndex ?? 0) + 1;
        }
    }
    return { name: options.name, cells, palette: PALETTE };
}

import type { IChunkSource, IParsedVoxModel } from '../../config/interfaces/interfaces.ts';
import { CHUNK_CELLS, CHUNK_X, CHUNK_Y, CHUNK_Z } from './ChunkLibrary.ts';

/**
 * Turns a parsed .vox tile into a terrain chunk.
 *
 * The tile must be exactly 32 x 8 x 32 voxels, with its axes taken as they are in the file: x across, y up (the 8),
 * z along the direction of travel. (Models such as bosses and the font are turned from MagicaVoxel's z-up; a chunk is not,
 * because only the 8-voxel axis can be the height.) Voxels keep their palette colours. Chunks made here are 'open':
 * a tile may have any content, including floating voxels, and its border faces are kept.
 */
export function chunkFromVoxModel(model: IParsedVoxModel, name: string): IChunkSource {
    const { x, y, z } = model.size;
    if (x !== CHUNK_X || y !== CHUNK_Y || z !== CHUNK_Z) {
        throw new RangeError(
            `Terrain tile ${name} is ${x} x ${y} x ${z} voxels but must be ${CHUNK_X} x ${CHUNK_Y} x ${CHUNK_Z} ` +
                `(file x across, file y up, file z along the direction of travel)`,
        );
    }

    const cells = new Uint16Array(CHUNK_CELLS);
    for (const voxel of model.voxels) {
        if (voxel.x >= CHUNK_X || voxel.y >= CHUNK_Y || voxel.z >= CHUNK_Z) {
            throw new RangeError(`Terrain tile ${name} has a voxel outside the tile at ${voxel.x}, ${voxel.y}, ${voxel.z}`);
        }
        cells[voxel.x + voxel.y * CHUNK_X + voxel.z * CHUNK_X * CHUNK_Y] = voxel.colorIndex + 1;
    }
    return { name, cells, palette: model.colors, borders: 'open' };
}

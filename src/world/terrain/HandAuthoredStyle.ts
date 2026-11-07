import type { IHandAuthoredStyleSpec, IParsedVoxModel, ITerrainStyle } from '../../config/interfaces/interfaces.ts';
import type { ChunkLibrary } from './ChunkLibrary.ts';
import { createTerrainStyle } from './TerrainStyle.ts';
import { chunkFromVoxModel } from './VoxChunkLoader.ts';

/**
 * Builds a style from hand-authored tiles and registers them in `library`. `models` holds each tile's parsed .vox
 * by the manifest key the spec names it with. A tile used in several places is registered once and shares one id.
 */
export function buildHandAuthoredStyle(
    library: ChunkLibrary,
    spec: IHandAuthoredStyleSpec,
    models: Readonly<Record<string, IParsedVoxModel>>,
): ITerrainStyle {
    const { name, tiles, grid } = spec;
    if (grid.length === 0 || grid[0].length === 0) {
        throw new RangeError(`Terrain style ${name}: grid needs at least one row and one column`);
    }
    const cols = grid[0].length;
    const ids: number[] = [];
    for (let row = 0; row < grid.length; row++) {
        if (grid[row].length !== cols) {
            throw new RangeError(`Terrain style ${name}: grid row ${row} has ${grid[row].length} columns, expected ${cols}`);
        }
        for (const tile of grid[row]) {
            if (!Number.isInteger(tile) || tile < 0 || tile >= tiles.length) {
                throw new RangeError(`Terrain style ${name}: grid row ${row} uses tile ${tile}, but there are ${tiles.length} tiles`);
            }
        }
    }

    const tileIds = new Map<number, number>();
    for (const row of grid) {
        for (const tile of row) {
            if (tileIds.has(tile)) continue;
            const key = tiles[tile];
            const model = models[key];
            if (!model) throw new RangeError(`Terrain style ${name}: tile model "${key}" has not been loaded`);
            tileIds.set(tile, library.add(chunkFromVoxModel(model, key)));
        }
    }

    for (const row of grid) for (const tile of row) ids.push(tileIds.get(tile)!);
    return createTerrainStyle({
        name,
        cols,
        rows: grid.length,
        ids,
        introRows: spec.introRows,
        loopStartRow: spec.loopStartRow,
        loopEndRow: spec.loopEndRow,
    });
}

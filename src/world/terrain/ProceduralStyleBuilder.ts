import type { IProceduralStyleOptions, ITerrainStyle } from '../../config/interfaces/interfaces.ts';
import { ColorPalette } from '../../voxel-landscape/ColorPalette.ts';
import { NoiseGenerator } from '../../voxel-landscape/NoiseGenerator.ts';
import { CHUNK_CELLS, CHUNK_X, CHUNK_Y, CHUNK_Z, type ChunkLibrary } from './ChunkLibrary.ts';
import { createTerrainStyle } from './TerrainStyle.ts';

/**
 * Builds a terrain style from seeded noise and registers its chunks in `library`.
 *
 * The noise is sampled on a torus the size of the whole style, so the style wraps seamlessly in both
 * directions. Heights then blend towards the library's edge profile within `edgeBlend` voxels of every chunk
 * border, which is what lets the chunks (and other styles) sit edge to edge. Each column is one colour
 * (height colour, darkened by one of `slopeLevels` slope shades). Chunks with identical content share an id.
 */
export function buildProceduralStyle(library: ChunkLibrary, options: IProceduralStyleOptions): ITerrainStyle {
    const { name, config, cols, rows } = options;
    const slopeLevels = Math.max(1, Math.floor(options.slopeLevels));
    const maxHeight = Math.min(CHUNK_Y, Math.max(1, Math.floor(config.maxHeight)));
    const width = cols * CHUNK_X;
    const depth = rows * CHUNK_Z;

    const heights = sampleHeights(library, options, width, depth, maxHeight);
    const palette = buildPalette(options, maxHeight, slopeLevels);
    const colorIndex = columnColors(heights, width, depth, maxHeight, slopeLevels);

    const ids = new Uint16Array(cols * rows);
    const known = new Map<string, number>();
    const cells = new Uint16Array(CHUNK_CELLS);
    const codes: number[] = new Array(CHUNK_X * CHUNK_Z);
    for (let cz = 0; cz < rows; cz++) {
        for (let cx = 0; cx < cols; cx++) {
            cells.fill(0);
            for (let lz = 0; lz < CHUNK_Z; lz++) {
                for (let lx = 0; lx < CHUNK_X; lx++) {
                    const column = (cz * CHUNK_Z + lz) * width + cx * CHUNK_X + lx;
                    const height = heights[column];
                    const cell = colorIndex[column] + 1;
                    for (let y = 0; y < height; y++) cells[lx + y * CHUNK_X + lz * CHUNK_X * CHUNK_Y] = cell;
                    codes[lx + lz * CHUNK_X] = cell * 16 + height;
                }
            }

            const key = String.fromCharCode(...codes);
            let id = known.get(key);
            if (id === undefined) {
                id = library.add({ name: `${name} ${cx},${cz}`, cells: cells.slice(), palette });
                known.set(key, id);
            }
            ids[cz * cols + cx] = id;
        }
    }

    return createTerrainStyle({
        name,
        cols,
        rows,
        ids,
        introRows: options.introRows,
        loopStartRow: options.loopStartRow,
        loopEndRow: options.loopEndRow,
    });
}

/** Whole-voxel column heights of the style, index x + z * width. */
function sampleHeights(
    library: ChunkLibrary,
    options: IProceduralStyleOptions,
    width: number,
    depth: number,
    maxHeight: number,
): Uint8Array {
    const { config } = options;
    const noise = NoiseGenerator.withSeed(config.seed);
    // Keep the feature size per voxel the same as a tile of config.tileSize voxels would give.
    const radiusX = (config.noiseScale * width) / config.tileSize;
    const radiusZ = (config.noiseScale * depth) / config.tileSize;
    const profile = library.edgeProfile;
    const blend = Math.max(0, options.edgeBlend);

    const heights = new Uint8Array(width * depth);
    for (let z = 0; z < depth; z++) {
        const angleZ = (2 * Math.PI * z) / depth;
        const lz = z % CHUNK_Z;
        for (let x = 0; x < width; x++) {
            const angleX = (2 * Math.PI * x) / width;
            let noiseHeight = noise.getPerlinNoise4D(
                Math.cos(angleX) * radiusX,
                Math.sin(angleX) * radiusX,
                Math.cos(angleZ) * radiusZ,
                Math.sin(angleZ) * radiusZ,
                config.noiseOctaves,
                config.noisePersistence,
                config.noiseLacunarity,
            );
            // Same curve as TerrainGenerator, so styles look like the terrain they replace.
            noiseHeight = (noiseHeight + 1) * 0.5;
            noiseHeight = Math.pow(noiseHeight, 1 / config.noiseExponent);

            const lx = x % CHUNK_X;
            const toX = Math.min(lx, CHUNK_X - 1 - lx);
            const toZ = Math.min(lz, CHUNK_Z - 1 - lz);
            const edgeDistance = Math.min(toX, toZ);
            const target = toX <= toZ ? profile[lz] : profile[lx];
            const weight = blend > 0 ? Math.min(1, Math.max(0, 1 - edgeDistance / blend)) : edgeDistance === 0 ? 1 : 0;

            const voxels = noiseHeight * maxHeight;
            const blended = Math.round(voxels + (target - voxels) * weight);
            heights[x + z * width] = Math.min(CHUNK_Y, Math.max(0, blended));
        }
    }
    return heights;
}

/** One colour per (height, slope shade); palette index = height * slopeLevels + shade. */
function buildPalette(options: IProceduralStyleOptions, maxHeight: number, slopeLevels: number) {
    const { config } = options;
    const colors = new ColorPalette(config.colorBands, config.slopeColorShift);
    const palette: Array<{ r: number; g: number; b: number; a: number }> = [];
    for (let height = 0; height <= CHUNK_Y; height++) {
        for (let level = 0; level < slopeLevels; level++) {
            const slope = slopeLevels > 1 ? level / (slopeLevels - 1) : 0;
            const color = colors.getColor(Math.min(1, height / maxHeight), slope, config.enableSlopeVariation);
            palette.push({ ...color, a: 255 });
        }
    }
    return palette;
}

/** Palette index of every column: its height, shaded by how much it differs from its (wrapping) neighbours. */
function columnColors(
    heights: Uint8Array,
    width: number,
    depth: number,
    maxHeight: number,
    slopeLevels: number,
): Uint16Array {
    const colors = new Uint16Array(width * depth);
    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            const here = heights[x + z * width];
            const east = heights[((x + 1) % width) + z * width];
            const west = heights[((x + width - 1) % width) + z * width];
            const north = heights[x + ((z + 1) % depth) * width];
            const south = heights[x + ((z + depth - 1) % depth) * width];
            const steepness =
                (Math.abs(here - east) + Math.abs(here - west) + Math.abs(here - north) + Math.abs(here - south)) /
                4 /
                maxHeight;
            const level = Math.min(slopeLevels - 1, Math.round(Math.min(1, steepness * 2) * (slopeLevels - 1)));
            colors[x + z * width] = here * slopeLevels + level;
        }
    }
    return colors;
}

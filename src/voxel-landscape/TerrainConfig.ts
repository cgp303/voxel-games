import type {
    IHandAuthoredStyleSpec,
    IProceduralStyleOptions,
    ITerrainConfig,
    ITerrainStyleDef,
} from '../config/interfaces/interfaces';
import type { TerrainStyleId } from '../config/types/types';

/**
 * Default terrain configuration - balanced for a retro voxel landscape
 */
export const DEFAULT_TERRAIN_CONFIG: ITerrainConfig = {
    width: 256,
    depth: 512,
    maxHeight: 8,
    tileSize: 512, // same as the direction you want terrain to scroll in. here 'depth'.

    noiseScale: 2, // ~50 unit wavelength terrain features
    noiseOctaves: 1,
    noisePersistence: 0.5,
    noiseLacunarity: 0.5,
    noiseExponent: 0.1, // Slightly peaked for more variation at mid-heights

    colorBands: [
        { height: 0.00, color: { r: 2, g: 2, b: 4 } },       // Absolute void black-blue
        { height: 0.25, color: { r: 8, g: 10, b: 14 } },      // Subsurface black-grey
        { height: 0.60, color: { r: 20, g: 24, b: 24 } },      // Crushed midnight slate
        { height: 0.85, color: { r: 50, g: 55, b: 60 } },      // Faint abyssal steel-blue
        { height: 1.00, color: { r: 160, g: 170, b: 180 } },   // Dim ghost-grey crest
    ],


    seed: 11911,
    enableSlopeVariation: true,
    slopeColorShift: 0.1,
};

export const CRYSTAL_TERRAIN_CONFIG: ITerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 4.35,
    noiseOctaves: 4,
    noiseExponent: 0.3,
    noisePersistence: 0.15,
    noiseLacunarity: 0.1,
    colorBands: [
        { height: 0.25, color: { r: 3, g: 0, b: 40 } },     // Absolute void‑black with a blood tint
        { height: 0.25, color: { r: 12, g: 2, b: 2 } },     // Subsurface black‑crimson
        { height: 0.60, color: { r: 28, g: 6, b: 6 } },     // Crushed dark‑red slate
        { height: 0.85, color: { r: 70, g: 20, b: 20 } },    // Faint abyssal red‑steel
        { height: 1.00, color: { r: 160, g: 160, b: 160 } },    // Ghost‑red crest (dim, not bright)
    ],
    seed: 61232,
};

/**
 * The crystal terrain as a chunk style (see world/terrain/ProceduralStyleBuilder): 8 x 16 chunks, the same
 * 256 x 512 voxels the old single tile had. Rows [0, introRows) play once when the style starts; after the
 * last row the style wraps back to loopStartRow.
 */
export const CRYSTAL_STYLE: IProceduralStyleOptions = {
    name: 'crystal',
    config: CRYSTAL_TERRAIN_CONFIG,
    cols: 8,
    rows: 16,
    edgeBlend: 4,
    slopeLevels: 3,
    introRows: 0,
    loopStartRow: 0,
};


/**
 * The hand-authored "ataria-1" terrain: one MagicaVoxel tile (32 x 8 x 32, public/assets/vox/terrains/ataria-1) repeated
 * across the belt and along the direction of travel. `tiles` are ASSET_PATHS keys; `grid[row][col]` indexes them.
 */
export const ATARIA_1_STYLE: IHandAuthoredStyleSpec = {
    name: 'ataria-1',
    tiles: ['terrainAtaria1_0', 'terrainAtaria1_1', 'terrainAtaria1_2', 'terrainAtaria1_7'],
    grid: [[3, 1, 2, 0, 3, 2, 1, 0]],
};

/**
 * The hand-authored "ataria-1" terrain: one MagicaVoxel tile (32 x 8 x 32, public/assets/vox/terrains/ataria-1) repeated
 * across the belt and along the direction of travel. `tiles` are ASSET_PATHS keys; `grid[row][col]` indexes them.
 */
export const GREEN_WORLD_STYLE: IHandAuthoredStyleSpec = {
    name: 'greenworld',
    tiles: ['terrainGreenWorld_1', 'terrainGreenWorld_2', 'terrainGreenWorld_3', 'terrainGreenWorld_4', 'terrainGreenWorld_0a', 'terrainGreenWorld_0b', 'terrainGreenWorld_0c', 'terrainGreenWorld_7a', 'terrainGreenWorld_7b',
        'terrainGreenWorld_7c', 'terrainGreenWorld_1a'],
    grid: [[4, 3, 0, 2, 2, 0, 3, 7],
    [5, 1, 3, 2, 2, 3, 1, 8],
    [6, 3, 2, 10, 1, 2, 3, 9],
    [5, 3, 2, 1, 1, 0, 3, 8],
    [4, 10, 3, 2, 2, 3, 10, 7],],
};

export const GREY_WORLD_STYLE: IHandAuthoredStyleSpec = {
    name: 'greyworld',
    tiles: ['terrainGreyWorld_1', 'terrainGreyWorld_1a', 'terrainGreyWorld_2', 'terrainGreyWorld_2a', 'terrainGreyWorld_2b', 'terrainGreyWorld_2c'],
    grid: [[0, 4, 2, 2, 2, 2, 4, 0],
    [0, 4, 2, 5, 5, 2, 4, 0],
    [0, 4, 2, 4, 4, 2, 4, 0],
    [0, 4, 2, 3, 3, 2, 4, 0],
    [0, 4, 2, 2, 2, 2, 4, 0],
    ],
};

export const NEON_WORLD_STYLE: IHandAuthoredStyleSpec = {
    name: 'neonworld',
    tiles: ['terrainNeonWorld_1', 'terrainNeonWorld_2', 'terrainNeonWorld_3', 'terrainNeonWorld_4', 'terrainNeonWorld_5', 'terrainNeonWorld_7',
        'terrainNeonWorld_8', 'terrainNeonWorld_9', 'terrainNeonWorld_10', 'terrainNeonWorld_11', 'terrainNeonWorld_12'],
    grid: [[6, 1, 1, 1, 1, 1, 1, 5],
    [6, 1, 1, 0, 0, 1, 1, 5],
    [6, 3, 0, 1, 1, 0, 3, 5],
    [6, 1, 1, 0, 0, 1, 1, 5],
    [6, 7, 10, 9, 9, 8, 7, 5],
    [6, 1, 1, 2, 2, 1, 1, 5],
    [6, 1, 4, 1, 1, 4, 1, 5],
    [6, 1, 1, 1, 1, 1, 1, 5],
    [6, 1, 1, 4, 4, 1, 1, 5],
    [6, 3, 0, 1, 1, 0, 3, 5],
    [6, 1, 1, 4, 4, 1, 1, 5],
    [6, 1, 1, 1, 1, 1, 1, 5],
    [6, 1, 1, 2, 2, 1, 1, 5],
    [6, 1, 4, 1, 1, 4, 1, 5]
    ],
};


export const STEEL_BLOCK_TERRAIN_CONFIG: ITerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 2.4,
    noiseOctaves: 1.5,
    noiseExponent: 5.6,
    noisePersistence: 3.5,
    noiseLacunarity: 4.5,
    colorBands: [
        { height: 0.1, color: { r: 52, g: 52, b: 52 } },     // Absolute void‑black with a blood tint
        { height: 0.5, color: { r: 94, g: 94, b: 94 } },     // Subsurface black‑crimson
        { height: 0.60, color: { r: 12, g: 12, b: 25 } },     // Crushed dark‑red slate
        { height: 0.85, color: { r: 94, g: 94, b: 94 } },    // Faint abyssal red‑steel
        { height: 0.90, color: { r: 52, g: 52, b: 52 } },    // Ghost‑red crest (dim, not bright)
    ],
    seed: 61232,
};

/**
 * The crystal terrain as a chunk style (see world/terrain/ProceduralStyleBuilder): 8 x 16 chunks, the same
 * 256 x 512 voxels the old single tile had. Rows [0, introRows) play once when the style starts; after the
 * last row the style wraps back to loopStartRow.
 */
export const STEEL_BLOCK_STYLE: IProceduralStyleOptions = {
    name: 'steel_block',
    config: STEEL_BLOCK_TERRAIN_CONFIG,
    cols: 8,
    rows: 16,
    edgeBlend: 4,
    slopeLevels: 3,
    introRows: 0,
    loopStartRow: 0,
};


export const ATARI_TERRAIN_CONFIG: ITerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 1.4,
    noiseOctaves: 1.5,
    noiseExponent: 2.6,
    noisePersistence: 3.5,
    noiseLacunarity: 4.5,
    colorBands: [
        { height: 0.4, color: { r: 51, g: 22, b: 19 } },     // Absolute void‑black with a blood tint
        { height: 0.5, color: { r: 56, g: 33, b: 14 } },     // Subsurface black‑crimson
        { height: 0.60, color: { r: 60, g: 42, b: 8 } },     // Crushed dark‑red slate
        // { height: 0.75, color: { r: 248, g: 215, b: 159 } },    // Faint abyssal red‑steel
        { height: 0.90, color: { r: 56, g: 33, b: 14 } },    // Ghost‑red crest (dim, not bright)
        { height: 1.00, color: { r: 51, g: 100, b: 19 } },
    ],
    seed: 61232,
};

/**
 * The crystal terrain as a chunk style (see world/terrain/ProceduralStyleBuilder): 8 x 16 chunks, the same
 * 256 x 512 voxels the old single tile had. Rows [0, introRows) play once when the style starts; after the
 * last row the style wraps back to loopStartRow.
 */
export const ATARI_STYLE: IProceduralStyleOptions = {
    name: 'atari',
    config: ATARI_TERRAIN_CONFIG,
    cols: 8,
    rows: 16,
    edgeBlend: 4,
    slopeLevels: 3,
    introRows: 0,
    loopStartRow: 0,
};

/** Every terrain style a wave can ask for (WAVE configs name one by id). Built once at startup by TerrainStyleRegistry. */
export const TERRAIN_STYLES: Record<TerrainStyleId, ITerrainStyleDef> = {
    crystal: { kind: 'procedural', options: CRYSTAL_STYLE },
    steelBlock: { kind: 'procedural', options: STEEL_BLOCK_STYLE },
    atari: { kind: 'procedural', options: ATARI_STYLE },
    ataria1: { kind: 'handAuthored', spec: ATARIA_1_STYLE },
    greenWorld: { kind: 'handAuthored', spec: GREEN_WORLD_STYLE },
    greyWorld: { kind: 'handAuthored', spec: GREY_WORLD_STYLE },
    neonWorld: { kind: 'handAuthored', spec: NEON_WORLD_STYLE },
};


/**
 * Flatten terrain config - minimal height variation for testing
 */
export const FLAT_TERRAIN_CONFIG: ITerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 50, // Very zoomed out
    noiseOctaves: 4,
    noiseExponent: 0.5, // Very flat curve
};

/**
 * Mountainous terrain config - dramatic height variation
 */
export const MOUNTAINOUS_TERRAIN_CONFIG: ITerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 20, // Zoomed in, more peaks
    noiseOctaves: 6,
    noisePersistence: 0.6,
    noiseExponent: 1.5,
    maxHeight: 32,
};

/**
 * Island terrain config - peaked mountains surrounded by water
 */
export const ISLAND_TERRAIN_CONFIG: ITerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 50,
    noiseOctaves: 4,
    noiseExponent: 1.8, // Very peaked
    colorBands: [
        { height: 0.0, color: { r: 30, g: 60, b: 100 } }, // Deep water
        { height: 0.3, color: { r: 50, g: 80, b: 120 } }, // Shallow water
        { height: 0.4, color: { r: 220, g: 200, b: 100 } }, // Sand beach
        { height: 0.5, color: { r: 60, g: 100, b: 40 } }, // Grass
        { height: 0.75, color: { r: 100, g: 100, b: 100 } }, // Rock
        { height: 1.0, color: { r: 255, g: 255, b: 255 } }, // Snow peak
    ],
    seed: 54321,
};

import type { IHandAuthoredStyleSpec, IProceduralStyleOptions, ITerrainConfig } from '../config/interfaces/interfaces';

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

    // colorBands: [
    //     { height: 0.00, color: { r: 20, g: 25, b: 35 } },    // Abyssal blue-black
    //     { height: 0.25, color: { r: 40, g: 45, b: 55 } },    // Charcoal navy
    //     { height: 0.40, color: { r: 35, g: 35, b: 40 } },    // Iron grey
    //     { height: 0.65, color: { r: 150, g: 80, b: 40 } },    // Ember orange-brown
    //     { height: 0.70, color: { r: 200, g: 40, b: 10 } },    // Brooding volcanic red
    // ],

    // colorBands: [
    //     { height: 0.00, color: { r: 50, g: 50, b: 60 } },    // Deep slate
    //     { height: 0.30, color: { r: 80, g: 80, b: 100 } },   // Slate grey-blue
    //     { height: 0.60, color: { r: 110, g: 130, b: 160 } },   // Mid ocean blue
    //     { height: 0.85, color: { r: 150, g: 170, b: 200 } },   // Light ocean blue
    //     { height: 1.00, color: { r: 255, g: 255, b: 255 } },   // White crest
    // ],

    // colorBands: [
    //     { height: 0.00, color: { r: 10, g: 12, b: 18 } },    // Deep abyss blue-black
    //     { height: 0.25, color: { r: 30, g: 35, b: 45 } },    // Dark slate navy
    //     { height: 0.60, color: { r: 70, g: 85, b: 110 } },   // Muted ocean steel-blue
    //     { height: 0.85, color: { r: 110, g: 130, b: 160 } },   // Cold storm blue
    //     { height: 1.00, color: { r: 220, g: 230, b: 240 } },   // Pale white crest (less bright)
    // ],

    // colorBands: [
    //     { height: 0.00, color: { r: 4, g: 6, b: 10 } },      // Near‑black abyss blue
    //     { height: 0.25, color: { r: 18, g: 22, b: 30 } },      // Crushed midnight navy
    //     { height: 0.60, color: { r: 40, g: 48, b: 60 } },      // Heavy slate blue-grey
    //     { height: 0.85, color: { r: 80, g: 95, b: 120 } },     // Cold storm steel-blue
    //     { height: 1.00, color: { r: 200, g: 210, b: 220 } },   // Dimmed pale crest (not pure white)
    // ],

    colorBands: [
        { height: 0.00, color: { r: 2, g: 2, b: 4 } },       // Absolute void black-blue
        { height: 0.25, color: { r: 8, g: 10, b: 14 } },      // Subsurface black-grey
        { height: 0.60, color: { r: 20, g: 24, b: 24 } },      // Crushed midnight slate
        { height: 0.85, color: { r: 50, g: 55, b: 60 } },      // Faint abyssal steel-blue
        { height: 1.00, color: { r: 160, g: 170, b: 180 } },   // Dim ghost-grey crest
    ],

    // colorBands: [
    //     { height: 0.00, color: { r: 3, g: 0, b: 0 } },     // Absolute void‑black with a blood tint
    //     { height: 0.25, color: { r: 12, g: 2, b: 2 } },     // Subsurface black‑crimson
    //     { height: 0.60, color: { r: 28, g: 6, b: 6 } },     // Crushed dark‑red slate
    //     { height: 0.85, color: { r: 70, g: 20, b: 20 } },    // Faint abyssal red‑steel
    //     { height: 1.00, color: { r: 160, g: 40, b: 40 } },    // Ghost‑red crest (dim, not bright)
    // ],


    // colorBands: [
    //     { height: 0.00, color: { r: 20, g: 40, b: 80 } },   // Deep navy
    //     { height: 0.30, color: { r: 40, g: 70, b: 120 } },  // Dark ocean blue
    //     { height: 0.60, color: { r: 70, g: 110, b: 160 } },  // Mid ocean blue
    //     { height: 0.85, color: { r: 120, g: 160, b: 200 } },  // Light blue
    //     { height: 1.00, color: { r: 255, g: 255, b: 255 } },  // Pure white crest
    // ],

    // colorBands: [
    //     { height: 0.00, color: { r: 40, g: 40, b: 40 } },    // Charcoal base
    //     { height: 0.30, color: { r: 70, g: 70, b: 70 } },    // Dark grey
    //     { height: 0.60, color: { r: 110, g: 110, b: 110 } },   // Mid grey
    //     { height: 0.85, color: { r: 160, g: 160, b: 160 } },   // Light grey
    //     { height: 1.00, color: { r: 240, g: 240, b: 240 } },   // White peak
    // ],

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

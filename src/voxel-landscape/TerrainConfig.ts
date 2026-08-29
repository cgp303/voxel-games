/**
 * Configuration for procedurally generated terrain
 * Can be serialized/stored and reused to generate consistent landscapes
 */
export interface HeightColorBand {
    height: number; // 0-1, normalized height threshold
    color: { r: number; g: number; b: number };
}

export interface TerrainConfig {
    // Dimensions
    width: number; // X dimension (columns)
    depth: number; // Z dimension (rows)
    maxHeight: number; // Y dimension (max voxel height, e.g., 32)

    // Noise parameters
    noiseScale: number; // Frequency/zoom of noise (lower = more zoomed in, more variation)
    noiseOctaves: number; // Complexity layers (1-8 recommended)
    noisePersistence: number; // Amplitude falloff per octave (0.5 = half amplitude each time)
    noiseLacunarity: number; // Frequency multiplier per octave (2.0 = double frequency)
    noiseExponent: number; // Height curve (1.0 = linear, < 1.0 = flatter, > 1.0 = peaked)

    // Color mapping
    colorBands: HeightColorBand[];

    // Seed for reproducibility
    seed: number;

    // Slope variation (adds color variation based on local slope)
    enableSlopeVariation: boolean;
    slopeColorShift: number; // How much slope affects color (0-0.3 recommended)
}

/**
 * Default terrain configuration - balanced for a retro voxel landscape
 */
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
    width: 512,
    depth: 512,
    maxHeight: 6,

    noiseScale: 25, // ~50 unit wavelength terrain features
    noiseOctaves: 4,
    noisePersistence: 0.5,
    noiseLacunarity: 1.5,
    noiseExponent: 1.2, // Slightly peaked for more variation at mid-heights

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

    // colorBands: [
    //     { height: 0.00, color: { r: 2, g: 2, b: 4 } },       // Absolute void black-blue
    //     { height: 0.25, color: { r: 8, g: 10, b: 14 } },      // Subsurface black-grey
    //     { height: 0.60, color: { r: 20, g: 24, b: 24 } },      // Crushed midnight slate
    //     { height: 0.85, color: { r: 50, g: 55, b: 60 } },      // Faint abyssal steel-blue
    //     { height: 1.00, color: { r: 160, g: 170, b: 180 } },   // Dim ghost-grey crest
    // ],

    colorBands: [
        { height: 0.00, color: { r: 3, g: 0, b: 0 } },     // Absolute void‑black with a blood tint
        { height: 0.25, color: { r: 12, g: 2, b: 2 } },     // Subsurface black‑crimson
        { height: 0.60, color: { r: 28, g: 6, b: 6 } },     // Crushed dark‑red slate
        { height: 0.85, color: { r: 70, g: 20, b: 20 } },    // Faint abyssal red‑steel
        { height: 1.00, color: { r: 160, g: 40, b: 40 } },    // Ghost‑red crest (dim, not bright)
    ],


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

    seed: 12345,
    enableSlopeVariation: true,
    slopeColorShift: 0.1,
};

/**
 * Flatten terrain config - minimal height variation for testing
 */
export const FLAT_TERRAIN_CONFIG: TerrainConfig = {
    ...DEFAULT_TERRAIN_CONFIG,
    noiseScale: 50, // Very zoomed out
    noiseOctaves: 4,
    noiseExponent: 0.5, // Very flat curve
};

/**
 * Mountainous terrain config - dramatic height variation
 */
export const MOUNTAINOUS_TERRAIN_CONFIG: TerrainConfig = {
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
export const ISLAND_TERRAIN_CONFIG: TerrainConfig = {
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

/**
 * Voxel Landscape Generator
 * Procedural terrain generation with height-based coloring and slope variation
 */

export { DEFAULT_TERRAIN_CONFIG, FLAT_TERRAIN_CONFIG, MOUNTAINOUS_TERRAIN_CONFIG, ISLAND_TERRAIN_CONFIG } from './TerrainConfig';
export type { IHeightColorBand, ITerrainConfig } from '../config/interfaces/interfaces';
export { NoiseGenerator } from './NoiseGenerator';
export { ColorPalette } from './ColorPalette';
export { TerrainGenerator } from './TerrainGenerator';

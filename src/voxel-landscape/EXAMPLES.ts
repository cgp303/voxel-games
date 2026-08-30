/**
 * Example: How to use the Terrain Generator
 * 
 * This shows integration with the existing VoxelWorld, VoxParser, and VoxelGeometry
 */

import { TerrainGenerator, DEFAULT_TERRAIN_CONFIG, MOUNTAINOUS_TERRAIN_CONFIG, ISLAND_TERRAIN_CONFIG } from './index';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { VoxParser } from '../voxel/VoxParser';
import { VoxelGeometry } from '../voxel/VoxelGeometry';
import * as THREE from 'three';

/**
 * Example 1: Generate default terrain and add to scene
 */
export function example1_DefaultTerrain(scene: THREE.Scene) {
    // Create generator with default config
    const generator = new TerrainGenerator(DEFAULT_TERRAIN_CONFIG);

    // Generate the ParsedVoxModel
    const terrain = generator.generate();
    console.log(`Generated terrain: ${terrain.voxels.length} voxels`);

    // Use existing VoxelWorld pipeline
    const world = new VoxelWorld();
    VoxParser.populateWorld(world, terrain);

    // Convert to Three.js mesh with our optimized geometry
    const mesh = VoxelGeometry.createMesh(world, terrain.colors);
    mesh.position.y = 0;
    scene.add(mesh);

    return { terrain, world, mesh };
}

/**
 * Example 2: Generate different preset terrains and compare
 */
export function example2_CompareTerrains(scene: THREE.Scene) {
    const configs = [
        { name: 'Default', config: DEFAULT_TERRAIN_CONFIG, x: -80 },
        { name: 'Mountainous', config: MOUNTAINOUS_TERRAIN_CONFIG, x: 0 },
        { name: 'Island', config: ISLAND_TERRAIN_CONFIG, x: 80 },
    ];

    configs.forEach(({ name, config, x }) => {
        const generator = new TerrainGenerator(config);
        const terrain = generator.generate();

        const world = new VoxelWorld();
        VoxParser.populateWorld(world, terrain);

        const mesh = VoxelGeometry.createMesh(world, terrain.colors);
        mesh.position.set(x, 0, 0);
        scene.add(mesh);

        console.log(`Created ${name} terrain at x=${x}`);
    });
}

/**
 * Example 3: Custom terrain config
 */
export function example3_CustomTerrain(scene: THREE.Scene) {
    const customConfig = {
        width: 64,
        depth: 64,
        maxHeight: 24,

        noiseScale: 30,
        noiseOctaves: 5,
        noisePersistence: 0.55,
        noiseLacunarity: 2.1,
        noiseExponent: 1.3,

        // // Custom color bands (e.g., desert theme)
        // colorBands: [
        //     { height: 0.0, color: { r: 80, g: 60, b: 40 } },      // Dark sand
        //     { height: 0.3, color: { r: 200, g: 170, b: 100 } },   // Sand
        //     { height: 0.6, color: { r: 180, g: 140, b: 80 } },    // Lighter sand
        //     { height: 0.85, color: { r: 150, g: 100, b: 60 } },   // Rock
        //     { height: 1.0, color: { r: 200, g: 200, b: 150 } },   // Peak
        // ],

        colorBands: [
            { height: 0.00, color: { r: 180, g: 200, b: 220 } },  // Pale grey-blue base
            { height: 0.25, color: { r: 150, g: 180, b: 210 } },  // Cool blue
            { height: 0.50, color: { r: 120, g: 160, b: 200 } },  // Mid blue
            { height: 0.75, color: { r: 100, g: 130, b: 160 } },  // Slate grey-blue
            { height: 1.00, color: { r: 240, g: 240, b: 255 } },  // Bright white peak
        ],


        seed: 99999,
        enableSlopeVariation: true,
        slopeColorShift: 0.25,
    };

    const generator = new TerrainGenerator(customConfig);
    const terrain = generator.generate();

    const world = new VoxelWorld();
    VoxParser.populateWorld(world, terrain);

    const mesh = VoxelGeometry.createMesh(world, terrain.colors);
    scene.add(mesh);

    return { terrain, config: customConfig };
}

/**
 * Example 4: Save and restore terrain config
 */
export function example4_SaveLoadTerrain() {
    const generator = new TerrainGenerator(DEFAULT_TERRAIN_CONFIG);

    // Serialize config to JSON
    const configJson = JSON.stringify(generator.getConfig());
    console.log('Saved config:', configJson);

    // Later: restore from JSON
    const restoredConfig = JSON.parse(configJson);
    const restoredGenerator = new TerrainGenerator(restoredConfig);
    const terrain = restoredGenerator.generate();

    console.log(`Restored terrain with seed ${terrain.size.x}×${terrain.size.z}`);
    return terrain;
}

/**
 * Example 5: Debug heightmap visualization
 */
export function example5_DebugHeightmap() {
    const generator = new TerrainGenerator(DEFAULT_TERRAIN_CONFIG);
    generator.generate();

    const heightmap = generator.getHeightmap();

    // Print some heightmap statistics
    let minHeight = 1, maxHeight = 0;
    let sum = 0;
    for (let z = 0; z < heightmap.length; z++) {
        for (let x = 0; x < heightmap[z].length; x++) {
            const h = heightmap[z][x];
            minHeight = Math.min(minHeight, h);
            maxHeight = Math.max(maxHeight, h);
            sum += h;
        }
    }

    const avgHeight = sum / (heightmap.length * heightmap[0].length);
    console.log(`Heightmap stats: min=${minHeight.toFixed(3)}, max=${maxHeight.toFixed(3)}, avg=${avgHeight.toFixed(3)}`);

    return heightmap;
}

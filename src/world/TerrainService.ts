import * as THREE from 'three';
import { TerrainGenerator } from '../voxel-landscape/TerrainGenerator';
import type { TerrainConfig } from '../voxel-landscape/TerrainConfig';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { VoxParser } from '../voxel/VoxParser';
import { VoxelGeometry } from '../voxel/VoxelGeometry';

export interface TerrainBuildResult {
  mesh: THREE.Mesh;
  width: number;
  height: number;
  depth: number;
}

/**
 * Builds static terrain meshes from config via the voxel pipeline.
 */
export class TerrainService {
  public buildStatic(config: TerrainConfig): TerrainBuildResult {
    const generator = new TerrainGenerator(config);
    const terrain = generator.generate();

    const world = new VoxelWorld();
    VoxParser.populateWorld(world, terrain);

    const mesh = VoxelGeometry.createMesh(world, terrain.colors);
    mesh.name = 'Terrain';
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // Center terrain on origin (XZ)
    const width = terrain.size.x;
    const height = terrain.size.y;
    const depth = terrain.size.z;
    mesh.position.set(-width * 0.5, 0, -depth * 0.5);

    return { mesh, width, height, depth };
  }
}

import * as THREE from 'three';
import { TerrainGenerator } from '../voxel-landscape/TerrainGenerator';
import type { ITerrainConfig } from '../config/interfaces/interfaces';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { VoxParser } from '../voxel/VoxParser';
import { VoxelGeometry } from '../voxel/VoxelGeometry';
import { HeightField } from './HeightField';
import type { ITerrainBuildResult, IScrollingTerrainBuildResult } from '../config/interfaces/interfaces';

/**
 * Builds terrain meshes from config via the voxel pipeline.
 */
export class TerrainService {
  /**
   * Single static tile, centered on XZ origin (legacy / non-scrolling).
   */
  public buildStatic(config: ITerrainConfig): ITerrainBuildResult {
    const { mesh, width, height, depth, heightField } = this.buildTileMesh(config, 'Terrain', false);
    // Center terrain on origin (XZ)
    mesh.position.set(-width * 0.5, 0, -depth * 0.5);
    return { mesh, width, height, depth, heightField };
  }

  /**
   * Two tiles for Z scrolling.
   * - meshA occupies local Z [0, tileDepth)
   * - meshB occupies local Z [tileDepth, 2*tileDepth)
   * Both are X-centered (x = -width/2).
   * meshB is a clone of meshA (same pattern); later you can generate a second noise offset.
   */
  public buildScrollingPair(config: ITerrainConfig): IScrollingTerrainBuildResult {
    const { mesh: meshA, width, height, depth: tileDepth, heightField } = this.buildTileMesh(
      config,
      'TerrainA',
      true,
    );

    // Geometry is built with voxel origin at corner; place A at z=0..tileDepth
    meshA.position.set(-width * 0.5, 0, 0);

    const meshB = meshA.clone(true);
    meshB.name = 'TerrainB';
    meshB.position.set(-width * 0.5, 0, tileDepth);

    return { meshA, meshB, width, height, tileDepth, heightField };
  }

  private buildTileMesh(
    config: ITerrainConfig,
    name: string,
    wrapZ: boolean,
  ): ITerrainBuildResult {
    const generator = new TerrainGenerator(config);
    const terrain = generator.generate();

    const world = new VoxelWorld(terrain.size);
    VoxParser.populateWorld(world, terrain);

    const mesh = VoxelGeometry.createMesh(world, terrain.colors);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    const width = terrain.size.x;
    const height = terrain.size.y;
    const depth = terrain.size.z;

    // Same rounding the generator uses to stack each voxel column.
    const heightmap = generator.getHeightmap();
    const columnHeights = new Uint16Array(width * depth);
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        columnHeights[z * width + x] = Math.round(heightmap[z][x] * config.maxHeight);
      }
    }

    return { mesh, width, height, depth, heightField: new HeightField(columnHeights, width, depth, wrapZ) };
  }
}
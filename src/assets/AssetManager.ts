import * as THREE from 'three';
import { VoxParser, type ParsedVoxModel } from '../voxel/VoxParser';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { VoxelGeometry } from '../voxel/VoxelGeometry';
import { ASSET_PATHS, type AssetKey } from './manifests';

/**
 * Load and cache .vox models / mesh templates.
 */
export class AssetManager {
  private models = new Map<string, ParsedVoxModel>();
  private meshTemplates = new Map<string, THREE.Object3D>();

  public async loadVox(path: string, key?: string): Promise<ParsedVoxModel> {
    const cacheKey = key ?? path;
    const cached = this.models.get(cacheKey);
    if (cached) return cached;

    const model = await VoxParser.loadVoxFile(path);
    this.models.set(cacheKey, model);
    return model;
  }

  public async loadManifestAsset(key: AssetKey): Promise<ParsedVoxModel> {
    return this.loadVox(ASSET_PATHS[key], key);
  }

  /**
   * Build a centered, shadow-ready mesh template from a cached model.
   * Clones of this mesh are cheap; geometry is shared until deep-cloned.
   */
  public getOrCreateMeshTemplate(key: string): THREE.Object3D {
    const existing = this.meshTemplates.get(key);
    if (existing) return existing;

    const model = this.models.get(key);
    if (!model) {
      throw new Error(`AssetManager: no model loaded for key "${key}"`);
    }

    const world = new VoxelWorld();
    VoxParser.populateWorld(world, model);
    const mesh = VoxelGeometry.createMesh(world, model.colors);

    const bounds = world.getBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;

    // Pivot at model center so clones position cleanly
    const pivot = new THREE.Group();
    pivot.name = `template:${key}`;
    mesh.position.set(-centerX, -centerY, -centerZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);

    this.meshTemplates.set(key, pivot);
    return pivot;
  }

  public getModel(key: string): ParsedVoxModel | undefined {
    return this.models.get(key);
  }

  public getMeshTemplate(key: string): THREE.Object3D | undefined {
    return this.meshTemplates.get(key);
  }

  public setMeshTemplate(key: string, template: THREE.Object3D): void {
    this.meshTemplates.set(key, template);
  }

  public clear(): void {
    this.models.clear();
    this.meshTemplates.clear();
  }
}

import * as THREE from 'three';
import type { IParsedVoxModel, IVoxelCloud } from '../config/interfaces/interfaces';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { VoxelGeometry } from '../voxel/VoxelGeometry';
import { buildVoxelCloud } from '../voxel/VoxelCloud';
import { ASSET_PATHS, type AssetKey } from './manifests';
import { VoxParser } from '../voxel/VoxParser';
import { disposeObject3D } from '../world/PlayField';
import { CollisionModelSet } from '../systems/collision/CollisionModel';
import { COLLISION } from '../config/data/constants';


/**
 * Load and cache .vox models / mesh templates.
 */
export class AssetManager {
  private models = new Map<string, IParsedVoxModel>();
  private meshTemplates = new Map<string, THREE.Object3D>();
  private instancedMeshes = new Map<string, THREE.InstancedMesh>();
  private collisionModels = new Map<string, CollisionModelSet>();
  private voxelClouds = new Map<string, IVoxelCloud>();
  // Track available instanceIds for recycling (application-scoped); maps assetKey → free slot indices
  private freeSlots: Map<string, number[]> = new Map();

  public async loadVox(path: string, key?: string): Promise<IParsedVoxModel> {
    const cacheKey = key ?? path;
    const cached = this.models.get(cacheKey);
    if (cached) return cached;

    const model = await VoxParser.loadVoxFile(path);
    this.models.set(cacheKey, model);
    return model;
  }

  public async loadManifestAsset(key: AssetKey): Promise<IParsedVoxModel> {
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

    const world = new VoxelWorld(model.size);
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


  /**
   * creates instanced mesh templates from cached models.
   * Returns a shared InstancedMesh for the given asset key.
   * Creates it on first request.
   */
  public getOrCreateInstancedMesh(assetKey: string, maxCount = 80): THREE.InstancedMesh {
    let mesh = this.instancedMeshes.get(assetKey);
    if (mesh) return mesh;

    // Ensure the model is loaded before creating the instanced mesh
    const model = this.models.get(assetKey);
    if (!model) {
      throw new Error(`AssetManager: no model loaded for key "${assetKey}"`);
    }
    const world = new VoxelWorld(model.size);
    VoxParser.populateWorld(world, model);

    // Reuse the same geometry + material that the old template used
    // const template = this.getOrCreateMeshTemplate(assetKey);
    const geometry = VoxelGeometry.createGeometry(world, model.colors, true);
    const material = VoxelGeometry.createMaterial(model.colors);

    mesh = new THREE.InstancedMesh(geometry, material, maxCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = `Instanced_${assetKey}`;

    this.instancedMeshes.set(assetKey, mesh);
    return mesh;
  }

  /**
   * Baked collision footprints for a loaded model (built on first request, then cached).
   * Cleared together with the models in clear().
   */
  public getCollisionModels(assetKey: string): CollisionModelSet {
    const cached = this.collisionModels.get(assetKey);
    if (cached) return cached;

    const model = this.models.get(assetKey);
    if (!model) {
      throw new Error(`AssetManager: no model loaded for key "${assetKey}"`);
    }
    const set = new CollisionModelSet(model.voxels, {
      rollBuckets: COLLISION.rollBuckets,
      maskResolution: COLLISION.maskResolution,
    });
    this.collisionModels.set(assetKey, set);
    return set;
  }

  /**
   * Per-voxel positions and true colours of a loaded model, for effects such as debris.
   * Built on first request, then cached; cleared together with the models in clear().
   */
  public getVoxelCloud(assetKey: string): IVoxelCloud {
    const cached = this.voxelClouds.get(assetKey);
    if (cached) return cached;

    const model = this.models.get(assetKey);
    if (!model) {
      throw new Error(`AssetManager: no model loaded for key "${assetKey}"`);
    }
    const cloud = buildVoxelCloud(model);
    this.voxelClouds.set(assetKey, cloud);
    return cloud;
  }

  public markInstancedMeshesDirty(): void {
    for (const mesh of this.instancedMeshes.values()) {
      if (mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Get the free-slot list for an asset key (for recycling disposed instances).
   * Returns the array reference, so callers can pop/push to it.
   */
  public getFreeSlots(assetKey: string): number[] {
    const slots = this.freeSlots.get(assetKey);
    if (slots) return slots;

    const newSlots: number[] = [];
    this.freeSlots.set(assetKey, newSlots);
    return newSlots;
  }

  /**
   * Reset the InstancedMesh count and free-slot list for a given asset.
   * Call this when starting a new session to ensure all slots are available.
   */
  public resetInstancedMeshCount(assetKey: string): void {
    const mesh = this.instancedMeshes.get(assetKey);
    if (mesh) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;

    }

    // Clear the free-slot list for this asset
    this.freeSlots.delete(assetKey);

  }

  public getModel(key: string): IParsedVoxModel | undefined {
    return this.models.get(key);
  }

  public getMeshTemplate(key: string): THREE.Object3D | undefined {
    return this.meshTemplates.get(key);
  }

  public setMeshTemplate(key: string, template: THREE.Object3D): void {
    this.meshTemplates.set(key, template);
  }

  /** Dispose every cached GPU resource (instanced meshes, templates) and forget all models. */
  public clear(): void {
    for (const mesh of this.instancedMeshes.values()) {
      mesh.removeFromParent();
      disposeObject3D(mesh);
    }
    for (const template of this.meshTemplates.values()) {
      template.removeFromParent();
      disposeObject3D(template);
    }
    this.instancedMeshes.clear();
    this.freeSlots.clear();
    this.models.clear();
    this.collisionModels.clear();
    this.voxelClouds.clear();
    this.meshTemplates.clear();
  }
}

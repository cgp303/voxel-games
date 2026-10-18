import * as THREE from 'three';
import { SHADOW } from '../config/data/constants';

export class GameScene {
  public scene: THREE.Scene;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight | null = null;
  public terrainDimensions: { w: number; h: number; d: number } | null = null;
  private lightsCreated = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
    this.scene.fog = new THREE.Fog(0x0a0a0a, 200, 750);

    // Hemisphere light for natural ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2.5);
    this.scene.add(hemiLight);
  }

  public addTerrainMesh(mesh: THREE.Mesh, dims: { w: number; h: number; d: number }) {
    this.scene.add(mesh);
    this.terrainDimensions = dims;
  }

  public setTerrainDimensions(dims: { w: number; h: number; d: number }) {
    this.terrainDimensions = dims;
  }

  public createLights() {
    if (this.lightsCreated) return;
    if (!this.terrainDimensions) {
      console.warn('GameScene.createLights: terrainDimensions not set');
      return;
    }

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.directionalLight.position.set(0, 800, 400 + SHADOW.centerZ);
    this.directionalLight.target.position.set(0, 0, SHADOW.centerZ);
    this.directionalLight.castShadow = true;

    const shadow = this.directionalLight.shadow;
    shadow.mapSize.width = SHADOW.mapWidth;
    shadow.mapSize.height = SHADOW.mapHeight;
    shadow.camera.left = -this.terrainDimensions.w / 1.5;
    shadow.camera.right = this.terrainDimensions.w / 1.5;
    shadow.camera.top = SHADOW.halfExtentZ;
    shadow.camera.bottom = -SHADOW.halfExtentZ;
    shadow.camera.near = SHADOW.near;
    shadow.camera.far = SHADOW.far;
    shadow.bias = SHADOW.bias;

    // const shadowHelper = new THREE.CameraHelper(this.directionalLight.shadow.camera);
    // this.scene.add(shadowHelper);

    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);
    this.lightsCreated = true;
  }

  /**
   * Remove disposable meshes/groups while keeping lights and camera helpers.
   * Prefer removing screen-owned roots (e.g. PlayField) instead of full clear.
   */
  public clear() {
    const keep = new Set<THREE.Object3D>();
    this.scene.children.forEach((child) => {
      if (
        child instanceof THREE.Light ||
        child instanceof THREE.HemisphereLight ||
        (this.directionalLight && child === this.directionalLight.target)
      ) {
        keep.add(child);
      }
    });

    const toRemove: THREE.Object3D[] = [];
    this.scene.children.forEach((child) => {
      if (!keep.has(child)) toRemove.push(child);
    });
    toRemove.forEach((obj) => this.scene.remove(obj));
  }
}

import * as THREE from 'three';

export class GameScene {
  public scene: THREE.Scene;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight | null = null;
  public terrainDimensions: { w: number; h: number; d: number } | null = null;
  private lightsCreated = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
    this.scene.fog = new THREE.Fog(0x0a0a0a, 200, 1000);

    // Hemisphere light for natural ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
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

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(0, 100, 200);
    this.directionalLight.target.position.set(0, 0, 0);
    this.directionalLight.castShadow = true;

    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.left = -this.terrainDimensions.w / 1.5;
    this.directionalLight.shadow.camera.right = this.terrainDimensions.w / 1.5;
    this.directionalLight.shadow.camera.top = this.terrainDimensions.h * 4;
    this.directionalLight.shadow.camera.bottom = -this.terrainDimensions.h * 3;
    this.directionalLight.shadow.camera.far = 350;
    this.directionalLight.shadow.bias = -0.001;

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

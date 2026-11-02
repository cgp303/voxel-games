import * as THREE from 'three';
import type { GameCamera } from '../scene/Camera';
import { CAMERA, DEBUG, GAME, TERRAIN } from '../config/data/constants';
import type {
    IGradient2,
    IGroundSampler,
    IInvaderGridOptions,
} from '../config/interfaces/interfaces';
import type { ScrollingTerrain } from './terrain/ScrollingTerrain';

/**
 * Play area: terrain + formation under one root group.
 * Built once by App and shared across Demo/Play/GameOver.
 *
 * Terrain lives under terrainRoot (it scrolls toward the camera, see ScrollingTerrain).
 * Invaders live under invaderRoot (do NOT parent under terrain).
 */
export class PlayField implements IGroundSampler {
    public readonly root: THREE.Group;
    public bounds = { width: 0, height: 0, depth: 0 };

    private readonly terrainRoot: THREE.Group;
    private readonly invaderRoot: THREE.Group;

    private terrain: ScrollingTerrain | null = null;
    private scrollSpeedZ: number = TERRAIN.scrollSpeedZ;
    private scrollEnabled: boolean = TERRAIN.scrollEnabledDefault;


    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'PlayField';

        this.terrainRoot = new THREE.Group();
        this.terrainRoot.name = 'TerrainRoot';

        this.terrainRoot.visible = !DEBUG.disableTerrain;
        this.root.add(this.terrainRoot);

        this.invaderRoot = new THREE.Group();
        this.invaderRoot.name = 'Invaders';
        this.root.add(this.invaderRoot);
    }

    /**
     * Scene parent for invader meshes (static group — do not parent under a moving
     * formation transform; write world positions from entities instead).
     */
    public getInvaderRoot(): THREE.Group {
        return this.invaderRoot;
    }

    /** Parent an invader (or other combat mesh) under the shared invader root. */
    public attachInvader(object: THREE.Object3D): void {
        this.invaderRoot.add(object);
    }

    /** Replaces the terrain. Call updateTerrain(dt, camera, fogDepth) each frame to scroll it and keep its visible rows built. */
    public setTerrain(terrain: ScrollingTerrain): void {
        this.clearTerrainOnly();

        this.terrain = terrain;
        this.terrainRoot.add(terrain.field.mesh);
        this.setBounds(terrain.bounds.width, terrain.bounds.height, terrain.bounds.depth);
    }

    /** The current terrain, e.g. to queue a style transition. */
    public getTerrain(): ScrollingTerrain | null {
        return this.terrain;
    }

    public setBounds(width: number, height: number, depth: number): void {
        this.bounds = { width, height, depth };
    }

    public setScrollSpeed(speedZ: number): void {
        this.scrollSpeedZ = speedZ;
    }

    public setScrollEnabled(enabled: boolean): void {
        this.scrollEnabled = enabled;
    }

    public getScrollEnabled(): boolean {
        return this.scrollEnabled;
    }

    public getGroundHeight(x: number, z: number): number {
        return this.terrain?.heightAt(x, z) ?? -Infinity;
    }

    public getGroundGradient(x: number, z: number, out: IGradient2): IGradient2 {
        if (!this.terrain) {
            out.x = 0;
            out.z = 0;
            return out;
        }
        return this.terrain.gradientAt(x, z, out);
    }

    public getGroundScrollVelocityZ(): number {
        return this.scrollEnabled && this.terrain ? Math.min(0, this.scrollSpeedZ) : 0;
    }

    /**
     * Scrolls the ground and builds the rows `camera` can see, as far as the fog lets it (`fogDepth`).
     * The ground only scrolls toward the camera (-Z); a positive scroll speed holds it still.
     * Safe no-op when no terrain is set.
     */
    public updateTerrain(dt: number, camera: THREE.PerspectiveCamera, fogDepth: number): void {
        if (!this.terrain) return;
        const scrolled = this.scrollEnabled ? -this.scrollSpeedZ * dt : 0;
        this.terrain.update(scrolled, camera, fogDepth);
    }

    /**
     * Clone invader template into a classic Galaga-style grid above the terrain.
     */
    public spawnInvaderGrid(
        template: THREE.Object3D,
        options: IInvaderGridOptions = {},
    ): void {
        this.clearInvaders();

        const cols = options.cols ?? GAME.invaderCols;
        const rows = options.rows ?? GAME.invaderRows;
        const originX = options.originX ?? GAME.invaderOriginX;
        const originZ = options.originZ ?? GAME.invaderOriginZ;
        const hoverY =
            options.hoverY ?? GAME.invaderHoverY ?? this.bounds.height + GAME.invaderHoverPadding;

        const box = new THREE.Box3().setFromObject(template);
        const size = new THREE.Vector3();
        box.getSize(size);
        const modelWidth = Math.max(size.x, 1);
        const spacing = modelWidth * 1.25;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const instance = template.clone(true);
                instance.rotation.x = Math.PI / 2;

                const x = originX + (col - (cols - 1) / 2) * spacing;
                const z = originZ + (row - (rows - 1) / 2) * spacing;
                instance.position.set(x, hoverY, z);
                instance.castShadow = true;
                instance.receiveShadow = true;
                this.invaderRoot.add(instance);
            }
        }
    }

    public clearInvaders(): void {
        while (this.invaderRoot.children.length > 0) {
            const child = this.invaderRoot.children[0];
            this.invaderRoot.remove(child);
            disposeObject3D(child);
        }
    }

    public clear(): void {
        this.clearInvaders();
        this.clearTerrainOnly();
    }

    private clearTerrainOnly(): void {
        this.terrain?.dispose();
        this.terrain = null;
        this.terrainRoot.position.set(0, 0, 0);
    }

    public attachTo(scene: THREE.Scene): void {
        if (!this.root.parent) {
            scene.add(this.root);
        }
    }

    public detach(): void {
        this.root.parent?.remove(this.root);
    }

    /** Match legacy isometric framing from the old main.ts bootstrap */
    public frameCamera(camera: GameCamera): void {
        const { width, height, depth } = this.bounds;
        const angleRad = (CAMERA.isoAngleDeg * Math.PI) / 180;
        const distance = Math.max(width, depth) * CAMERA.distanceFactor;
        const cameraY = height * 0.5 + distance * 1.5 * Math.sin(angleRad);
        const cameraZ = -distance * Math.cos(angleRad);

        camera.camera.position.set(0, cameraY, cameraZ);
        camera.controls.target.set(0, -50, 0);
        camera.controls.update();

    }

    public get invaderCount(): number {
        return this.invaderRoot.children.length;
    }
}

function disposeMaterial(material: THREE.Material): void {
    // Free any textures the material references (map, normalMap, ...), then the material itself.
    for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        const texture = value as THREE.Texture | null;
        if (texture?.isTexture) texture.dispose();
    }
    material.dispose();
}

/**
 * Free GPU resources of an object tree (geometry, materials, their textures, instance buffers).
 * Do not call on objects that share geometry/materials with others still in use.
 */
export function disposeObject3D(object: THREE.Object3D): void {
    object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const material = mesh.material;
            if (Array.isArray(material)) {
                material.forEach(disposeMaterial);
            } else if (material) {
                disposeMaterial(material);
            }
            if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
                (mesh as THREE.InstancedMesh).dispose();
            }
        }
    });
}
import * as THREE from 'three';
import type { GameCamera } from '../scene/Camera';
import { CAMERA, GAME, TERRAIN } from '../data/constants';
import type {
    ScrollingTerrainBuildResult,
    TerrainBuildResult,
} from './TerrainService';

export interface InvaderGridOptions {
    cols?: number;
    rows?: number;
    /** World offset of grid center-ish origin used by legacy layout */
    originX?: number;
    originZ?: number;
    /** Height above terrain max (y) */
    hoverY?: number;
}

/**
 * Play area: terrain + formation under one root group.
 * Built once by App and shared across Demo/Play/GameOver.
 *
 * Terrain lives under terrainRoot (may scroll).
 * Invaders live under invaderRoot (do NOT parent under terrain).
 */
export class PlayField {
    public readonly root: THREE.Group;
    public bounds = { width: 0, height: 0, depth: 0 };

    private readonly terrainRoot: THREE.Group;
    private readonly invaderRoot: THREE.Group;

    /** Legacy single-tile path */
    private terrainMesh: THREE.Mesh | null = null;

    /** Scrolling pair */
    private terrainMeshA: THREE.Mesh | null = null;
    private terrainMeshB: THREE.Mesh | null = null;
    private tileDepth = 0;
    private scrollSpeedZ: number = TERRAIN.scrollSpeedZ;
    private scrollEnabled: boolean = TERRAIN.scrollEnabledDefault;
    private gameCamera: GameCamera | null = null;

    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'PlayField';

        this.terrainRoot = new THREE.Group();
        this.terrainRoot.name = 'TerrainRoot';
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

    /**
     * Legacy: one static terrain mesh (no scroll pair).
     * Still supported so Step 2 can land before App wiring.
     */
    public setTerrain(result: TerrainBuildResult): void {
        this.clearTerrainOnly();

        this.terrainMesh = result.mesh;
        this.terrainRoot.add(result.mesh);
        this.tileDepth = result.depth;
        this.setBounds(result.width, result.height, result.depth);
    }

    /**
     * Two Z-abutted tiles. Call updateScroll(dt) each frame to animate.
     * terrainRoot is shifted so the pair is centered on Z around 0 at start.
     */
    public setScrollingTerrain(result: ScrollingTerrainBuildResult): void {
        this.clearTerrainOnly();

        this.terrainMeshA = result.meshA;
        this.terrainMeshB = result.meshB;
        this.tileDepth = result.tileDepth;

        this.terrainRoot.add(result.meshA);
        this.terrainRoot.add(result.meshB);

        // Pair spans [0, 2*tileDepth] in local mesh space; center that belt on z=0
        this.terrainRoot.position.set(0, 0, -result.tileDepth);
        this.setBounds(result.width, result.height, result.tileDepth);
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

    /**
     * Slide both tiles on Z and wrap when one fully leaves the belt.
     * Safe no-op if scrolling pair is not set or scroll is disabled.
     */
    public updateScroll(dt: number): void {
        if (!this.scrollEnabled || !this.terrainMeshA || !this.terrainMeshB) {
            return;
        }
        if (this.tileDepth <= 0 || dt === 0) return;

        const dz = this.scrollSpeedZ * dt;
        this.terrainMeshA.position.z += dz;
        this.terrainMeshB.position.z += dz;

        // Meshes start at z=0 and z=tileDepth (local). After centering via terrainRoot,
        // wrap when a tile has scrolled one full tile length out of the 2-tile window.
        this.wrapTile(this.terrainMeshA);
        this.wrapTile(this.terrainMeshB);
    }

    private wrapTile(mesh: THREE.Mesh): void {
        const depth = this.tileDepth;
        const quarterDepth = depth / 1.8;
        const wrapPoint = -257.19 / 1.9;
        // Positive scroll (+Z): when tile goes past the far end of the 2-tile span,
        // jump it back by 2*depth so it leads again.
        // Negative scroll (−Z): mirror.
        if (this.scrollSpeedZ >= 0) {
            // Local positions drift upward; keep each tile inside ~[0, 2*depth)
            if (mesh.position.z >= depth * 2) {
                mesh.position.z -= depth * 2;
            }
        } else {
            if (mesh.position.z < wrapPoint) {
                mesh.position.z += depth * 2;
            }
        }
    }

    /**
     * Clone invader template into a classic Galaga-style grid above the terrain.
     */
    public spawnInvaderGrid(
        template: THREE.Object3D,
        options: InvaderGridOptions = {},
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
        while (this.terrainRoot.children.length > 0) {
            const child = this.terrainRoot.children[0];
            this.terrainRoot.remove(child);
            disposeObject3D(child);
        }
        this.terrainMesh = null;
        this.terrainMeshA = null;
        this.terrainMeshB = null;
        this.tileDepth = 0;
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

        this.gameCamera = camera;
    }

    public get invaderCount(): number {
        return this.invaderRoot.children.length;
    }
}

export function disposeObject3D(object: THREE.Object3D): void {
    object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const material = mesh.material;
            if (Array.isArray(material)) {
                material.forEach((m) => m.dispose());
            } else {
                material?.dispose();
            }
        }
    });
}
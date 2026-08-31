import * as THREE from 'three';
import type { GameCamera } from '../scene/Camera';
import { CAMERA, GAME } from '../data/constants';
import type { TerrainBuildResult } from './TerrainService';

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
 * Built once by App and shared across Demo/Play.
 */
export class PlayField {
    public readonly root: THREE.Group;
    public bounds = { width: 0, height: 0, depth: 0 };

    private terrainMesh: THREE.Mesh | null = null;
    private invaderRoot: THREE.Group;

    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'PlayField';
        this.invaderRoot = new THREE.Group();
        this.invaderRoot.name = 'Invaders';
        this.root.add(this.invaderRoot);
    }

    public setTerrain(result: TerrainBuildResult): void {
        if (this.terrainMesh) {
            this.root.remove(this.terrainMesh);
            disposeObject3D(this.terrainMesh);
            this.terrainMesh = null;
        }

        this.terrainMesh = result.mesh;
        this.root.add(result.mesh);
        this.setBounds(result.width, result.height, result.depth);
    }

    public setBounds(width: number, height: number, depth: number): void {
        this.bounds = { width, height, depth };
    }

    /**
     * Clone invader template into a classic Galaga-style grid above the terrain.
     */
    public spawnInvaderGrid(template: THREE.Object3D, options: InvaderGridOptions = {}): void {
        this.clearInvaders();

        const cols = options.cols ?? GAME.invaderCols;
        const rows = options.rows ?? GAME.invaderRows;
        const originX = options.originX ?? 50;
        const originZ = options.originZ ?? 50;
        const hoverY = options.hoverY ?? this.bounds.height + 8;

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
        if (this.terrainMesh) {
            this.root.remove(this.terrainMesh);
            disposeObject3D(this.terrainMesh);
            this.terrainMesh = null;
        }
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
        const cameraY = height * 0.5 + distance * 1.25 * Math.sin(angleRad);
        const cameraZ = -distance * Math.cos(angleRad);

        camera.camera.position.set(0, cameraY, cameraZ);
        camera.controls.target.set(0, -50, 0);
        camera.controls.update();
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

import * as THREE from 'three';
import type { GameCamera } from '../scene/Camera';
import { CAMERA, DEBUG, GAME, TERRAIN, TERRAIN_TRANSITION } from '../config/data/constants';
import type {
    IGradient2,
    IGroundSampler,
    IInvaderGridOptions,
} from '../config/interfaces/interfaces';
import type { TerrainStyleId } from '../config/types/types';
import type { ScrollingTerrain } from './terrain/ScrollingTerrain';
import type { TerrainStyleRegistry } from './terrain/TerrainStyleRegistry';
import { TerrainTransition } from './terrain/TerrainTransition';

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
    private terrainStyles: TerrainStyleRegistry | null = null;
    private scrollSpeedZ: number = TERRAIN.scrollSpeedZ;
    private scrollEnabled: boolean = TERRAIN.scrollEnabledDefault;
    /** Speed the ground actually scrolled at in the latest updateTerrain (units/s toward -Z). */
    private appliedSpeed = 0;
    /** The speed boost for the terrain change in progress, if any. */
    private transition: { controller: TerrainTransition; startRow: number } | null = null;


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
        this.appliedSpeed = this.baseSpeed();
        this.terrainRoot.add(terrain.field.mesh);
        this.setBounds(terrain.bounds.width, terrain.bounds.height, terrain.bounds.depth);
    }

    /** The current terrain. */
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
        return this.terrain ? -this.appliedSpeed : 0;
    }

    /**
     * Scrolls the ground and builds the rows `camera` can see, as far as the fog lets it (`fogDepth`).
     * The ground only scrolls toward the camera (-Z); a positive scroll speed holds it still. While a terrain
     * change is under way (see requestTerrainStyle) the ground goes faster than normal.
     * Safe no-op when no terrain is set.
     */
    public updateTerrain(dt: number, camera: THREE.PerspectiveCamera, fogDepth: number): void {
        const terrain = this.terrain;
        if (!terrain) return;

        let speed = this.baseSpeed();
        const transition = this.transition;
        if (transition && speed > 0) {
            speed = transition.controller.update(dt, terrain.rowNearZ(transition.startRow) - this.arrivalZ(terrain));
            if (transition.controller.done) this.transition = null;
        }
        this.appliedSpeed = speed;
        terrain.update(speed * dt, camera, fogDepth);
    }

    /** World Z the new terrain's near edge must reach: the bottom of what the camera sees, less the allowed margin. */
    private arrivalZ(terrain: ScrollingTerrain): number {
        const bottom = terrain.visibleNearZ;
        return bottom === null ? TERRAIN_TRANSITION.arrivalZ : bottom + TERRAIN_TRANSITION.arrivalMarginZ;
    }

    /** The terrain styles a wave can ask for by id. Must be built into the same ChunkLibrary as the terrain. */
    public setTerrainStyles(styles: TerrainStyleRegistry): void {
        this.terrainStyles = styles;
    }

    /**
     * Changes the terrain to the style `id`, from the far edge of what is on screen, and speeds the ground up so the
     * new terrain covers the view (see TERRAIN_TRANSITION) by `seconds` from now. The speed is capped by
     * TERRAIN_TRANSITION.maxSpeedZ, so when that is too slow the terrain lands a little late. Does nothing when that
     * style is already showing or on its way. A change that has not appeared yet is replaced by the newer request.
     */
    public requestTerrainStyle(id: TerrainStyleId, seconds: number): void {
        const terrain = this.terrain;
        const styles = this.terrainStyles;
        if (!terrain || !styles) return;

        const style = styles.get(id);
        // Already showing it, or already on its way (the wave that follows the pause asks again): keep what is running.
        if (style === terrain.currentStyle) return;

        const startRow = terrain.queueStyle(style);
        if (startRow === null) {
            // The request put the style before the pending one back, so the pending one was dropped: stop its boost.
            this.transition?.controller.cancel();
            return;
        }

        const base = this.baseSpeed();
        if (base <= 0) return;
        this.transition = {
            startRow,
            controller: new TerrainTransition({
                baseSpeed: base,
                maxSpeed: Math.max(base, TERRAIN_TRANSITION.maxSpeedZ),
                seconds,
                rampUpSeconds: TERRAIN_TRANSITION.rampUpSeconds,
                rampDownSeconds: TERRAIN_TRANSITION.rampDownSeconds,
                startSpeed: this.appliedSpeed > 0 ? this.appliedSpeed : base,
            }),
        };
    }

    /** Normal scroll speed (units/s toward -Z): 0 when scrolling is off or the speed points away from the camera. */
    private baseSpeed(): number {
        return this.scrollEnabled ? Math.max(0, -this.scrollSpeedZ) : 0;
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
        this.transition = null;
        this.appliedSpeed = 0;
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
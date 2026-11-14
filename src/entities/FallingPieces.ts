import * as THREE from 'three';
import { BOSS_ARM, INVADER_MESH_MATERIAL, QUALITY } from '../config/data/constants';
import type { IArmPiece, IParsedVoxModel, IPoint3 } from '../config/interfaces/interfaces';
import { sweptCircleHit } from '../systems/boss/armMath';
import { createModelGeometry } from './BossArm';

interface IFallingPiece {
    data: IArmPiece;
    mesh: THREE.Mesh;
    age: number;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Pieces of cut-loose boss arms. Each drifts toward the camera (-z) at a constant speed, with no gravity, once its
 * delay has passed. A piece is lethal to the player on contact, is destroyed by one shot, and is removed
 * (no penalty) once it has passed the camera.
 */
export class FallingPieces {
    public readonly group = new THREE.Group();

    private readonly pieces: IFallingPiece[] = [];
    private readonly geometries = new Map<IParsedVoxModel, THREE.BufferGeometry>();
    private readonly spin = new THREE.Quaternion();

    public get count(): number {
        return this.pieces.length;
    }

    public add(items: readonly IArmPiece[]): void {
        for (const data of items) {
            const mesh = new THREE.Mesh(this.geometryFor(data.model), INVADER_MESH_MATERIAL);
            mesh.castShadow = QUALITY.entityCastShadow;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            mesh.position.copy(data.position);
            mesh.quaternion.copy(data.quaternion);
            mesh.scale.setScalar(data.scale);
            this.group.add(mesh);
            this.pieces.push({ data, mesh, age: 0 });
        }
    }

    public update(dt: number): void {
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const piece = this.pieces[i];
            piece.age += dt;
            if (piece.age >= piece.data.delay) {
                const { position, quaternion } = piece.data;
                position.z -= BOSS_ARM.fallSpeed * dt;
                if (BOSS_ARM.fallSpin !== 0) {
                    this.spin.setFromAxisAngle(Z_AXIS, BOSS_ARM.fallSpin * dt);
                    quaternion.premultiply(this.spin);
                }
                piece.mesh.position.copy(position);
                piece.mesh.quaternion.copy(quaternion);
            }
            if (piece.data.position.z < BOSS_ARM.fallRemoveZ) this.removeAt(i);
        }
    }

    /** Removes and returns the first piece a shot (previous to current position, with its radius) strikes, or null. */
    public takeShotPiece(previous: IPoint3, current: IPoint3, radius: number): IArmPiece | null {
        for (let i = 0; i < this.pieces.length; i++) {
            const { position, radius: r } = this.pieces[i].data;
            if (Math.abs(current.y - position.y) > BOSS_ARM.shotYTolerance) continue;
            if (sweptCircleHit(previous.x, previous.z, current.x, current.z, position.x, position.z, r + radius) < 0) continue;
            const data = this.pieces[i].data;
            this.removeAt(i);
            return data;
        }
        return null;
    }

    /** True when a circle at a world position touches any piece (X/Z plane, with a Y tolerance). */
    public touches(x: number, y: number, z: number, radius: number): boolean {
        for (const { data } of this.pieces) {
            if (Math.abs(y - data.position.y) > BOSS_ARM.playerYTolerance) continue;
            const reach = data.radius + radius;
            const dx = x - data.position.x;
            const dz = z - data.position.z;
            if (dx * dx + dz * dz <= reach * reach) return true;
        }
        return false;
    }

    public clear(): void {
        for (let i = this.pieces.length - 1; i >= 0; i--) this.removeAt(i);
    }

    public dispose(): void {
        this.clear();
        for (const geometry of this.geometries.values()) geometry.dispose();
        this.geometries.clear();
        this.group.removeFromParent();
    }

    private removeAt(index: number): void {
        this.group.remove(this.pieces[index].mesh);
        this.pieces.splice(index, 1);
    }

    private geometryFor(model: IParsedVoxModel): THREE.BufferGeometry {
        let geometry = this.geometries.get(model);
        if (!geometry) {
            geometry = createModelGeometry(model);
            this.geometries.set(model, geometry);
        }
        return geometry;
    }
}

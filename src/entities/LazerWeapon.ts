import type { InstancedMesh } from 'three';
import { InvaderWeapon } from './InvaderWeapon';
import type { ILazerDespawnBounds, ILazerWeaponConfig } from '../config/interfaces/interfaces';
import type { InvaderWeaponType } from '../config/types/types';

/**
 * A pooled invader lazer (types LazerA and LazerB). It flies in a straight line at the velocity and with the
 * orientation it was launched with, can not be hit by anything, and is recycled once it passes despawnZ
 * or leaves the play area sideways or past +Z (so a lazer fired away from the player can not linger).
 */
export class LazerWeapon extends InvaderWeapon {
    private readonly bounds: ILazerDespawnBounds;

    constructor(
        type: InvaderWeaponType,
        config: ILazerWeaponConfig,
        meshes: readonly InstancedMesh[],
        instanceId: number,
        despawnZ: number,
        bounds: ILazerDespawnBounds,
    ) {
        super(type, config, meshes, instanceId, despawnZ);
        this.bounds = bounds;
    }

    protected override advance(dt: number): void {
        this.position.addScaledVector(this.velocity, dt);
    }

    protected override isOutOfPlay(): boolean {
        const { x, z } = this.position;
        return super.isOutOfPlay() || z > this.bounds.maxZ || x < this.bounds.minX || x > this.bounds.maxX;
    }
}

import type { InstancedMesh, Vector3 } from 'three';
import { InvaderWeapon } from '../entities/InvaderWeapon';
import type { AssetManager } from '../assets/AssetManager';
import { INVADER_WEAPONS, INVADER_WEAPON_TYPES, PLAYER } from '../config/data/constants';
import type { CollisionLayerFlag, InvaderWeaponType } from '../config/types/types';

interface IWeaponBucket {
    mesh: InstancedMesh;
    free: InvaderWeapon[];
    live: InvaderWeapon[];
}

/**
 * Fixed-size pools of invader weapons, one bucket per weapon type, each sharing its own InstancedMesh.
 * Weapons are recycled through free/live arrays; no allocation happens while playing.
 */
export class InvaderWeaponPool {
    private readonly buckets = new Map<InvaderWeaponType, IWeaponBucket>();

    constructor(assets: AssetManager) {
        // Weapons fly toward -Z and are recycled a configured distance behind the player's back edge.
        const playerBackEdgeZ = PLAYER.spawnZ - PLAYER.zRange;

        for (const type of INVADER_WEAPON_TYPES) {
            const config = INVADER_WEAPONS[type];
            const mesh = assets.getOrCreateInstancedMesh(config.assetKey, config.maxCount);
            // The mesh is cached across sessions, so apply the weapon's setting every time.
            mesh.castShadow = config.castShadow;
            mesh.count = config.maxCount;

            const models = assets.getCollisionModels(config.assetKey);
            const despawnZ = playerBackEdgeZ - config.despawnMarginPastPlayer;
            const free: InvaderWeapon[] = [];
            for (let i = config.maxCount - 1; i >= 0; i--) {
                free.push(new InvaderWeapon(type, config, mesh, i, models, despawnZ));
            }
            mesh.instanceMatrix.needsUpdate = true;
            this.buckets.set(type, { mesh, free, live: [] });
        }
    }

    /** Launches a free weapon of this type. Returns false (and does nothing) when its bucket is exhausted. */
    public spawn(type: InvaderWeaponType, origin: Vector3, velocity: Vector3, layer: CollisionLayerFlag): boolean {
        const bucket = this.buckets.get(type);
        const weapon = bucket?.free.pop();
        if (!bucket || !weapon) return false;
        weapon.launch(origin, velocity, layer);
        bucket.live.push(weapon);
        return true;
    }

    /** Visits every live weapon of every type (including ones about to be recycled); used by collision. */
    public forEachLive(visit: (weapon: InvaderWeapon) => void): void {
        for (const bucket of this.buckets.values()) {
            for (const weapon of bucket.live) visit(weapon);
        }
    }

    /** Removes a weapon from play immediately (e.g. it hit something). It is recycled on the next update(). */
    public release(weapon: InvaderWeapon): void {
        if (!weapon.active) return;
        weapon.hide();
        this.buckets.get(weapon.type)!.mesh.instanceMatrix.needsUpdate = true;
    }

    public update(dt: number): void {
        for (const bucket of this.buckets.values()) {
            const live = bucket.live;
            if (live.length === 0) continue;

            // Iterate backwards so swap-remove does not skip entries.
            for (let i = live.length - 1; i >= 0; i--) {
                const weapon = live[i];
                if (weapon.update(dt)) continue;
                live[i] = live[live.length - 1];
                live.pop();
                bucket.free.push(weapon);
            }
            bucket.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    /** Hides and recycles every live weapon. */
    public clear(): void {
        for (const bucket of this.buckets.values()) {
            if (bucket.live.length === 0) continue;
            for (let w = bucket.live.pop(); w; w = bucket.live.pop()) {
                w.hide();
                bucket.free.push(w);
            }
            bucket.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

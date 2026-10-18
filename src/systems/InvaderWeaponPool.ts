import type { InstancedMesh, Quaternion, Vector3 } from 'three';
import { InvaderWeapon } from '../entities/InvaderWeapon';
import { LazerWeapon } from '../entities/LazerWeapon';
import { MineWeapon } from '../entities/MineWeapon';
import type { AssetManager } from '../assets/AssetManager';
import { COLLISION, INVADER_WEAPONS, INVADER_WEAPON_TYPES, PLAYER } from '../config/data/constants';
import type { ILazerDespawnBounds } from '../config/interfaces/interfaces';
import type { CollisionLayerFlag, InvaderWeaponType } from '../config/types/types';
import { applyShotGlow } from './fx/ShotGlow';

/** How far past the collision grid a lazer may fly sideways or toward +Z before it is recycled. */
const LAZER_DESPAWN_MARGIN = 40;

interface IWeaponBucket {
    /** Intact model first, then (for mines) one mesh per config.hitMeshes entry; every weapon owns the same slot in each. */
    meshes: InstancedMesh[];
    free: InvaderWeapon[];
    /** How many weapons of this type are in the pool's live list; lets update() skip uploading idle meshes. */
    liveCount: number;
}

/**
 * Fixed-size pools of invader weapons, one bucket per weapon type. A bucket has one InstancedMesh per model
 * variant (intact, then damaged); weapon i always uses instance slot i in whichever variant it currently shows.
 * Weapons are recycled through free/live arrays; no allocation happens while playing.
 */
export class InvaderWeaponPool {
    private readonly buckets = new Map<InvaderWeaponType, IWeaponBucket>();
    // Same buckets as an array, so per-frame loops need no Map iterator.
    private readonly bucketList: IWeaponBucket[] = [];
    /** Every live weapon of every type in one flat array, so collision can read it without a callback. */
    private readonly live: InvaderWeapon[] = [];

    constructor(assets: AssetManager) {
        // Weapons fly toward -Z and are recycled a configured distance behind the player's back edge.
        const playerBackEdgeZ = PLAYER.spawnZ - PLAYER.zRange;
        const lazerBounds: ILazerDespawnBounds = {
            minX: COLLISION.grid.minX - LAZER_DESPAWN_MARGIN,
            maxX: COLLISION.grid.maxX + LAZER_DESPAWN_MARGIN,
            maxZ: COLLISION.grid.maxZ + LAZER_DESPAWN_MARGIN,
        };

        for (const type of INVADER_WEAPON_TYPES) {
            const config = INVADER_WEAPONS[type];
            const meshKeys = config.kind === 'mine' ? [config.assetKey, ...(config.hitMeshes ?? [])] : [config.assetKey];
            const meshes = meshKeys.map((key) => {
                const mesh = assets.getOrCreateInstancedMesh(key, config.maxCount);
                if (config.kind === 'lazer' && config.glow) applyShotGlow(mesh);
                // Meshes are cached across sessions, so apply the weapon's settings every time.
                mesh.castShadow = config.castShadow;
                mesh.count = config.maxCount;
                return mesh;
            });

            const despawnZ = playerBackEdgeZ - config.despawnMarginPastPlayer;
            const free: InvaderWeapon[] = [];
            for (let i = config.maxCount - 1; i >= 0; i--) {
                free.push(
                    config.kind === 'mine'
                        ? new MineWeapon(type, config, meshes, i, assets.getCollisionModels(config.assetKey), despawnZ)
                        : new LazerWeapon(type, config, meshes, i, despawnZ, lazerBounds),
                );
            }
            for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
            const bucket: IWeaponBucket = { meshes, free, liveCount: 0 };
            this.buckets.set(type, bucket);
            this.bucketList.push(bucket);
        }
    }

    /** Launches a free weapon of this type. Returns false (and does nothing) when its bucket is exhausted. */
    public spawn(
        type: InvaderWeaponType,
        origin: Vector3,
        velocity: Vector3,
        orientation: Quaternion,
        layer: CollisionLayerFlag,
    ): boolean {
        const bucket = this.buckets.get(type);
        const weapon = bucket?.free.pop();
        if (!bucket || !weapon) return false;
        weapon.launch(origin, velocity, orientation, layer);
        bucket.liveCount++;
        this.live.push(weapon);
        return true;
    }

    /**
     * Every live weapon of every type, including ones about to be recycled; used by collision.
     * This is the pool's own array: read it, do not modify it, and do not hold it across update().
     */
    public get liveWeapons(): readonly InvaderWeapon[] {
        return this.live;
    }

    /** Removes a weapon from play immediately (e.g. it hit something). It is recycled on the next update(). */
    public release(weapon: InvaderWeapon): void {
        if (!weapon.active) return;
        weapon.hide();
        this.flagMeshes(this.buckets.get(weapon.type)!);
    }

    public update(dt: number): void {
        const live = this.live;
        if (live.length === 0) return;

        // A bucket's meshes are uploaded if it had live weapons at the start of the frame, as they may be recycled below.
        for (const bucket of this.bucketList) {
            if (bucket.liveCount > 0) this.flagMeshes(bucket);
        }

        // Iterate backwards so swap-remove does not skip entries.
        for (let i = live.length - 1; i >= 0; i--) {
            const weapon = live[i];
            if (weapon.update(dt)) continue;
            live[i] = live[live.length - 1];
            live.pop();
            const bucket = this.buckets.get(weapon.type)!;
            bucket.liveCount--;
            bucket.free.push(weapon);
        }
    }

    /** Hides and recycles every live weapon. */
    public clear(): void {
        for (const bucket of this.bucketList) {
            if (bucket.liveCount > 0) this.flagMeshes(bucket);
            bucket.liveCount = 0;
        }
        for (let w = this.live.pop(); w; w = this.live.pop()) {
            w.hide();
            this.buckets.get(w.type)!.free.push(w);
        }
    }

    /** A weapon may have moved between variant meshes, so every mesh in the bucket needs re-uploading. */
    private flagMeshes(bucket: IWeaponBucket): void {
        for (const mesh of bucket.meshes) mesh.instanceMatrix.needsUpdate = true;
    }
}

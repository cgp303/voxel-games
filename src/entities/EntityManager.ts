import type { Entity } from './Entity';
import type { IFormationSlot } from '../config/interfaces/interfaces';
import { Invader } from './Invader';
import type { AssetManager } from '../assets/AssetManager';


/**
 * Spawn / despawn / tick entities for a screen (usually Play).
 */
export class EntityManager {

    private entities: Entity[] = [];

    private pools: Map<string, Invader[]> = new Map();

    private static readonly MAX_POOL_PER_TYPE = 80;

    // Map of invaders by their formation slot for quick lookup.
    private invadersBySlot = new Map<string, Invader>();

    private assets: AssetManager;

    constructor(assets: AssetManager) {
        this.assets = assets;
    }

    public add(entity: Entity): void {

        this.entities.push(entity);
        // only register invaders in the formation map
        if (entity instanceof Invader) this.registerInvaderInFormation(entity);
    }


    public remove(entity: Entity): void {
        const i = this.entities.indexOf(entity);
        if (i >= 0) this.entities.splice(i, 1);
        if (entity instanceof Invader) {
            this.unregisterInvaderFromFormation(entity);
            this.releaseToPool(entity, entity.poolAssetKey);
        } else {
            entity.dispose();
        }
    }

    public update(dt: number): void {
        for (const e of this.entities) {
            if (e.active) e.update(dt);
        }
        // Drop inactive
        for (let i = this.entities.length - 1; i >= 0; i--) {
            if (!this.entities[i].active) {
                const e = this.entities[i];
                if (e instanceof Invader) {
                    this.unregisterInvaderFromFormation(e);
                    this.releaseToPool(e, e.poolAssetKey);
                } else {
                    e.dispose();
                }
                this.entities.splice(i, 1);
            }
        }

        // Mark InstancedMesh(es) as needing update
        this.assets.markInstancedMeshesDirty();
    }

    public clear(): void {
        for (const e of this.entities) {
            e.dispose();
        }
        this.entities.length = 0;
        this.invadersBySlot.clear();
    }

    public getAll(): readonly Entity[] {
        return this.entities;
    }

    public get count(): number {
        return this.entities.length;
    }

    // Helpers for using the invadersBySlot map.
    private slotKey(slot: IFormationSlot): string {
        return `${slot.col},${slot.row}`;
    }

    public registerInvaderInFormation(invader: Invader): void {
        this.invadersBySlot.set(this.slotKey(invader.slot), invader);
    }

    public unregisterInvaderFromFormation(invader: Invader): void {
        this.invadersBySlot.delete(this.slotKey(invader.slot));
    }

    public getInvaderAtSlot(key: string): Invader | null {
        const inv = this.invadersBySlot.get(key);
        if (!inv) return null;
        return inv.mode === 'formation' ? inv : null;
    }

    public acquireInvader(assetKey: string): Invader {
        const pool = this.pools.get(assetKey);
        let invader = pool?.pop();

        if (!invader) {
            invader = new Invader();
        }

        // Get the shared InstancedMesh
        const mesh = this.assets.getOrCreateInstancedMesh(assetKey);

        // Try to recycle a freed slot from AssetManager; otherwise allocate a new one
        const freeSlots = this.assets.getFreeSlots(assetKey);
        let instanceId: number;

        if (freeSlots.length > 0) {
            instanceId = freeSlots.pop()!;
        } else {
            instanceId = mesh.count;
            mesh.count += 1;
        }

        invader.instanceId = instanceId;
        invader.assetKey = assetKey;
        invader.setInstancedMesh(mesh);

        return invader;
    }

    private releaseToPool(entity: Entity, assetKey: string | null | undefined): void {
        if (!(entity instanceof Invader)) return;

        // Capture the instanceId BEFORE calling dispose (which sets it to -1)
        const instanceId = entity.instanceId;

        // Invader.dispose() already hides the instance and sets instanceId = -1
        entity.dispose();

        if (!assetKey) return;

        const pool = this.pools.get(assetKey) ?? [];
        if (pool.length < EntityManager.MAX_POOL_PER_TYPE) {
            pool.push(entity);

            // Return the slot to AssetManager's free-list for recycling
            const freeSlots = this.assets.getFreeSlots(assetKey);
            if (instanceId >= 0) {
                freeSlots.push(instanceId);

            }
        }
        this.pools.set(assetKey, pool);
    }

}

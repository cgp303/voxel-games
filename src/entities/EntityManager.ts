import type { Entity } from './Entity';
import type { SlotKey } from '../config/types/types';
import { Invader } from './Invader';
import { slotKey } from '../systems/patterns/formations/slotKey';
import type { AssetManager } from '../assets/AssetManager';


/**
 * Spawn / despawn / tick entities for a screen (usually Play).
 */
export class EntityManager {

    private entities: Entity[] = [];

    private pools: Map<string, Invader[]> = new Map();

    private static readonly MAX_POOL_PER_TYPE = 80;

    // Invaders in formation by slot, keyed by slotKey(col, row) (an integer, so lookups build no strings).
    private invadersBySlot = new Map<SlotKey, Invader>();

    private assets: AssetManager;

    constructor(assets: AssetManager) {
        this.assets = assets;
    }

    public add(entity: Entity): void {
        if (entity.managerIndex >= 0) return;

        entity.managerIndex = this.entities.length;
        this.entities.push(entity);
        // only register invaders in the formation map
        if (entity instanceof Invader) this.registerInvaderInFormation(entity);
    }

    /**
     * Removes an entity (O(1) swap-remove, so list order is not preserved). Safe to call twice.
     * Do not call from inside an entity's own update(): the list is being iterated.
     */
    public remove(entity: Entity): void {
        const i = entity.managerIndex;
        if (i < 0 || this.entities[i] !== entity) return;

        const last = this.entities.pop()!;
        if (last !== entity) {
            this.entities[i] = last;
            last.managerIndex = i;
        }
        entity.managerIndex = -1;

        if (entity instanceof Invader) {
            this.unregisterInvaderFromFormation(entity);
            this.releaseToPool(entity, entity.poolAssetKey);
        } else {
            entity.dispose();
        }
    }

    public update(dt: number): void {
        // Inactive entities are never listed: remove() is the only way out of the list.
        const entities = this.entities;
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e.active) e.update(dt);
        }

        // Mark InstancedMesh(es) as needing update
        this.assets.markInstancedMeshesDirty();
    }

    public clear(): void {
        for (const e of this.entities) {
            e.dispose();
            e.managerIndex = -1;
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
    public registerInvaderInFormation(invader: Invader): void {
        this.invadersBySlot.set(slotKey(invader.slot.col, invader.slot.row), invader);
    }

    public unregisterInvaderFromFormation(invader: Invader): void {
        this.invadersBySlot.delete(slotKey(invader.slot.col, invader.slot.row));
    }

    public getInvaderAtSlot(key: SlotKey): Invader | null {
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
        invader.collisionModels = this.assets.getCollisionModels(assetKey);
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

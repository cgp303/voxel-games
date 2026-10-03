import type { Entity } from './Entity';
import type { FormationSlot } from '../app/types';
import { Invader } from './Invader';
import {
    Object3D,
    type Object3D as Object3DType,
} from 'three';

/**
 * Spawn / despawn / tick entities for a screen (usually Play).
 */
export class EntityManager {

    private entities: Entity[] = [];

    private pools: Map<string, Invader[]> = new Map();

    private static readonly MAX_POOL_PER_TYPE = 80;

    // Map of invaders by their formation slot for quick lookup.
    private invadersBySlot = new Map<string, Invader>();

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
    private slotKey(slot: FormationSlot): string {
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

    public acquireInvader(assetKey: string, template: Object3D): Invader {
        const pool = this.pools.get(assetKey);
        const invader = pool?.pop();
        if (invader) return invader;

        const mesh = template.clone(true);
        mesh.traverse((child) => {
            const m = child as { castShadow?: boolean; receiveShadow?: boolean; isMesh?: boolean };
            if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
        });
        return new Invader(mesh);
    }

    private releaseToPool(entity: Entity, assetKey: string | null | undefined): void {
        if (!(entity instanceof Invader)) return;
        if (!assetKey) {
            entity.dispose();
            return;  // No pool key; just dispose normally (shouldn't happen, but defensive)
        }
        entity.dispose(); // detach + hide, already pool-safe
        const pool = this.pools.get(assetKey) ?? [];
        if (pool.length < EntityManager.MAX_POOL_PER_TYPE) pool.push(entity);
        this.pools.set(assetKey, pool);
    }

}

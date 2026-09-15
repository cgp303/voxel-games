import type { Entity } from './Entity';
import type { FormationSlot } from '../app/types';
import { Invader } from './Invader';

/**
 * Spawn / despawn / tick entities for a screen (usually Play).
 */
export class EntityManager {

    private entities: Entity[] = [];

    // Map of invaders by their formation slot for quick lookup.
    private invadersBySlot = new Map<string, Invader>();

    public add(entity: Entity): void {
        this.entities.push(entity);
        this.registerInvaderInFormation(entity as Invader);
    }

    public remove(entity: Entity): void {
        const i = this.entities.indexOf(entity);
        if (i >= 0) {
            this.entities.splice(i, 1);
        }
        this.unregisterInvaderFromFormation(entity as Invader);
        entity.dispose();
    }

    public update(dt: number): void {
        for (const e of this.entities) {
            if (e.active) e.update(dt);
        }
        // Drop inactive
        for (let i = this.entities.length - 1; i >= 0; i--) {
            if (!this.entities[i].active) {
                this.entities[i].dispose();
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

}

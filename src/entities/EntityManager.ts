import type { Entity } from './Entity';

/**
 * Spawn / despawn / tick entities for a screen (usually Play).
 */
export class EntityManager {
    private entities: Entity[] = [];

    public add(entity: Entity): void {
        this.entities.push(entity);
    }

    public remove(entity: Entity): void {
        const i = this.entities.indexOf(entity);
        if (i >= 0) {
            this.entities.splice(i, 1);
        }
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
    }

    public getAll(): readonly Entity[] {
        return this.entities;
    }

    public get count(): number {
        return this.entities.length;
    }
}

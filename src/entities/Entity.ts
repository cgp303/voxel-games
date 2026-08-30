import type { Object3D } from 'three';

let nextEntityId = 1;

/**
 * Lightweight base for world actors (ship, invader, shot).
 * Phase 0: structure only — no gameplay subclasses yet.
 */
export class Entity {
    public readonly id: number;
    public active = true;
    public readonly object3d: Object3D | null;

    constructor(object3d: Object3D | null = null) {
        this.id = nextEntityId++;
        this.object3d = object3d;
    }

    public update(_dt: number): void {
        // subclasses override
    }

    public dispose(): void {
        this.active = false;
        // subclasses free geometry/material; base does not assume ownership
    }
}

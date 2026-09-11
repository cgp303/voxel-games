import { Vector3, type Object3D } from 'three';

/**
 * Lightweight base for world actors (ship, invader, shot).
 * Logical transform lives on the entity; mesh follows via syncTransform().
 */
export class Entity {
    public active = true;
    public readonly object3d: Object3D | null;

    /** World-space source of truth for translation */
    public readonly position = new Vector3();

    /** World-space velocity (units/sec). Shots/ship use this; formation invaders often leave it zero. */
    public readonly velocity = new Vector3();

    /**
     * When true, base update integrates position += velocity * dt then syncs.
     * Path-following actors (invaders) set this false and write position themselves.
     */
    protected integrateVelocity = true;

    constructor(object3d: Object3D | null = null) {
        this.object3d = object3d;
        if (object3d) {
            this.position.copy(object3d.position);
        }
    }

    public update(dt: number): void {
        if (this.integrateVelocity && dt !== 0) {
            this.position.x += this.velocity.x * dt;
            this.position.y += this.velocity.y * dt;
            this.position.z += this.velocity.z * dt;
        }
        this.syncTransform();
    }

    /**
     * Write logical state → mesh.
     * Subclasses that also drive rotation should override or call super then set quaternion.
     */
    public syncTransform(): void {
        if (!this.object3d) return;
        this.object3d.position.copy(this.position);
    }

    public dispose(): void {
        this.active = false;
        // subclasses free geometry/material; base does not assume ownership
    }
}

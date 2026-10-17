import type { InstancedMesh, Vector3 } from 'three';
import { Projectile } from '../entities/Projectile';
import { applyShotGlow } from './fx/ShotGlow';
import type { IWeaponConfig } from '../config/interfaces/interfaces';

/**
 * Fixed-size pool of projectiles sharing one InstancedMesh.
 * Shots are recycled through free/live arrays; no allocation happens while firing.
 */
export class ProjectilePool {
    private readonly mesh: InstancedMesh;
    private readonly free: Projectile[] = [];
    private readonly live: Projectile[] = [];

    constructor(mesh: InstancedMesh, config: IWeaponConfig) {
        this.mesh = mesh;

        applyShotGlow(mesh);
        // The mesh is cached and defaults to casting shadows, so apply the weapon's setting every time.
        mesh.castShadow = config.castShadow;

        mesh.count = config.maxCount;
        for (let i = config.maxCount - 1; i >= 0; i--) {
            this.free.push(new Projectile(mesh, i, config));
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    /** Launches a free shot. Returns false (and does nothing) when the pool is exhausted. */
    public spawn(origin: Vector3, velocity: Vector3): boolean {
        const projectile = this.free.pop();
        if (!projectile) return false;
        projectile.launch(origin, velocity);
        this.live.push(projectile);
        return true;
    }

    /** Shots currently in the pool's live list (including ones about to be recycled); read-only view for collision. */
    public get liveShots(): readonly Projectile[] {
        return this.live;
    }

    /** Removes a shot from play immediately (e.g. it hit something). It is recycled on the next update(). */
    public release(projectile: Projectile): void {
        if (projectile.state === 'Idle') return;
        projectile.hide();
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    public update(dt: number): void {
        if (this.live.length === 0) return;

        // Iterate backwards so swap-remove does not skip entries.
        for (let i = this.live.length - 1; i >= 0; i--) {
            const projectile = this.live[i];
            if (projectile.update(dt)) continue;
            this.live[i] = this.live[this.live.length - 1];
            this.live.pop();
            this.free.push(projectile);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    /** Hides and recycles every live shot. */
    public clear(): void {
        let released = false;
        for (let p = this.live.pop(); p; p = this.live.pop()) {
            p.hide();
            this.free.push(p);
            released = true;
        }
        if (released) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

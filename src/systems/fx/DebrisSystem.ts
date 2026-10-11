import type { IGroundSampler, IQuaternionLike, IVector3Like, IVoxelCloud } from '../../config/interfaces/interfaces';
import type { ExplosionKind } from '../../config/types/types';
import { EXPLOSION } from '../../config/data/constants';
import { DebrisSimulation } from './DebrisSimulation';
import { DebrisRenderer } from './DebrisRenderer';

/**
 * Explosion debris for a play session: the simulation plus the mesh that draws it.
 * Add `mesh` to the scene once; call explode() on a hit and update() every frame.
 */
export class DebrisSystem {
    public readonly mesh: DebrisRenderer['mesh'];

    private readonly simulation: DebrisSimulation;
    private readonly renderer: DebrisRenderer;

    constructor(ground: IGroundSampler) {
        this.simulation = new DebrisSimulation(EXPLOSION, ground);
        this.renderer = new DebrisRenderer(EXPLOSION.maxParticles);
        this.mesh = this.renderer.mesh;
    }

    /**
     * Breaks a model apart into debris at the given world pose; `velocity` is the dying entity's own motion.
     * Returns the longest lifetime (s) of the new debris, i.e. how long until the explosion has finished.
     */
    public explode(
        kind: ExplosionKind,
        cloud: IVoxelCloud,
        origin: IVector3Like,
        orientation: IQuaternionLike,
        velocity: IVector3Like,
    ): number {
        const longestLife = this.simulation.spawn(kind, cloud, origin, orientation, velocity);
        // Show the new debris this frame rather than a frame late.
        this.renderer.sync(this.simulation);
        return longestLife;
    }

    public update(dt: number): void {
        if (this.simulation.count === 0 && this.mesh.count === 0) return;
        this.simulation.update(dt);
        this.renderer.sync(this.simulation);
    }

    public get activeCount(): number {
        return this.simulation.count;
    }

    public clear(): void {
        this.simulation.clear();
        this.renderer.sync(this.simulation);
    }

    public dispose(): void {
        this.simulation.clear();
        this.renderer.dispose();
    }
}

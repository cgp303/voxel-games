import type { CollisionLayerFlag } from './CollisionLayers.ts';
import type { CollisionModelSet } from './CollisionModel.ts';

export interface IPoint3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** Something that sweeps through the world and tests against targets (shots, bombs). */
export interface ICollisionMover {
    readonly collisionLayer: CollisionLayerFlag;
    /** False while the mover is idle, fading or otherwise not collidable. */
    readonly collisionEnabled: boolean;
    /** World-unit radius the mover adds to a target's footprint. */
    readonly collisionRadius: number;
    /** When true every target along the path is hit; otherwise only the nearest one. */
    readonly collisionPierces?: boolean;
    readonly position: IPoint3;
    /** Position at the start of the frame; the swept path runs previous -> position. */
    readonly previousPosition: IPoint3;
}

/** Something a mover can hit (invaders, the player, shootable weapons). */
export interface ICollisionTarget {
    readonly collisionLayer: CollisionLayerFlag;
    readonly collisionEnabled: boolean;
    readonly collisionModels: CollisionModelSet | null;
    readonly position: IPoint3;
    /** Rotation about the Z (travel) axis in radians; selects the baked footprint. */
    getCollisionRoll(): number;
}

/** A mover layer collides with the target layers in `targets`. */
export interface ICollisionRule {
    mover: CollisionLayerFlag;
    targets: number;
    /** A pair is skipped when the Y distance between origins exceeds this. Y is never used otherwise. */
    yTolerance?: number;
}

export interface ICollisionGridBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface ICollisionSystemConfig {
    grid: ICollisionGridBounds & { cellSize: number };
    /** Layers tested directly, without the broadphase (for example the single player). */
    directLayers: number;
    rules: readonly ICollisionRule[];
}

export interface ICollisionHit {
    mover: ICollisionMover | null;
    target: ICollisionTarget | null;
    /** Fraction (0..1) along the mover's swept path where it first touches the target. */
    t: number;
    /** World-space hit point. */
    x: number;
    z: number;
    /** Hit point relative to the target origin, in the target's baked (rolled) frame. */
    localX: number;
    localZ: number;
    /** Roll bucket of the target's baked footprint that was hit. */
    bucket: number;
}

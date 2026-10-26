import { Quaternion, Vector3, type InstancedMesh } from 'three';
import { InvaderWeapon } from './InvaderWeapon';
import type { ICollisionTarget, IMineWeaponConfig } from '../config/interfaces/interfaces';
import type { InvaderWeaponType } from '../config/types/types';
import type { CollisionModelSet } from '../systems/collision/CollisionModel';

const TWO_PI = Math.PI * 2;
const tempRotation = new Quaternion();
const tempTumble = new Quaternion();
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * A pooled mine. It flies in a straight line at constant velocity and is recycled once it passes despawnZ.
 * It can be shot when its layer is INVADER_WEAPON_SHOOTABLE.
 * It has hit points: a hit that does not destroy it knocks it back (+Z, away from the player) with a
 * decelerating push while it tumbles one full turn about its X axis; its spin about Z carries on throughout.
 * Each such hit also moves it to the next damaged model (config.hitMeshes), when there is one.
 */
export class MineWeapon extends InvaderWeapon implements ICollisionTarget {
    /** Baked footprints of this weapon's model, used when player shots test against it. */
    public readonly collisionModels: CollisionModelSet | null;

    private readonly config: IMineWeaponConfig;
    private readonly knockbackDuration: number;
    private spinAngle = 0;
    private hitPoints = 0;
    /** Seconds left of the push from the last hit; its +Z speed decays linearly with this. */
    private knockbackRemaining = 0;
    private tumbleAngle = 0;
    private tumbleRemaining = 0;

    constructor(
        type: InvaderWeaponType,
        config: IMineWeaponConfig,
        meshes: readonly InstancedMesh[],
        instanceId: number,
        collisionModels: CollisionModelSet | null,
        despawnZ: number,
    ) {
        super(type, config, meshes, instanceId, despawnZ);
        this.config = config;
        this.collisionModels = collisionModels;
        // A push of speed v that decays linearly to zero covers v * T / 2, so T = 2 * distance / v.
        this.knockbackDuration = config.knockbackSpeed > 0 ? (2 * config.knockbackDistance) / config.knockbackSpeed : 0;
    }

    public getCollisionRoll(): number {
        return this.spinAngle;
    }

    public hitPointsRemaining(): number {
        return this.hitPoints;
    }
    /**
     * Applies a hit. Returns true when the weapon is destroyed; otherwise it is knocked back
     * (restarting any push already in progress), tumbles one more full turn and, if a damaged model
     * is configured for this hit, switches to it.
     */
    public takeHit(power: number): boolean {
        this.hitPoints -= power;
        if (this.hitPoints <= 0) return true;

        if (this.knockbackDuration > 0) {
            this.knockbackRemaining = this.knockbackDuration;
            this.tumbleRemaining += TWO_PI;
        }
        this.showMesh(Math.min(this.meshIndex + 1, this.meshes.length - 1));
        return false;
    }

    protected override onLaunch(): void {
        this.spinAngle = 0;
        this.hitPoints = this.config.hitPoints;
        this.knockbackRemaining = 0;
        this.tumbleAngle = 0;
        this.tumbleRemaining = 0;
    }

    protected override advance(dt: number): void {
        this.position.addScaledVector(this.velocity, dt);
        this.spinAngle += this.config.spinRateRadPerSec * dt;
        this.updateKnockback(dt);
    }

    private updateKnockback(dt: number): void {
        if (this.knockbackRemaining > 0) {
            const share = this.knockbackRemaining / this.knockbackDuration;
            this.position.z += this.config.knockbackSpeed * share * dt;
            this.knockbackRemaining = Math.max(0, this.knockbackRemaining - dt);
        }
        if (this.tumbleRemaining > 0) {
            const step = Math.min((TWO_PI / this.knockbackDuration) * dt, this.tumbleRemaining);
            this.tumbleAngle += step;
            this.tumbleRemaining -= step;
            // Every hit adds whole turns, so finishing lands back on the upright pose.
            if (this.tumbleRemaining < 1e-6) {
                this.tumbleRemaining = 0;
                this.tumbleAngle = 0;
            }
        }
    }

    /** Spin about local Z first, then the knockback tumble about X. */
    protected override getDisplayRotation(): Quaternion {
        tempTumble.setFromAxisAngle(Z_AXIS, this.spinAngle);
        return tempRotation.setFromAxisAngle(X_AXIS, this.tumbleAngle).multiply(tempTumble);
    }
}

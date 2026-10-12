import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { Entity } from './Entity';
import type { ICollisionMover, ICollisionTarget, IInvaderWeaponConfig } from '../config/interfaces/interfaces';
import { CollisionLayer, type CollisionLayerFlag, type InvaderWeaponType } from '../config/types/types';
import type { CollisionModelSet } from '../systems/collision/CollisionModel';

const TWO_PI = Math.PI * 2;
const tempMatrix = new Matrix4();
const tempRotation = new Quaternion();
const tempTumble = new Quaternion();
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const unitScale = new Vector3(1, 1, 1);
const zeroScale = new Vector3(0, 0, 0);

/**
 * One pooled invader weapon (e.g. a mine): an instance slot in a shared InstancedMesh.
 * It flies in a straight line at constant velocity and is recycled once it passes despawnZ.
 * As a mover it can hit the player; as a target it can be shot when its layer is INVADER_WEAPON_SHOOTABLE.
 * It has hit points: a hit that does not destroy it knocks it back (+Z, away from the player) with a
 * decelerating push while it tumbles one full turn about its X axis; its spin about Z carries on throughout.
 */
export class InvaderWeapon extends Entity implements ICollisionMover, ICollisionTarget {
    public readonly type: InvaderWeaponType;
    public collisionLayer: CollisionLayerFlag = CollisionLayer.INVADER_WEAPON;
    public readonly collisionRadius: number;
    /** Baked footprints of this weapon's model, used when player shots test against it. */
    public readonly collisionModels: CollisionModelSet | null;
    /** Position at the start of the last update; the collision sweep runs previousPosition -> position. */
    public readonly previousPosition = new Vector3();

    private readonly config: IInvaderWeaponConfig;
    private readonly instancedMesh: InstancedMesh;
    private readonly instanceId: number;
    private readonly despawnZ: number;
    private readonly knockbackDuration: number;
    private spinAngle = 0;
    private hitPoints = 0;
    /** Seconds left of the push from the last hit; its +Z speed decays linearly with this. */
    private knockbackRemaining = 0;
    private tumbleAngle = 0;
    private tumbleRemaining = 0;

    constructor(
        type: InvaderWeaponType,
        config: IInvaderWeaponConfig,
        mesh: InstancedMesh,
        instanceId: number,
        collisionModels: CollisionModelSet | null,
        despawnZ: number,
    ) {
        super(null);
        // update() moves the weapon itself so it can swap the previous position first.
        this.integrateVelocity = false;
        this.type = type;
        this.config = config;
        this.instancedMesh = mesh;
        this.instanceId = instanceId;
        this.collisionRadius = config.collisionRadius;
        this.collisionModels = collisionModels;
        this.despawnZ = despawnZ;
        // A push of speed v that decays linearly to zero covers v * T / 2, so T = 2 * distance / v.
        this.knockbackDuration = config.knockbackSpeed > 0 ? (2 * config.knockbackDistance) / config.knockbackSpeed : 0;
        this.active = false;
        this.syncTransform();
    }

    /** Only live weapons can hit or be hit; idle ones are hidden in the pool. */
    public get collisionEnabled(): boolean {
        return this.active;
    }

    public getCollisionRoll(): number {
        return this.spinAngle;
    }

    public launch(origin: Vector3, velocity: Vector3, layer: CollisionLayerFlag): void {
        this.position.copy(origin);
        this.previousPosition.copy(origin);
        this.velocity.copy(velocity);
        this.collisionLayer = layer;
        this.spinAngle = 0;
        this.hitPoints = this.config.hitPoints;
        this.knockbackRemaining = 0;
        this.tumbleAngle = 0;
        this.tumbleRemaining = 0;
        this.active = true;
        this.syncTransform();
    }

    /**
     * Applies a hit. Returns true when the weapon is destroyed; otherwise it is knocked back
     * (restarting any push already in progress) and tumbles one more full turn.
     */
    public takeHit(power: number): boolean {
        this.hitPoints -= power;
        if (this.hitPoints <= 0) return true;

        if (this.knockbackDuration > 0) {
            this.knockbackRemaining = this.knockbackDuration;
            this.tumbleRemaining += TWO_PI;
        }
        return false;
    }

    /** Hides the instance and takes it out of play; the pool recycles it on its next update. */
    public hide(): void {
        this.active = false;
        this.syncTransform();
    }

    /** Advances the weapon. Returns false once it is out of play and can go back to the pool. */
    public override update(dt: number): boolean {
        if (!this.active) return false;

        this.previousPosition.copy(this.position);
        this.position.addScaledVector(this.velocity, dt);
        this.spinAngle += this.config.spinRateRadPerSec * dt;
        this.updateKnockback(dt);

        if (this.position.z < this.despawnZ) {
            this.hide();
            return false;
        }
        this.syncTransform();
        return true;
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

    public override syncTransform(): void {
        // Spin about local Z first, then the knockback tumble about X.
        tempTumble.setFromAxisAngle(Z_AXIS, this.spinAngle);
        tempRotation.setFromAxisAngle(X_AXIS, this.tumbleAngle).multiply(tempTumble);
        tempMatrix.compose(this.position, tempRotation, this.active ? unitScale : zeroScale);
        this.instancedMesh.setMatrixAt(this.instanceId, tempMatrix);
    }
}

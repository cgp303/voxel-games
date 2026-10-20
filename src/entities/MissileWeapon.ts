import { Quaternion, Vector3, type InstancedMesh } from 'three';
import { InvaderWeapon } from './InvaderWeapon';
import { sampleCubic, sampleCubicDerivative } from '../systems/path/cubicBezier';
import type { IBossMissileConfig, ICollisionModelSource, ICollisionTarget, ILazerDespawnBounds } from '../config/interfaces/interfaces';
import type { PooledWeaponKey } from '../config/types/types';

const Z_AXIS = new Vector3(0, 0, 1);
const Y_AXIS = new Vector3(0, 1, 0);
const tempHeading = new Quaternion();
const tempSpin = new Quaternion();
const tempRotation = new Quaternion();
const tempDir = new Vector3();
const tempDesired = new Vector3();
const tempAxis = new Vector3();
const tempTurn = new Quaternion();
/** Where a missile released with no player in play is aimed, as a distance straight ahead (-Z). */
const NO_TARGET_RANGE = 250;
/** How far along its approach a curve's control points sit, as a fraction of the curve's length. */
const CONTROL_REACH = 0.3;

/**
 * A boss missile. It is launched toward -Z and then:
 *  - 'bezier': follows a curve that ends where the player was at release, then carries straight on;
 *  - 'homing': steers toward the player's current position at a limited turn rate;
 *  - 'bezierThenHoming': the curve first, then homing.
 * The player can shoot it (it has hit points, like a mine, but is simply destroyed by the last hit), so its layer is
 * set by the launcher. It gives up after `maxLifeSec` and is recycled once past despawnZ or out of the play area.
 */
export class MissileWeapon extends InvaderWeapon implements ICollisionTarget {
    public readonly collisionModels: ICollisionModelSource | null;

    private readonly config: IBossMissileConfig;
    private readonly getTarget: () => Vector3 | null;
    private readonly bounds: ILazerDespawnBounds;

    private readonly p0 = new Vector3();
    private readonly p1 = new Vector3();
    private readonly p2 = new Vector3();
    private readonly p3 = new Vector3();
    private bezierT = 1;
    private bezierDuration = 1;
    private speed = 0;
    private age = 0;
    private spinAngle = 0;
    private hitPoints = 0;
    private homing = false;

    constructor(
        type: PooledWeaponKey,
        config: IBossMissileConfig,
        meshes: readonly InstancedMesh[],
        instanceId: number,
        collisionModels: ICollisionModelSource | null,
        despawnZ: number,
        bounds: ILazerDespawnBounds,
        getTarget: () => Vector3 | null,
    ) {
        super(type, config, meshes, instanceId, despawnZ);
        this.config = config;
        this.collisionModels = collisionModels;
        this.bounds = bounds;
        this.getTarget = getTarget;
    }

    /** A symmetrical model: its footprint is baked once, whatever it is doing. */
    public getCollisionRoll(): number {
        return 0;
    }

    /** Applies a hit. Returns true when the missile is destroyed. */
    public takeHit(power: number): boolean {
        this.hitPoints -= power;
        return this.hitPoints <= 0;
    }

    protected override onLaunch(): void {
        const { guidance } = this.config;
        this.speed = this.velocity.length();
        this.age = 0;
        this.spinAngle = 0;
        this.hitPoints = this.config.hitPoints;
        this.homing = guidance === 'homing';
        this.bezierT = 1;
        if (guidance !== 'homing') this.planCurve();
    }

    protected override advance(dt: number): void {
        this.age += dt;
        this.spinAngle += this.config.spinRateRadPerSec * dt;

        if (this.bezierT < 1) {
            this.followCurve(dt);
        } else {
            if (this.homing) this.steer(dt);
            this.position.addScaledVector(this.velocity, dt);
        }
    }

    protected override isOutOfPlay(): boolean {
        const { x, z } = this.position;
        return (
            this.age > this.config.maxLifeSec ||
            super.isOutOfPlay() ||
            z > this.bounds.maxZ || x < this.bounds.minX || x > this.bounds.maxX
        );
    }

    /** Heading first (the model's +Z along its travel), then its own spin about that axis. */
    protected override getDisplayRotation(): Quaternion {
        tempDir.copy(this.velocity);
        if (tempDir.lengthSq() < 1e-10) return this.orientation;
        tempHeading.setFromUnitVectors(Z_AXIS, tempDir.normalize());
        tempSpin.setFromAxisAngle(Z_AXIS, this.spinAngle);
        return tempRotation.copy(tempHeading).multiply(tempSpin);
    }

    /**
     * A curve from the launcher to where the player is now, leaving along the launch direction and bowing to one
     * side at random so missiles swoop rather than run in lines. With no player it just flies on straight ahead.
     */
    private planCurve(): void {
        const target = this.getTarget();
        this.p0.copy(this.position);
        if (target) this.p3.copy(target);
        else this.p3.copy(this.position).addScaledVector(tempDir.copy(this.velocity).normalize(), NO_TARGET_RANGE);

        const toTarget = tempDesired.subVectors(this.p3, this.p0);
        const length = toTarget.length();
        if (length < 1e-3) return;
        toTarget.divideScalar(length);

        const launch = tempDir.copy(this.velocity).normalize();
        // Sideways in the ground plane, perpendicular to the way to the target.
        const side = tempAxis.crossVectors(Y_AXIS, toTarget).normalize();
        const bow = this.config.bezierBow * length * (Math.random() < 0.5 ? -1 : 1);

        this.p1.copy(this.p0).addScaledVector(launch, length * CONTROL_REACH).addScaledVector(side, bow);
        this.p2.copy(this.p3).addScaledVector(toTarget, -length * CONTROL_REACH).addScaledVector(side, bow);

        // The curve is longer than its chord; the control polygon's length is a fair upper bound, so average them.
        const approxLength =
            (this.p1.distanceTo(this.p0) + this.p2.distanceTo(this.p1) + this.p3.distanceTo(this.p2) + length) / 2;
        this.bezierDuration = Math.max(0.05, approxLength / Math.max(this.speed, 1e-3));
        this.bezierT = 0;
    }

    private followCurve(dt: number): void {
        this.bezierT = Math.min(1, this.bezierT + dt / this.bezierDuration);
        sampleCubic(this.p0, this.p1, this.p2, this.p3, this.bezierT, this.position);
        sampleCubicDerivative(this.p0, this.p1, this.p2, this.p3, this.bezierT, tempDir);
        if (tempDir.lengthSq() > 1e-10) this.velocity.copy(tempDir).setLength(this.speed);
        if (this.bezierT >= 1 && this.config.guidance === 'bezierThenHoming') this.homing = true;
    }

    /** Turns the heading toward the player by at most the turn rate, keeping the speed. */
    private steer(dt: number): void {
        const target = this.getTarget();
        if (!target) return;
        const heading = tempDir.copy(this.velocity);
        if (heading.lengthSq() < 1e-10) return;
        heading.normalize();
        const desired = tempDesired.subVectors(target, this.position);
        if (desired.lengthSq() < 1e-10) return;
        desired.normalize();

        const angle = heading.angleTo(desired);
        const maxTurn = this.config.turnRateRadPerSec * dt;
        if (angle <= maxTurn) {
            this.velocity.copy(desired).multiplyScalar(this.speed);
            return;
        }
        tempAxis.crossVectors(heading, desired);
        if (tempAxis.lengthSq() < 1e-10) return;
        tempAxis.normalize();
        tempTurn.setFromAxisAngle(tempAxis, maxTurn);
        this.velocity.copy(heading.applyQuaternion(tempTurn)).multiplyScalar(this.speed);
    }
}

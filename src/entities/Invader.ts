import {
    ArrowHelper,
    MathUtils,
    Object3D,
    Quaternion,
    Vector3,
} from 'three';
import * as THREE from 'three';
import type {
    AttackPatternId,
    EntrySide,
    InvaderMode,
    InvaderTypeId,
    InvaderWeaponType,
} from '../config/types/types';
import type { IPathPattern, IEntryConfig, IFormationSlot, IInvaderInitConfig, IInvaderWeaponOverride, IWeaponLaunch, ICollisionMover, ICollisionTarget } from '../config/interfaces/interfaces';
import { ENTRY, COLLISION, INVADER_WEAPONS, INVADER_WEAPON_TYPES } from '../config/data/constants';
import type { FormationController } from '../systems/FormationController';
import { createWeaponTrigger, type WeaponTrigger } from '../systems/weapons/WeaponTriggers';
import { Entity } from './Entity';
import { CollisionLayer } from '../config/types/types';
import type { CollisionModelSet } from '../systems/collision/CollisionModel';

// Put these outside the class or as static/private readonly
const tempMatrix = new THREE.Matrix4();
const tempScale = new THREE.Vector3(1, 1, 1);
// Zero-scale matrix used to hide a released instance.
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Combat invader: enter along a Bezier, then hold a live formation slot.
 * Dive / fire / hit are stubs until later phases.
 *
 * Orientation model (Phase 8):
 * - baseQuat = voxel upright rest (rotateX π/2), used in formation
 * - flight: Three lookAt aims local -Z along path tangent (world up)
 * - bank: roll about local +Z (mesh forward after lookAt) from yaw rate
 * - displayQuat = flightWithBank * baseQuat  during entry
 * - dock: slerp displayQuat -> baseQuat
 */
export class Invader extends Entity implements ICollisionTarget, ICollisionMover {
    public typeId: InvaderTypeId = 'scout';
    public poolAssetKey?: string | null = null;
    public scoreValue = 50;
    public mode: InvaderMode = 'inactive';
    public slot: IFormationSlot = { col: 0, row: 0 };
    public side: EntrySide = 'left';

    public readonly collisionLayer = CollisionLayer.INVADER;
    /** Baked footprints of this invader's model; assigned when the invader is acquired. */
    public collisionModels: CollisionModelSet | null = null;
    /** As a mover (invader ramming the player), the invader is approximated by a circle of this radius. */
    public readonly collisionRadius = COLLISION.invaderRadius;
    /** Position at the start of the last update; the collision sweep runs previousPosition -> position. */
    public readonly previousPosition = new Vector3();

    // Instanced mesh identifiers for rendering.
    public instanceId: number = -1;
    public assetKey: string = 'invader1';
    private instancedMesh: THREE.InstancedMesh | null = null;

    private formation: FormationController | null = null;
    private pathPattern: IPathPattern | null = null;
    private pathDuration: number = ENTRY.pathDuration;
    private pathT = 0;
    private lastSegmentIndex = -1;

    private bankGain: number = ENTRY.bankGain;
    private maxBankRad: number = ENTRY.maxBankRad;
    private orientSmooth: number = ENTRY.orientSmooth;
    private dockSmooth: number = ENTRY.dockSmooth;

    /** Model rest pose (voxel upright fix). */
    private readonly baseQuat = new Quaternion();
    /** Current display orientation written in syncTransform. */
    private readonly displayQuat = new Quaternion();
    private readonly flightQuat = new Quaternion();
    private readonly bankQuat = new Quaternion();
    private readonly spinQuat = new Quaternion();
    private readonly inverseLookQuat = new Quaternion();
    private readonly spinAxisScratch = new Vector3();

    private readonly targetFlightQuat = new Quaternion();

    private readonly homeScratch = new Vector3();
    private readonly tangentScratch = new Vector3();
    private readonly localForward = new Vector3(0, 0, 1);
    private readonly lookDummy = new Object3D();
    private readonly worldUp = new Vector3(0, 1, 0);
    private readonly prevUp = new Vector3(0, 1, 0);
    private rightScratch: Vector3 = new Vector3();
    private isDoingHalfLoop = false;   // or drive it from the path pattern

    private prevForwardX = 0;
    private prevForwardZ = 1;
    private hasPrevForward = false;
    private roll = 0;
    private spinAngle = 0;

    private debugArrow: ArrowHelper | null = null;

    private _attackOffset: Vector3 = new Vector3(0, 0, 0);

    /** One release trigger per weapon type; each tracks what this invader has done during the current attack. */
    private readonly weaponTriggers = new Map<InvaderWeaponType, WeaponTrigger>(
        INVADER_WEAPON_TYPES.map((type) => [type, createWeaponTrigger(INVADER_WEAPONS[type])]),
    );

    /** 0..1: how far the invader's heading is turned from its path direction toward aimPoint (weapons that aim at the player). */
    private aimWeight = 0;
    private readonly aimPoint = new Vector3();
    private readonly aimFrom = new Vector3();
    private readonly aimTo = new Vector3();
    private readonly aimQuat = new Quaternion();
    private readonly aimBlendQuat = new Quaternion();
    private readonly facingScratch = new Vector3();

    constructor() {
        super(null);                       // no private mesh any more
        this.integrateVelocity = false;

        // Rest pose (voxel upright)
        this.baseQuat.identity();          // or set whatever default rotation you need
        // If you previously needed a rotateX(Math.PI / 2), do it here instead:
        //this.baseQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

        this.displayQuat.copy(this.baseQuat);
    }

    public init(cfg: IInvaderInitConfig): void {
        this.typeId = cfg.typeId ?? 'scout';
        this.scoreValue = cfg.scoreValue ?? 50;
        this.slot = { ...cfg.slot };
        this.side = cfg.side;
        this.formation = cfg.formation;
        this.pathPattern = cfg.pattern ?? null;
        this.pathDuration = Math.max(0.05, cfg.pathDuration ?? ENTRY.pathDuration);
        this.pathT = 0;
        this.poolAssetKey = cfg.poolAssetKey ?? null;

        const entry = cfg.entry;
        this.bankGain = entry?.bankGain ?? ENTRY.bankGain;
        this.maxBankRad = entry?.maxBankRad ?? ENTRY.maxBankRad;
        this.orientSmooth = entry?.orientSmooth ?? ENTRY.orientSmooth;
        this.dockSmooth = entry?.dockSmooth ?? ENTRY.dockSmooth;

        this.velocity.set(0, 0, 0);
        this.position.copy(cfg.spawn);
        this.previousPosition.copy(cfg.spawn);
        this.mode = 'entering';
        this.active = true;
        this.resetWeaponState();
        this.roll = 0;
        this.spinAngle = 0;
        this.hasPrevForward = false;
        this.flightQuat.identity();
        this.prevUp.set(0, 1, 0);
        //     this.object3d.visible = true;
        // }

        this.displayQuat.copy(this.baseQuat);
        // const wantArrow = entry?.debugForwardArrow ?? ENTRY.debugForwardArrow;
        // this.setupDebugArrow(wantArrow);
        this.syncTransform();
    }

    public setInstancedMesh(mesh: THREE.InstancedMesh): void {
        this.instancedMesh = mesh;
    }

    public startPattern(cfg: { pattern: IPathPattern; formation: FormationController; entry: Partial<Pick<IEntryConfig, 'bankGain' | 'maxBankRad' | 'orientSmooth' | 'dockSmooth' | 'debugForwardArrow'>>; attackOffset?: Vector3 }): void {
        // Implementation for initialising the invader's pattern.
        const entry = cfg.entry;
        this.bankGain = entry?.bankGain ?? ENTRY.bankGain;
        this.maxBankRad = entry?.maxBankRad ?? ENTRY.maxBankRad;
        this.orientSmooth = entry?.orientSmooth ?? ENTRY.orientSmooth;
        this.dockSmooth = entry?.dockSmooth ?? ENTRY.dockSmooth;
        this.formation = cfg.formation;
        this.pathPattern = cfg.pattern ?? null;
        this.pathDuration = Math.max(0.05, this.pathPattern?.duration ?? ENTRY.pathDuration);
        this.mode = 'diving';
        this.pathT = 0;
        this.spinAngle = 0;
        this.resetWeaponState();
        if (cfg.attackOffset) this._attackOffset.copy(cfg.attackOffset);
        else this._attackOffset.set(0, 0, 0);
    }

    /** Id of the pattern being flown (undefined when it has none). */
    public get patternId(): AttackPatternId | undefined {
        return this.pathPattern?.id;
    }

    /** Index of the path segment being flown, or -1 when the pattern has no segments. */
    public get segmentIndex(): number {
        return this.pathPattern?.getSegmentIndex?.(this.pathT) ?? -1;
    }

    /** Progress (0..1) through the segment being flown. */
    public get segmentProgress(): number {
        return this.pathPattern?.getSegmentProgress?.(this.pathT) ?? 0;
    }

    /** Unit vector of the direction of travel this frame (falls back to the model's facing when not moving). */
    public getHeading(out: Vector3): Vector3 {
        out.subVectors(this.position, this.previousPosition);
        if (out.lengthSq() < 1e-10) out.set(0, 0, 1).applyQuaternion(this.displayQuat);
        return out.normalize();
    }

    /** Angle (radians) between where the model is facing and the direction to the point. */
    public facingAngleTo(point: Vector3): number {
        const facing = this.facingScratch.set(0, 0, 1).applyQuaternion(this.displayQuat);
        const toPoint = this.aimTo.subVectors(point, this.position).normalize();
        return facing.angleTo(toPoint);
    }

    /**
     * Turns the invader's heading from its path direction toward a point by `weight` (0..1).
     * A null point keeps the previous one, so the turn can be eased back after the player has gone.
     */
    public setAim(weight: number, point: Vector3 | null): void {
        this.aimWeight = weight;
        if (point) this.aimPoint.copy(point);
    }

    public clearAim(): void {
        this.aimWeight = 0;
    }

    /**
     * Asks the trigger of this weapon type whether the weapon should be released now (filling `out` if so).
     * `target` is the player's position, or null while the player is not in play; `playerPresent` is false when
     * there is no player at all (the demo).
     */
    public pollWeaponRelease(
        type: InvaderWeaponType,
        dt: number,
        target: Vector3 | null,
        out: IWeaponLaunch,
        playerPresent: boolean,
        override?: IInvaderWeaponOverride,
    ): boolean {
        const trigger = this.weaponTriggers.get(type);
        if (!trigger) return false;
        trigger.setTuning(override);
        return trigger.poll(this, dt, target, out, playerPresent);
    }

    /** The weapon of this type that pollWeaponRelease() asked for has been spawned. */
    public commitWeaponRelease(type: InvaderWeaponType): void {
        this.weaponTriggers.get(type)?.commit();
    }

    private resetWeaponState(): void {
        for (const trigger of this.weaponTriggers.values()) trigger.reset();
        this.clearAim();
        this.lastSegmentIndex = this.segmentIndex;
    }

    /** Lets the weapon triggers re-arm when the pattern moves on to its next segment. */
    private notifySegmentChange(): void {
        const index = this.segmentIndex;
        if (index === this.lastSegmentIndex) return;
        this.lastSegmentIndex = index;
        for (const trigger of this.weaponTriggers.values()) trigger.onSegmentChanged();
    }

    public get attackOffset(): Vector3 {
        return this._attackOffset;
    }

    public set attackOffset(value: Vector3) {
        this._attackOffset.copy(value);
    }

    /**
     * Re-arm for another entry without reallocating the mesh (pool-friendly).
     */
    public reset(cfg: IInvaderInitConfig): void {
        this.init(cfg);
    }

    public override update(dt: number): void {
        if (!this.active) return;
        this.previousPosition.copy(this.position);

        switch (this.mode) {
            case 'entering':
            case 'diving':
                this.updatePath(dt);
                break;
            case 'formation':
                this.updateFormation(dt);
                break;
            default:
                // diving / returning / dying — later phases
                break;
        }
        // this.normaliseSpinAngle();
        this.syncTransform();
        this.updateDebugArrow();
    }

    private updatePath(dt: number): void {
        const formation = this.formation;
        const pattern = this.pathPattern;
        let segmentSpecificSmoothing = 1;
        if (!formation || !pattern) return;

        // Live end point — formation root may be moving.
        formation.getWorldHomeSlot(this.slot, this.homeScratch);

        if (this.pathDuration > 0) {
            this.pathT += dt / this.pathDuration;
        } else {
            this.pathT = 1;
        }

        if (this.pathT >= 1) {
            this.pathT = 1;
            this.position.copy(this.homeScratch);
            this.mode = 'formation';
            this.resetWeaponState();
            this.roll = 0;
            this.hasPrevForward = false;
            // Keep current flight orientation; formation slerps to rest.
            return;
        }

        this.notifySegmentChange();

        if (pattern) {
            pattern.samplePosition(this.pathT, this.position);
            pattern.sampleTangent(this.pathT, this.tangentScratch);
            segmentSpecificSmoothing = pattern.sampleOrientationSmoothing(this.pathT) ?? 1;
        }
        this.position.add(this._attackOffset);

        if (this.tangentScratch.lengthSq() < 1e-8) {
            this.tangentScratch.subVectors(this.homeScratch, this.position);
        }
        if (this.aimWeight > 0) this.blendHeadingTowardAimPoint(this.tangentScratch);

        this.applyFlightOrientation(this.tangentScratch, segmentSpecificSmoothing, dt);
    }

    /** Rotates the path heading toward the aim point by aimWeight (the path itself, i.e. position, is unaffected). */
    private blendHeadingTowardAimPoint(forward: Vector3): void {
        const from = this.aimFrom.copy(forward).normalize();
        const to = this.aimTo.subVectors(this.aimPoint, this.position);
        if (to.lengthSq() < 1e-8) return;
        this.aimQuat.setFromUnitVectors(from, to.normalize());
        this.aimBlendQuat.identity().slerp(this.aimQuat, this.aimWeight);
        forward.copy(from).applyQuaternion(this.aimBlendQuat);
    }

    private updateFormation(dt: number): void {
        const formation = this.formation;
        if (!formation) return;

        formation.getWorldHomeSlot(this.slot, this.homeScratch);
        this.position.copy(this.homeScratch);
        this.velocity.set(0, 0, 0);

        // Smooth dock: slerp flight pose -> formation rest (baseQuat).
        const alpha = 1 - Math.exp(-this.dockSmooth * dt);
        this.displayQuat.slerp(this.baseQuat, alpha);
        if (this.displayQuat.angleTo(this.baseQuat) < 0.01) {
            this.displayQuat.copy(this.baseQuat);
        }
    }

    private applyFlightOrientation(forwardIn: Vector3, segmentSpecificSmoothing: number, dt: number): void {
        const forward = this.tangentScratch.copy(forwardIn);
        if (forward.lengthSq() < 1e-10) {
            return;
        }
        forward.normalize();

        // ------------------------------------------------------------------
        // 1. Decide whether inversion is currently allowed
        // ------------------------------------------------------------------
        // Drive this however you like: a flag, a path-pattern method, etc.
        const allowInversion = this.pathPattern?.allowInversion?.(this.pathT) ?? this.isDoingHalfLoop ?? false;

        // ------------------------------------------------------------------
        // 2. Build the base “look-at” orientation
        // ------------------------------------------------------------------
        this.lookDummy.position.set(0, 0, 0);

        if (allowInversion) {
            // Free mode – do NOT force world-up so the ship can stay inverted.
            // Use the previous up vector as a continuous reference.
            this.lookDummy.up.copy(this.prevUp);
            this.lookDummy.lookAt(forward.x, forward.y, forward.z);

            // Re-orthogonalise so up stays perpendicular to forward
            const right = this.rightScratch
                .crossVectors(forward, this.lookDummy.up)
                .normalize();
            this.lookDummy.up.crossVectors(right, forward).normalize();
        } else {
            // Normal upright mode (your original behaviour)
            if (Math.abs(forward.dot(this.worldUp)) > 0.98) {
                forward.x += 0.05;
                forward.normalize();
            }
            this.lookDummy.up.copy(this.worldUp);
            this.lookDummy.lookAt(forward.x, forward.y, forward.z);
        }

        // Remember the up we just used for the next frame
        this.prevUp.copy(this.lookDummy.up);

        this.targetFlightQuat.copy(this.lookDummy.quaternion);

        // ------------------------------------------------------------------
        // 3. Banking (yaw-rate based) – suppressed while inverted
        // ------------------------------------------------------------------
        const fx = forward.x;
        const fz = forward.z;
        const horizLen = Math.hypot(fx, fz);
        let targetRoll = 0;
        // First oriented frame of a path: snap to the path direction instead of turning from the rest pose.
        const isFirstFrame = !this.hasPrevForward;

        if (!allowInversion && this.hasPrevForward && dt > 1e-6 && horizLen > 1e-5) {
            const inv = 1 / horizLen;
            const nx = fx * inv;
            const nz = fz * inv;
            const cross = this.prevForwardX * nz - this.prevForwardZ * nx;
            const dot = this.prevForwardX * nx + this.prevForwardZ * nz;
            const yawDelta = Math.atan2(cross, dot);
            const yawRate = yawDelta / dt;

            targetRoll = MathUtils.clamp(
                -yawRate * this.bankGain,
                -this.maxBankRad,
                this.maxBankRad,
            );
            this.prevForwardX = nx;
            this.prevForwardZ = nz;
        } else if (horizLen > 1e-5) {
            this.prevForwardX = fx / horizLen;
            this.prevForwardZ = fz / horizLen;
        }
        this.hasPrevForward = true;

        const smooth = segmentSpecificSmoothing * (1 - Math.exp(-this.orientSmooth * dt));
        this.roll += (targetRoll - this.roll) * smooth;

        // ------------------------------------------------------------------
        // 4. Controlled spin (this is what actually performs the half-loop roll)
        // ------------------------------------------------------------------
        if (this.pathPattern) {
            const spinRate = this.pathPattern.sampleSpinRate(this.pathT);
            this.spinAngle += spinRate * dt;
        }

        // if (this.pathPattern) {
        //     const targetSpin = this.pathPattern.sampleTargetSpin(this.pathT);
        //     // Smoothly approach the target instead of integrating a rate
        //     const spinSmooth = 1 - Math.exp(-0.5 * dt); // or reuse orientSmooth
        //     this.spinAngle += (targetSpin - this.spinAngle) * spinSmooth;
        // }

        // Spin around the path tangent
        const localTangentAxis = this.spinAxisScratch
            .copy(forward)
            .applyQuaternion(this.inverseLookQuat.copy(this.lookDummy.quaternion).invert());
        this.spinQuat.setFromAxisAngle(localTangentAxis, this.spinAngle);

        this.targetFlightQuat.multiply(this.spinQuat);

        // Apply bank
        this.bankQuat.setFromAxisAngle(this.localForward, this.roll);
        this.targetFlightQuat.multiply(this.bankQuat);

        // ------------------------------------------------------------------
        // 5. Smooth and apply
        // ------------------------------------------------------------------
        if (isFirstFrame) {
            this.flightQuat.copy(this.targetFlightQuat);
        } else {
            this.flightQuat.slerp(this.targetFlightQuat, smooth);
        }
        this.displayQuat.copy(this.flightQuat).multiply(this.baseQuat);
    }

    public override syncTransform(): void {
        if (this.instanceId < 0 || !this.instancedMesh) return;
        tempMatrix.compose(this.position, this.displayQuat, tempScale);
        this.instancedMesh.setMatrixAt(this.instanceId, tempMatrix);
    }

    /** Stub — combat later. */
    public fire(): boolean {
        return false;
    }

    public isEntering(): boolean {
        return this.mode === 'entering';
    }

    public isInFormation(): boolean {
        return this.mode === 'formation';
    }

    /** Alive and on the field (not yet dying or released to the pool). */
    public get collisionEnabled(): boolean {
        return this.active && (this.mode === 'entering' || this.mode === 'formation' || this.mode === 'diving');
    }

    /** Net rotation about the local Z (travel) axis: the bank and spin twist of the display orientation. */
    public getCollisionRoll(): number {
        return 2 * Math.atan2(this.displayQuat.z, this.displayQuat.w);
    }

    /** Current display orientation (read-only use; it is the quaternion the instance is drawn with). */
    public get orientation(): Quaternion {
        return this.displayQuat;
    }

    public override dispose(): void {
        this.clearDebugArrow();
        this.active = false;
        this.mode = 'inactive';
        this.formation = null;

        // Hide the instance
        if (this.instanceId >= 0 && this.instancedMesh) {
            this.instancedMesh.setMatrixAt(this.instanceId, hiddenMatrix);
            this.instancedMesh.instanceMatrix.needsUpdate = true;
            this.instanceId = -1;
        }
    }

    // private setupDebugArrow(enabled: boolean): void {
    //     this.clearDebugArrow();
    //     if (!enabled || !this.object3d || debugArrowClaimed) return;

    //     debugArrowClaimed = true;
    //     this.debugArrow = new ArrowHelper(
    //         new Vector3(0, 0, 1),
    //         new Vector3(0, 0, 0),
    //         6,
    //         0xff3344,
    //         1.5,
    //         1,
    //     );
    //     this.debugArrow.name = 'InvaderDebugForward';
    //     this.object3d.add(this.debugArrow);
    // }

    private updateDebugArrow(): void {
        if (!this.debugArrow) return;
        // Local +Z helper for mesh-axis verification (toggle ENTRY.debugForwardArrow).
        this.debugArrow.setDirection(this.localForward);
    }

    private clearDebugArrow(): void {
        if (!this.debugArrow) return;
        this.debugArrow.removeFromParent();
        this.debugArrow.dispose();
        this.debugArrow = null;
    }
}

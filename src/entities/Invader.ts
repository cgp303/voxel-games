import {
    ArrowHelper,
    MathUtils,
    Object3D,
    Quaternion,
    Vector3,
    type Object3D as Object3DType,
} from 'three';
import * as THREE from 'three';
import type {
    EntrySide,
    InvaderMode,
    InvaderTypeId,
} from '../config/types/types';
import type { IPathPattern, IEntryConfig, IFormationSlot, IInvaderInitConfig, ICubicBezierControls } from '../config/interfaces/interfaces';
import { ENTRY } from '../config/data/constants';
import type { FormationController } from '../systems/FormationController';
import { Entity } from './Entity';



/** Shared flag so only one debug arrow exists across invaders. */
let debugArrowClaimed = false;

// Put these outside the class or as static/private readonly
const tempMatrix = new THREE.Matrix4();
const tempScale = new THREE.Vector3(1, 1, 1);

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
export class Invader extends Entity {
    public typeId: InvaderTypeId = 'grunt';
    public poolAssetKey?: string | null = null;
    public scoreValue = 50;
    public mode: InvaderMode = 'inactive';
    public slot: IFormationSlot = { col: 0, row: 0 };
    public side: EntrySide = 'left';

    // Instanced mesh identifiers for rendering.
    public instanceId: number = -1;
    public assetKey: string = 'invader1';
    private instancedMesh: THREE.InstancedMesh | null = null;

    private formation: FormationController | null = null;
    private controls: ICubicBezierControls | null = null;
    private pathPattern: IPathPattern | null = null;
    private pathDuration: number = ENTRY.pathDuration;
    private pathT = 0;

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

    private readonly targetFlightQuat = new Quaternion();

    private readonly homeScratch = new Vector3();
    private readonly tangentScratch = new Vector3();
    private readonly localForward = new Vector3(0, 0, 1);
    private readonly lookDummy = new Object3D();
    private readonly worldUp = new Vector3(0, 1, 0);
    private prevUp: Vector3 = new Vector3(0, 1, 0);
    private rightScratch: Vector3 = new Vector3();
    private isDoingHalfLoop = false;   // or drive it from the path pattern

    private prevForwardX = 0;
    private prevForwardZ = 1;
    private hasPrevForward = false;
    private roll = 0;
    private spinAngle = 0;

    private debugArrow: ArrowHelper | null = null;

    private _attackOffset: Vector3 = new Vector3(0, 0, 0);

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
        this.typeId = cfg.typeId ?? 'grunt';
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
        this.mode = 'entering';
        this.active = true;
        this.roll = 0;
        this.hasPrevForward = false;

        // if (this.object3d) {
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
        this.attackOffset = cfg.attackOffset ?? new Vector3(0, 0, 0);
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
            this.roll = 0;
            this.hasPrevForward = false;
            // Keep current flight orientation; formation slerps to rest.
            return;
        }

        if (pattern) {
            pattern.samplePosition(this.pathT, this.position);
            pattern.sampleTangent(this.pathT, this.tangentScratch);
            segmentSpecificSmoothing = pattern.sampleOrientationSmoothing(this.pathT) ?? 1;
        }
        this.position.add(this._attackOffset);

        if (this.tangentScratch.lengthSq() < 1e-8) {
            this.tangentScratch.subVectors(this.homeScratch, this.position);
        }

        this.applyFlightOrientation(this.tangentScratch, segmentSpecificSmoothing, dt);
    }

    private normaliseSpinAngle(): void {
        // keep spinAngle [0, 2π)
        this.spinAngle = ((this.spinAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

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
            if (!this.prevUp) {
                this.prevUp = new Vector3(0, 1, 0); // first-time fallback
            }
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
        if (!this.prevUp) this.prevUp = new Vector3();
        this.prevUp.copy(this.lookDummy.up);

        this.targetFlightQuat.copy(this.lookDummy.quaternion);

        // ------------------------------------------------------------------
        // 3. Banking (yaw-rate based) – suppressed while inverted
        // ------------------------------------------------------------------
        const fx = forward.x;
        const fz = forward.z;
        const horizLen = Math.hypot(fx, fz);
        let targetRoll = 0;

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
        const localTangentAxis = forward
            .clone()
            .applyQuaternion(this.lookDummy.quaternion.clone().invert());
        this.spinQuat.setFromAxisAngle(localTangentAxis, this.spinAngle);

        this.targetFlightQuat.multiply(this.spinQuat);

        // Apply bank
        this.bankQuat.setFromAxisAngle(this.localForward, this.roll);
        this.targetFlightQuat.multiply(this.bankQuat);

        // ------------------------------------------------------------------
        // 5. Smooth and apply
        // ------------------------------------------------------------------
        this.flightQuat.slerp(this.targetFlightQuat, smooth);
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

    /**
     * Stub — returns kill + score payload shape for later EventBus wiring.
     */
    public hit(damage = 1): { killed: boolean; score: number } {
        void damage;
        if (this.mode === 'dying' || !this.active) {
            return { killed: false, score: 0 };
        }
        this.mode = 'dying';
        this.active = false;
        return { killed: true, score: this.scoreValue };
    }

    public isEntering(): boolean {
        return this.mode === 'entering';
    }

    public isInFormation(): boolean {
        return this.mode === 'formation';
    }

    public override dispose(): void {
        this.clearDebugArrow();
        this.active = false;
        this.mode = 'inactive';
        this.formation = null;
        this.controls = null;

        // Hide the instance
        if (this.instanceId >= 0 && this.instancedMesh) {
            const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
            this.instancedMesh.setMatrixAt(this.instanceId, zeroMatrix);
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
        debugArrowClaimed = false;
    }
}

import {
    ArrowHelper,
    MathUtils,
    Object3D,
    Quaternion,
    Vector3,
    type Object3D as Object3DType,
} from 'three';
import type {
    EntryConfig,
    EntrySide,
    FormationSlot,
    InvaderMode,
    InvaderTypeId,
} from '../app/types';
import type { PathPattern } from '../systems/patterns/interfaces';
import { ENTRY } from '../data/constants';
import type { FormationController } from '../systems/FormationController';
import {
    sampleCubic,
    sampleCubicDerivative,
    setLiveHome,
    type CubicBezierControls,
} from '../systems/path/cubicBezier';
import { Entity } from './Entity';

export interface InvaderInitConfig {
    typeId?: InvaderTypeId;
    slot: FormationSlot;
    side: EntrySide;
    spawn: Vector3;
    formation: FormationController;
    /** Path duration seconds; defaults to ENTRY.pathDuration */
    pathDuration?: number;
    scoreValue?: number;
    /** Bank / smoothing overrides */
    entry?: Partial<
        Pick<
            EntryConfig,
            'bankGain' | 'maxBankRad' | 'orientSmooth' | 'dockSmooth' | 'debugForwardArrow'
        >
    >;
    pattern?: PathPattern;
}

/** Shared flag so only one debug arrow exists across invaders. */
let debugArrowClaimed = false;

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
    public scoreValue = 50;
    public mode: InvaderMode = 'inactive';
    public slot: FormationSlot = { col: 0, row: 0 };
    public side: EntrySide = 'left';

    private formation: FormationController | null = null;
    private controls: CubicBezierControls | null = null;
    private pathPattern: PathPattern | null = null;
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

    private prevForwardX = 0;
    private prevForwardZ = 1;
    private hasPrevForward = false;
    private roll = 0;
    private spinAngle = 0;

    private debugArrow: ArrowHelper | null = null;

    private _attackOffset: Vector3 = new Vector3(0, 0, 0);

    constructor(object3d: Object3DType) {
        super(object3d);
        this.integrateVelocity = false;

        // Rest pose: pitch model so MagicaVoxel Z-up sits upright in Y-up world.
        // Keep this on baseQuat only; flight multiplies on top.
        object3d.rotation.set(0, 0, 0);
        object3d.quaternion.identity();
        // object3d.rotateX(Math.PI / 2);
        this.baseQuat.copy(object3d.quaternion);
        this.displayQuat.copy(this.baseQuat);
    }

    public init(cfg: InvaderInitConfig): void {
        this.typeId = cfg.typeId ?? 'grunt';
        this.scoreValue = cfg.scoreValue ?? 50;
        this.slot = { ...cfg.slot };
        this.side = cfg.side;
        this.formation = cfg.formation;
        this.pathPattern = cfg.pattern ?? null;
        this.pathDuration = Math.max(0.05, cfg.pathDuration ?? ENTRY.pathDuration);
        this.pathT = 0;

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

        if (this.object3d) {
            this.object3d.visible = true;
        }

        this.displayQuat.copy(this.baseQuat);
        const wantArrow = entry?.debugForwardArrow ?? ENTRY.debugForwardArrow;
        this.setupDebugArrow(wantArrow);
        this.syncTransform();
    }

    public startPattern(cfg: { pattern: any; formation: any; entry: any; attackOffset?: Vector3 }): void {
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
    public reset(cfg: InvaderInitConfig): void {
        this.init(cfg);
    }

    public override update(dt: number): void {
        if (!this.active) return;

        switch (this.mode) {
            case 'entering':
            case 'diving':
                this.updateEntering(dt);
                break;
            case 'formation':
                this.updateFormation(dt);
                break;
            default:
                // diving / returning / dying — later phases
                break;
        }

        this.syncTransform();
        this.updateDebugArrow();
    }

    private updateEntering(dt: number): void {
        const formation = this.formation;
        const pattern = this.pathPattern;
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
        }
        this.position.add(this._attackOffset);

        if (this.tangentScratch.lengthSq() < 1e-8) {
            this.tangentScratch.subVectors(this.homeScratch, this.position);
        }

        this.applyFlightOrientation(this.tangentScratch, dt);
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

    private applyFlightOrientation(forwardIn: Vector3, dt: number): void {
        const forward = this.tangentScratch.copy(forwardIn);
        if (forward.lengthSq() < 1e-10) return;
        forward.normalize();

        // ---------- 1. Decide whether we are allowed to stay inverted ----------
        // You can drive this from the path pattern, a timer, or a boolean you set when the loop starts.
        const allowInversion = this.pathPattern?.allowInversion?.(this.pathT) ?? false;
        // or simply: const allowInversion = this.isDoingHalfLoop;

        // ---------- 2. Build the base orientation ----------
        this.lookDummy.position.set(0, 0, 0);

        if (allowInversion) {
            // Free mode: do NOT force worldUp.
            // Use the previous up (or a stable reference) so the ship can go inverted.
            // A simple and stable choice is to keep the previous up and only re-orthogonalise.
            this.lookDummy.up.copy(this.prevUp);           // you need to store prevUp
            this.lookDummy.lookAt(forward.x, forward.y, forward.z);

            // Re-orthonormalise so up stays perpendicular to forward
            const right = this.rightScratch.crossVectors(forward, this.lookDummy.up).normalize();
            this.lookDummy.up.crossVectors(right, forward).normalize();
        } else {
            // Normal mode – keep the old upright behaviour
            if (Math.abs(forward.dot(this.worldUp)) > 0.98) {
                forward.x += 0.05;
                forward.normalize();
            }
            this.lookDummy.up.copy(this.worldUp);
            this.lookDummy.lookAt(forward.x, forward.y, forward.z);
        }

        // Store the up we just used so the next frame has a continuous reference
        this.prevUp.copy(this.lookDummy.up);

        this.targetFlightQuat.copy(this.lookDummy.quaternion);

        // ---------- 3. Banking (optional – you can also suppress it during the loop) ----------
        let targetRoll = 0;
        // … keep your existing yaw-rate banking code here …
        // You may want to zero targetRoll while allowInversion is true:
        if (allowInversion) targetRoll = 0;

        const smooth = 1 - Math.exp(-this.orientSmooth * dt);
        this.roll += (targetRoll - this.roll) * smooth;

        // ---------- 4. Controlled spin (this is what will actually invert them) ----------
        if (this.pathPattern) {
            const spinRate = this.pathPattern.sampleSpinRate(this.pathT);
            this.spinAngle += spinRate * dt;
        }

        // Apply spin around the tangent
        const localTangentAxis = forward.clone()
            .applyQuaternion(this.lookDummy.quaternion.clone().invert());
        this.spinQuat.setFromAxisAngle(localTangentAxis, this.spinAngle);

        this.targetFlightQuat.multiply(this.spinQuat);

        // Apply bank
        this.bankQuat.setFromAxisAngle(this.localForward, this.roll);
        this.targetFlightQuat.multiply(this.bankQuat);

        // Smooth & apply
        this.flightQuat.slerp(this.targetFlightQuat, smooth);
        this.displayQuat.copy(this.flightQuat).multiply(this.baseQuat);
    }
    // /**
    //  * Face along path tangent; bank (roll about local Z) from horizontal turn rate.
    //  *
    //  * Three.js Object3D.lookAt aims the local -Z axis toward the target.
    //  * After lookAt, we bank about local +Z so the mesh rolls into the turn.
    //  */
    // private applyFlightOrientation(forwardIn: Vector3, dt: number): void {
    //     const forward = this.tangentScratch.copy(forwardIn);
    //     if (forward.lengthSq() < 1e-10) {
    //         return;
    //     }
    //     forward.normalize();

    //     // Avoid lookAt singularity when forward approx world up.
    //     if (Math.abs(forward.dot(this.worldUp)) > 0.98) {
    //         forward.x += 0.05;
    //         forward.normalize();
    //     }

    //     const fx = forward.x;
    //     const fz = forward.z;
    //     const horizLen = Math.hypot(fx, fz);
    //     let targetRoll = 0;
    //     if (this.hasPrevForward && dt > 1e-6 && horizLen > 1e-5) {
    //         const inv = 1 / horizLen;
    //         const nx = fx * inv;
    //         const nz = fz * inv;
    //         const cross = this.prevForwardX * nz - this.prevForwardZ * nx;
    //         const dot = this.prevForwardX * nx + this.prevForwardZ * nz;
    //         const yawDelta = Math.atan2(cross, dot);
    //         const yawRate = yawDelta / dt;
    //         // Bank into the turn.
    //         targetRoll = MathUtils.clamp(
    //             -yawRate * this.bankGain,
    //             -this.maxBankRad,
    //             this.maxBankRad,
    //         );
    //         this.prevForwardX = nx;
    //         this.prevForwardZ = nz;
    //     } else if (horizLen > 1e-5) {
    //         this.prevForwardX = fx / horizLen;
    //         this.prevForwardZ = fz / horizLen;
    //     }
    //     this.hasPrevForward = true;

    //     const smooth = 1 - Math.exp(-this.orientSmooth * dt);
    //     this.roll += (targetRoll - this.roll) * smooth;
    //     if (this.pathPattern) {
    //         const spinRate = this.pathPattern.sampleSpinRate(this.pathT);
    //         this.spinAngle += spinRate * dt;
    //     }

    //     // Path face: lookAt puts local -Z along +forward.
    //     this.lookDummy.position.set(0, 0, 0);
    //     this.lookDummy.up.copy(this.worldUp);
    //     this.lookDummy.lookAt(forward.x, forward.y, forward.z);
    //     this.targetFlightQuat.copy(this.lookDummy.quaternion);

    //     // tangent axis in world space
    //     const tangentAxis = forward.clone();

    //     // convert tangent axis into local space AFTER lookAt
    //     const localTangentAxis = tangentAxis.applyQuaternion(this.lookDummy.quaternion.clone().invert());

    //     // spin around local tangent axis
    //     this.spinQuat.setFromAxisAngle(localTangentAxis, this.spinAngle);

    //     this.targetFlightQuat.copy(this.lookDummy.quaternion);

    //     // spin first
    //     this.targetFlightQuat.multiply(this.spinQuat);

    //     // Bank about local Z after path face (mesh-local Z roll).
    //     this.bankQuat.setFromAxisAngle(this.localForward, this.roll);
    //     this.targetFlightQuat.multiply(this.bankQuat);

    //     // Smooth flight orientation, then apply model rest correction.
    //     this.flightQuat.slerp(this.targetFlightQuat, smooth);
    //     this.displayQuat.copy(this.flightQuat).multiply(this.baseQuat);
    // }

    public override syncTransform(): void {
        if (!this.object3d) return;
        this.object3d.position.copy(this.position);
        this.object3d.quaternion.copy(this.displayQuat);
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
        if (this.object3d) {
            this.object3d.removeFromParent();
            this.object3d.visible = false;
        }
    }

    private setupDebugArrow(enabled: boolean): void {
        this.clearDebugArrow();
        if (!enabled || !this.object3d || debugArrowClaimed) return;

        debugArrowClaimed = true;
        this.debugArrow = new ArrowHelper(
            new Vector3(0, 0, 1),
            new Vector3(0, 0, 0),
            6,
            0xff3344,
            1.5,
            1,
        );
        this.debugArrow.name = 'InvaderDebugForward';
        this.object3d.add(this.debugArrow);
    }

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

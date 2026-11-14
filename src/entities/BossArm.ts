import * as THREE from 'three';
import { BOSS_ARM, INVADER_MESH_MATERIAL, QUALITY } from '../config/data/constants';
import type { IBossArmDef, IBossArmFire, IBossArmModels, IBossArmMove, IParsedVoxModel, IPoint3 } from '../config/interfaces/interfaces';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { VoxelGeometry } from '../voxel/VoxelGeometry';
import { SplinePath, ease, pingPong, smoothing, whip } from '../systems/boss/armMath';

/** Played when the arm has nothing to do (the boss is entering, or the arm's phases are not running). */
const IDLE_MOVE: IBossArmMove = { stage: 'idle', seconds: [1, 1] };
/** Chase rate of the ripple's settings, so a change of move does not make the arm jump. */
const WAVE_BLEND_RATE = 4;
const TAU = Math.PI * 2;
/** Seconds a pendulum move takes to blend in from wherever the tip was when it began. */
const PENDULUM_ENTRY_SEC = 0.75;

/**
 * A tentacle-like arm hanging off a boss: a joint on the body, a chain of segments laid along a spline, and a
 * weapon at the tip. It lives in the boss's local space (centred on the boss, -z toward the player), as a child of
 * the boss's root, so it follows the boss and its roll.
 *
 * The tip chases a target set by the arm's current move; the control points between it and the mount trail
 * behind it, and a ripple runs along the arm. Segments are spread evenly along the curve.
 */
export class BossArm {
    public readonly def: IBossArmDef;
    public readonly object = new THREE.Group();

    private readonly jointMesh: THREE.Mesh;
    private readonly segmentMesh: THREE.InstancedMesh;
    private readonly weaponMesh: THREE.Mesh;
    // The joint and weapon have their own materials so they can flash alone.
    private readonly jointMaterial = INVADER_MESH_MATERIAL.clone();
    private readonly weaponMaterial = INVADER_MESH_MATERIAL.clone();
    private jointFlash = 0;
    private weaponFlash = 0;

    /** False once the arm has been cut loose (its weapon or its joint destroyed); it then no longer moves or collides. */
    public attached = true;
    public weaponHits: number;
    /** Set when the weapon has been shot off, so it is not set falling with the segments. */
    public weaponDestroyed = false;
    /** Local-space centres (x y z) of the colliders: one per segment, then the weapon. */
    public readonly colliderCentres: Float64Array;
    public readonly colliderRadii: Float64Array;
    /** Yaw (about Y) and scale of each piece, parallel to the colliders. */
    public readonly pieceYaw: Float64Array;
    public readonly pieceScale: Float64Array;
    public readonly weaponIndex: number;
    public readonly weaponModel: IParsedVoxModel;
    public readonly segmentModel: IParsedVoxModel;
    private readonly segmentRadius: number;
    private readonly weaponRadius: number;

    private readonly mount = new THREE.Vector3();
    private readonly restTip = new THREE.Vector3();
    private readonly tip = new THREE.Vector3();
    private readonly chainLength: number;
    private readonly reach: number;

    // Control points, x y z each: mount, trailing middle points, tip (before the ripple is added).
    private readonly base: Float64Array;
    private readonly controls: Float64Array;
    private readonly spline: SplinePath;
    private readonly position = new Float64Array(3);
    private readonly tangent = new Float64Array(3);

    private moveIndex = -1;
    private move: IBossArmMove = IDLE_MOVE;
    private moveElapsed = 0;
    private moveDuration = 1;
    private fireTimer = 0;
    private readonly moveStart = new THREE.Vector3();
    private readonly locked = new THREE.Vector3();
    private readonly target = new THREE.Vector3();

    private waveAmp = 0;
    private waveFreq = 0;
    private wavePhase = 0;

    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly scale = new THREE.Vector3();
    private readonly place = new THREE.Vector3();
    private readonly yAxis = new THREE.Vector3(0, 1, 0);

    constructor(def: IBossArmDef, models: IBossArmModels, bossSize: { width: number; height: number; depth: number }) {
        this.def = def;
        const { width, height, depth } = bossSize;
        this.mount.set(def.mount.x + 0.5 - width / 2, def.mount.y + 0.5 - height / 2, def.mount.z + 0.5 - depth / 2);

        const segmentWidth = models.segment.size.x;
        this.chainLength = def.segments * (def.spacing ?? BOSS_ARM.defaultSpacing) * segmentWidth;
        this.reach = this.chainLength * BOSS_ARM.maxReach;
        const outward = this.mount.x >= 0 ? 1 : -1;
        this.restTip.set(
            this.mount.x + outward * this.chainLength * BOSS_ARM.restOutward,
            this.mount.y,
            this.mount.z - this.chainLength * BOSS_ARM.restForward,
        );
        this.tip.copy(this.restTip);

        const count = BOSS_ARM.controlPoints;
        this.base = new Float64Array(count * 3);
        this.controls = new Float64Array(count * 3);
        this.spline = new SplinePath(count, BOSS_ARM.spanSamples);
        for (let k = 0; k < count; k++) this.lerpBase(k, k / (count - 1));

        this.object.name = `BossArm:${def.id}`;
        this.weaponModel = models.weapon;
        this.segmentModel = models.segment;
        this.weaponHits = def.weapon.hits;
        this.weaponIndex = def.segments;
        this.colliderCentres = new Float64Array((def.segments + 1) * 3);
        this.colliderRadii = new Float64Array(def.segments + 1);
        this.pieceYaw = new Float64Array(def.segments + 1);
        this.pieceScale = new Float64Array(def.segments + 1).fill(1);
        this.segmentRadius = (segmentWidth / 2) * BOSS_ARM.colliderScale;
        this.weaponRadius = (Math.max(models.weapon.size.x, models.weapon.size.z) / 2) * BOSS_ARM.colliderScale;

        this.jointMesh = this.createMesh(models.joint, this.jointMaterial);
        this.jointMesh.position.copy(this.mount);
        this.weaponMesh = this.createMesh(models.weapon, this.weaponMaterial);
        this.segmentMesh = new THREE.InstancedMesh(this.createGeometry(models.segment), INVADER_MESH_MATERIAL, def.segments);
        this.segmentMesh.frustumCulled = false;
        this.segmentMesh.castShadow = QUALITY.entityCastShadow;
        this.segmentMesh.receiveShadow = true;
        this.object.add(this.jointMesh, this.segmentMesh, this.weaponMesh);
        this.layout();
    }

    /**
     * Advances the arm. `active` is true while the boss is in one of the arm's phases (otherwise it idles);
     * `player` is the player's position in the boss's local space, or null when there is none to aim at.
     */
    public update(dt: number, active: boolean, player: IPoint3 | null): void {
        if (dt <= 0) return;
        this.updateFlash(dt);
        if (!this.attached) return;
        this.advanceMove(dt, active, player);
        this.updateTip(dt, player);
        this.updateWave(dt);
        this.updateControls(dt);
        this.layout();
    }

    /** Lights the joint briefly (it was hit). */
    public flashJoint(): void {
        this.jointFlash = BOSS_ARM.flashSec;
    }

    /** Applies a hit to the weapon at the tip; returns true when that destroys it. */
    public hitWeapon(power: number): boolean {
        this.weaponFlash = BOSS_ARM.flashSec;
        this.weaponHits -= power;
        return this.weaponHits <= 0;
    }

    /**
     * Cuts the arm loose: the segments and weapon leave it (the caller sets them falling) and it stops moving and
     * colliding. The joint stays on the body unless it was the thing destroyed.
     */
    public detach(hideJoint: boolean): void {
        this.attached = false;
        this.segmentMesh.visible = false;
        this.weaponMesh.visible = false;
        this.jointMesh.visible = !hideJoint;
    }

    /** Counts down the current move's fire rate; returns its fire settings when a shot is due, else null. */
    public pollFire(dt: number): IBossArmFire | null {
        const fire = this.move.fire;
        if (!fire || !this.attached) return null;
        this.fireTimer -= dt;
        if (this.fireTimer > 0) return null;
        this.fireTimer = fire.rate;
        return fire;
    }

    /** Which way the weapon faces (yaw about Y, as pieces are turned: its front is -z). */
    public get weaponYaw(): number {
        return this.pieceYaw[this.weaponIndex];
    }

    /** Where the weapon is, in the boss's local space. */
    public weaponLocal(out: THREE.Vector3): THREE.Vector3 {
        return out.set(this.weaponMesh.position.x, this.weaponMesh.position.y, this.weaponMesh.position.z);
    }

    private updateFlash(dt: number): void {
        this.jointFlash = Math.max(0, this.jointFlash - dt);
        this.weaponFlash = Math.max(0, this.weaponFlash - dt);
        this.jointMaterial.emissive.set(this.jointFlash > 0 ? BOSS_ARM.flashColor : 0x000000);
        this.weaponMaterial.emissive.set(this.weaponFlash > 0 ? BOSS_ARM.flashColor : 0x000000);
    }

    public dispose(): void {
        this.jointMesh.geometry.dispose();
        this.weaponMesh.geometry.dispose();
        this.segmentMesh.geometry.dispose();
        this.segmentMesh.dispose();
        this.jointMaterial.dispose();
        this.weaponMaterial.dispose();
        this.object.removeFromParent();
    }

    private advanceMove(dt: number, active: boolean, player: IPoint3 | null): void {
        const moves = this.def.moves;
        if (!active || moves.length === 0) {
            if (this.moveIndex !== -1 || this.move !== IDLE_MOVE) {
                this.moveIndex = -1;
                this.beginMove(IDLE_MOVE, player);
            }
            this.moveElapsed = 0;
            return;
        }
        if (this.moveIndex === -1) this.startMove(0, player);

        this.moveElapsed += dt;
        if (this.moveElapsed >= this.moveDuration) this.startMove(this.moveIndex + 1, player);
    }

    private startMove(index: number, player: IPoint3 | null): void {
        const moves = this.def.moves;
        this.moveIndex = index % moves.length;
        this.beginMove(moves[this.moveIndex], player);
    }

    private beginMove(move: IBossArmMove, player: IPoint3 | null): void {
        this.move = move;
        this.moveElapsed = 0;
        this.fireTimer = 0;
        const [min, max] = move.seconds;
        this.moveDuration = min + Math.random() * (max - min);
        this.moveStart.copy(this.tip);

        const offset = move.target?.offset;
        if (move.target?.mode === 'lockedPlayer' && player) {
            this.locked.set(player.x + (offset?.x ?? 0), player.y + (offset?.y ?? 0), player.z + (offset?.z ?? 0));
        } else {
            this.locked.copy(this.tip);
        }
    }

    /** Moves the tip toward this frame's target: along a timed curve for fixed targets that ask for one, else by chasing. */
    private updateTip(dt: number, player: IPoint3 | null): void {
        const move = this.move;
        const progress = Math.min(1, this.moveElapsed / this.moveDuration);
        const spec = move.target;
        const target = this.target;
        let timed = false;

        if (!spec) {
            // Nothing to aim at: idle and recover go home, other stages hold the pose.
            if (move.stage === 'idle' || move.stage === 'recover') target.copy(this.restTip);
            else target.copy(this.tip);
        } else if (spec.mode === 'local') {
            target.set(spec.pos!.x, spec.pos!.y, spec.pos!.z);
            timed = true;
        } else if (spec.mode === 'lockedPlayer') {
            target.copy(this.locked);
            timed = true;
        } else if (spec.mode === 'player') {
            if (player) {
                target.set(player.x + (spec.offset?.x ?? 0), player.y + (spec.offset?.y ?? 0), player.z + (spec.offset?.z ?? 0));
            } else {
                target.copy(this.tip);
            }
        } else if (spec.mode === 'pendulum') {
            const from = spec.from!;
            const to = spec.to!;
            // Cosine: 0 -> 1 -> 0 over the move, with zero speed at both ends.
            const k = 0.5 - 0.5 * Math.cos(progress * TAU);
            target.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k);
            // Fade out the offset from where the tip began, so entering the swing doesn't snap.
            const s = ease('inOut', this.moveElapsed / PENDULUM_ENTRY_SEC);
            this.tip.set(
                target.x + (this.moveStart.x - from.x) * (1 - s),
                target.y + (this.moveStart.y - from.y) * (1 - s),
                target.z + (this.moveStart.z - from.z) * (1 - s),
            );
            this.clampReach();
            return;
        } else {
            const from = spec.from!;
            const to = spec.to!;
            const k = ease(move.ease, spec.pingPong ? pingPong(progress) : progress);
            target.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k);
        }

        if (timed && (move.ease !== undefined || move.motion === 'whip')) {
            const k = move.motion === 'whip' ? whip(progress, move.overshoot ?? 0.1) : ease(move.ease, progress);
            this.tip.lerpVectors(this.moveStart, target, k);
        } else {
            this.tip.lerp(target, smoothing(move.follow ?? BOSS_ARM.defaultFollow, dt));
        }
        this.clampReach();
    }

    private clampReach(): void {
        const dx = this.tip.x - this.mount.x;
        const dy = this.tip.y - this.mount.y;
        const dz = this.tip.z - this.mount.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length > this.reach) {
            const k = this.reach / length;
            this.tip.set(this.mount.x + dx * k, this.mount.y + dy * k, this.mount.z + dz * k);
        }
    }

    private updateWave(dt: number): void {
        const wave = this.move.wave ?? BOSS_ARM.idleWave;
        const k = smoothing(WAVE_BLEND_RATE, dt);
        this.waveAmp += (wave.amp - this.waveAmp) * k;
        this.waveFreq += (wave.freq - this.waveFreq) * k;
        this.wavePhase += wave.speed * dt;
    }

    /** The middle points chase the line from mount to tip, so they trail behind the tip as it moves. */
    private updateControls(dt: number): void {
        const count = BOSS_ARM.controlPoints;
        const follow = (this.move.follow ?? BOSS_ARM.defaultFollow) * BOSS_ARM.midLag;
        const chase = smoothing(follow, dt);
        for (let k = 1; k < count - 1; k++) {
            const f = k / (count - 1);
            const i = k * 3;
            this.base[i] += (this.mount.x + (this.tip.x - this.mount.x) * f - this.base[i]) * chase;
            this.base[i + 1] += (this.mount.y + (this.tip.y - this.mount.y) * f - this.base[i + 1]) * chase;
            this.base[i + 2] += (this.mount.z + (this.tip.z - this.mount.z) * f - this.base[i + 2]) * chase;
        }
        this.base[0] = this.mount.x;
        this.base[1] = this.mount.y;
        this.base[2] = this.mount.z;
        const last = (count - 1) * 3;
        this.base[last] = this.tip.x;
        this.base[last + 1] = this.tip.y;
        this.base[last + 2] = this.tip.z;
    }

    /** Adds the ripple (sideways in the X/Z plane, growing toward the tip) and lays the segments along the curve. */
    private layout(): void {
        const count = BOSS_ARM.controlPoints;
        const dx = this.tip.x - this.mount.x;
        const dz = this.tip.z - this.mount.z;
        const length = Math.hypot(dx, dz) || 1;
        const sideX = -dz / length;
        const sideZ = dx / length;

        for (let k = 0; k < count; k++) {
            const f = k / (count - 1);
            const offset = k === 0 ? 0 : this.waveAmp * f * Math.sin(TAU * (this.waveFreq * f - this.wavePhase));
            this.controls[k * 3] = this.base[k * 3] + sideX * offset;
            this.controls[k * 3 + 1] = this.base[k * 3 + 1];
            this.controls[k * 3 + 2] = this.base[k * 3 + 2] + sideZ * offset;
        }
        this.spline.build(this.controls);

        const total = this.spline.totalLength;
        const n = this.def.segments;
        for (let i = 0; i < n; i++) {
            this.spline.sample(((i + 0.5) / n) * total, this.position, this.tangent, 0);
            const s = n > 1 ? 1 + (this.def.taper - 1) * (i / (n - 1)) : 1;
            this.compose(this.matrix, s);
            this.segmentMesh.setMatrixAt(i, this.matrix);
            this.colliderCentres.set(this.position, i * 3);
            this.colliderRadii[i] = this.segmentRadius * s;
            this.pieceScale[i] = s;
            this.pieceYaw[i] = Math.atan2(-this.tangent[0], -this.tangent[2]);
        }
        this.segmentMesh.instanceMatrix.needsUpdate = true;

        this.spline.sample(total, this.position, this.tangent, 0);
        this.weaponMesh.position.set(this.position[0], this.position[1], this.position[2]);
        this.weaponMesh.rotation.set(0, Math.atan2(-this.tangent[0], -this.tangent[2]), 0);
        this.colliderCentres.set(this.position, n * 3);
        this.colliderRadii[n] = this.weaponRadius;
        this.pieceYaw[n] = Math.atan2(-this.tangent[0], -this.tangent[2]);
    }

    /** Places a piece at the sampled position, turned about Y to face along the curve (its front is -z). */
    private compose(out: THREE.Matrix4, scale: number): void {
        this.place.set(this.position[0], this.position[1], this.position[2]);
        this.quaternion.setFromAxisAngle(this.yAxis, Math.atan2(-this.tangent[0], -this.tangent[2]));
        this.scale.setScalar(scale);
        out.compose(this.place, this.quaternion, this.scale);
    }

    private lerpBase(k: number, f: number): void {
        this.base[k * 3] = this.mount.x + (this.tip.x - this.mount.x) * f;
        this.base[k * 3 + 1] = this.mount.y + (this.tip.y - this.mount.y) * f;
        this.base[k * 3 + 2] = this.mount.z + (this.tip.z - this.mount.z) * f;
    }

    private createMesh(model: IParsedVoxModel, material: THREE.Material): THREE.Mesh {
        const mesh = new THREE.Mesh(this.createGeometry(model), material);
        mesh.castShadow = QUALITY.entityCastShadow;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        return mesh;
    }

    /** A mesh of the model centred on its own middle. */
    private createGeometry(model: IParsedVoxModel): THREE.BufferGeometry {
        return createModelGeometry(model);
    }
}

/** A mesh of a voxel model, centred on its own middle. */
export function createModelGeometry(model: IParsedVoxModel): THREE.BufferGeometry {
    const world = new VoxelWorld({ x: model.size.x, y: model.size.y, z: model.size.z });
    for (const v of model.voxels) world.setVoxel(v.x, v.y, v.z, v.colorIndex);
    return VoxelGeometry.generateGeometry(world, model.colors, true);
}

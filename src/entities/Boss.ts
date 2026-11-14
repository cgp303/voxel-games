import * as THREE from 'three';
import { BOSS, BOSS_ARM, BOSS_WEAPONS, COLLISION, INVADER_MESH_MATERIAL, PLAYER, QUALITY } from '../config/data/constants';
import type {
    IBossDefinition,
    IBossMountDef,
    IBossWeaponDef,
    ICollisionTarget,
    IPathPattern,
    IVoxel,
    IVoxelCloud,
    IBossLaunch,
    IBossArmHit,
    IArmPiece,
    IBossArmFire,
    IBossInit,
    IGameContext,
    IPoint3,
} from '../config/interfaces/interfaces';
import { CollisionLayer, type BossPhase, type BossCyclePhase, type BossWeaponType, type PooledWeaponKey, GameEvents } from '../config/types/types';
import { BossArm } from './BossArm';
import { sweptCircleHit } from '../systems/boss/armMath';
import { DestructibleCollisionModels } from '../systems/boss/DestructibleCollisionModels';
import { DestructibleVoxelModel, voxelsToCloud, type IBossDamage } from '../systems/boss/DestructibleVoxelModel';
import { VoxelGeometry } from '../voxel/VoxelGeometry';
import { Entity } from './Entity';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** Seconds a weapon waits after a phase begins before its first shot. */
const FIRST_SHOT_DELAY: readonly [number, number] = [0.4, 0.8];
/** Extra reach (world units) beyond a shot's radius when finding the part it struck: the mask is quantised to cells. */
const REACH_SLACK = 1;


interface IMount {
    /** Release point relative to the boss's centre. */
    local: THREE.Vector3;
    /** Indices of the parts that, once any is destroyed, put the mount out of action. */
    parts: number[];
}

interface IWeaponState {
    def: IBossWeaponDef;
    key: PooledWeaponKey;
    speed: number;
    mounts: IMount[];
    cooldown: number;
    /** Where the mounts take turns from (weapons that are not `sync`). */
    nextMount: number;
}

/**
 * A boss: one large, destructible, multi-weapon invader. It is its own mesh (rebuilt as parts are destroyed) rather
 * than an instance of a shared one, and its footprint for shots follows the damage, so shots go deeper as the
 * armour is shot away. Shooting through to the core kills it.
 *
 * It flies a looping path above the terrain. It never yaws (it always faces the player); its lean into sideways
 * movement is a roll about Z. Weapons are released from mounts on the model, only in the phases they list, and a
 * mount stops working once a part it depends on has been destroyed. It does not fire while entering.
 * Voxels in the model are in model space: x and z are the footprint (front is z = 0), y is height, and the
 * boss's position is the centre of the model.
 */
export class Boss extends Entity implements ICollisionTarget {
    public readonly collisionLayer = CollisionLayer.INVADER;
    public readonly definition: IBossDefinition;
    public readonly model: DestructibleVoxelModel;
    public readonly collisionModels: DestructibleCollisionModels;
    public phase: BossPhase = 'entering';
    /** Set once the core has been destroyed; the session then explodes what is left and removes the boss. */
    public defeated = false;

    /** Releases wanted this frame: the first `launchCount` entries. Cleared with clearLaunches(). */
    public readonly launches: IBossLaunch[] = [];
    public launchCount = 0;

    private readonly root = new THREE.Group();
    private readonly mesh: THREE.Mesh;
    private meshRevision = -1;
    private readonly palette: IBossInit['palette'];

    private readonly path: IPathPattern;
    private readonly hoverY: number;
    private patternT = 0;
    private entranceElapsed = 0;
    private readonly entranceFrom = new THREE.Vector3();
    private readonly entranceTo = new THREE.Vector3();

    private cycleIndex = 0;
    private phaseRemaining = 0;
    private readonly weapons: IWeaponState[];
    private readonly arms: BossArm[];
    /** Part index of each arm's joint, parallel to `arms`. */
    private readonly armJoints: number[] = [];
    private readonly armScratch = new THREE.Vector3();
    private readonly fireDir = new THREE.Vector3();
    private readonly muzzleOffset = new THREE.Vector3();
    private readonly armLazerKeys: Readonly<Record<string, PooledWeaponKey>>;
    private readonly shedPieces: IArmPiece[] = [];
    private readonly armInverse = new THREE.Quaternion();
    private readonly playerLocal = new THREE.Vector3();
    private hasPlayer = false;
    private readonly ctx: IGameContext;
    private mainLazerActive = false;

    private roll = 0;
    private readonly rollQuat = new THREE.Quaternion();
    private readonly previous = new THREE.Vector3();
    private dripTimer = 0;
    private readonly rim = { x: 0, y: 0, z: 0 };

    constructor(init: IBossInit) {
        super(null);
        this.ctx = init.ctx;
        this.integrateVelocity = false;
        const { definition } = init;
        this.definition = definition;
        this.palette = init.palette;
        this.path = init.path;
        this.hoverY = init.hoverY;

        this.model = new DestructibleVoxelModel(definition, init.voxels);
        this.collisionModels = new DestructibleCollisionModels(this.model, COLLISION.maskResolution);

        this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), INVADER_MESH_MATERIAL);
        this.mesh.name = `Boss:${definition.id}`;
        this.mesh.castShadow = QUALITY.entityCastShadow;
        this.mesh.receiveShadow = true;
        // The mesh is large and changes shape; it is always on screen when it matters.
        this.mesh.frustumCulled = false;
        // The model's own origin is a corner; centre it so the root is the centre of the model.
        this.mesh.position.set(-this.model.width / 2, -this.model.height / 2, -this.model.depth / 2);
        this.root.name = `BossRoot:${definition.id}`;
        this.root.add(this.mesh);
        this.syncMesh();

        this.weapons = definition.weapons.map((def) => this.createWeaponState(def, init.weaponKeys[def.id]));

        const bossSize = { width: this.model.width, height: this.model.height, depth: this.model.depth };
        this.armLazerKeys = init.armLazerKeys;
        this.arms = definition.arms.map((def) => {
            const models = init.armModels[def.id];
            if (!models) throw new Error(`Boss "${definition.id}": arm "${def.id}" has no models`);
            const arm = new BossArm(def, models, bossSize);
            this.root.add(arm.object);
            this.armJoints.push(this.model.indexOf(def.jointPart));
            return arm;
        });

        // Starts far back, at the same height as the path, and eases onto the path's start.
        this.path.samplePosition(0, this.entranceTo);
        this.entranceTo.y = this.hoverY;
        this.entranceFrom.set(this.entranceTo.x, this.hoverY, BOSS.entranceZ);
        this.position.copy(this.entranceFrom);
        this.previous.copy(this.position);
        this.syncTransform();
    }

    /** The scene object (add it to the scene; it follows the boss). */
    public get object(): THREE.Object3D {
        return this.root;
    }

    /** Current orientation (the roll about Z), as drawn. */
    public get orientation(): THREE.Quaternion {
        return this.rollQuat;
    }

    public get collisionEnabled(): boolean {
        return this.active && !this.defeated;
    }

    public getCollisionRoll(): number {
        return 0;
    }

    /**
     * Applies a hit that reached the boss at a point given relative to its centre. The part nearest the point takes
     * `power` hits; shots stop at the armour in front, so that is the part they struck. `radius` is the shot's
     * collision radius (the footprint was widened by it, so the point can be that far from a solid column).
     * Always returns a result; `part` is -1 only if nothing was close enough.
     */
    public takeHit(localX: number, localZ: number, power: number, radius: number): IBossDamage {
        const part = this.model.nearestPart(localX, localZ, radius + REACH_SLACK);
        const result = this.model.damage(part, power, this.definition.fx.chunks);
        if (result.coreDestroyed) this.defeated = true;
        if (result.destroyed) this.syncMesh();
        this.armsReactToHit(result.part);
        return result;
    }

    /**
     * Sweeps a shot (from `previous` to `current` world position, with its radius) against the arms. Returns the
     * first collider struck, or null. Only the X/Z plane counts; Y only has to be within a tolerance.
     */
    public sweepShotAgainstArms(previous: IPoint3, current: IPoint3, radius: number): IBossArmHit | null {
        let bestT = Infinity;
        let best: IBossArmHit | null = null;
        for (const arm of this.arms) {
            if (!arm.attached) continue;
            for (let i = 0; i <= arm.weaponIndex; i++) {
                const c = this.armColliderWorld(arm, i);
                if (Math.abs(current.y - c.y) > BOSS_ARM.shotYTolerance) continue;
                const t = sweptCircleHit(previous.x, previous.z, current.x, current.z, c.x, c.z, arm.colliderRadii[i] + radius);
                if (t < 0 || t >= bestT) continue;
                bestT = t;
                best = { arm, collider: i, x: previous.x + (current.x - previous.x) * t, y: c.y, z: previous.z + (current.z - previous.z) * t };
            }
        }
        return best;
    }

    /** True when a circle at a world position touches any attached arm (used to kill the player on contact). */
    public touchesArm(worldX: number, worldY: number, worldZ: number, radius: number): boolean {
        if (!this.collisionEnabled) return false;
        for (const arm of this.arms) {
            if (!arm.attached) continue;
            for (let i = 0; i <= arm.weaponIndex; i++) {
                const c = this.armColliderWorld(arm, i);
                if (Math.abs(worldY - c.y) > BOSS_ARM.playerYTolerance) continue;
                const reach = arm.colliderRadii[i] + radius;
                const dx = worldX - c.x;
                const dz = worldZ - c.z;
                if (dx * dx + dz * dz <= reach * reach) return true;
            }
        }
        return false;
    }

    /** Applies a hit to an arm's weapon. Returns true when it is destroyed (the segments are then cut loose). */
    public hitArmWeapon(arm: BossArm, power: number): boolean {
        if (!arm.hitWeapon(power)) return false;
        arm.weaponDestroyed = true;
        this.shedArm(arm, false);
        return true;
    }

    /** Cuts every attached arm loose (the boss is dying). */
    public shedAllArms(): void {
        for (const arm of this.arms) this.shedArm(arm, false);
    }

    /** Pieces cut loose since the last call; the caller owns them from here. */
    public takeShedPieces(): IArmPiece[] {
        return this.shedPieces.splice(0, this.shedPieces.length);
    }

    /**
     * Turns an attached arm's segments (and weapon, unless it was shot off) into pieces in world space. They start
     * falling in sequence, from the joint when it was the joint that broke, otherwise from the tip.
     */
    private shedArm(arm: BossArm, fromJoint: boolean): void {
        if (!arm.attached) return;
        const last = arm.weaponIndex;
        const yaw = new THREE.Quaternion();
        for (let i = 0; i <= last; i++) {
            if (i === last && arm.weaponDestroyed) continue;
            const c = arm.colliderCentres;
            const position = new THREE.Vector3(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]).applyQuaternion(this.rollQuat).add(this.position);
            yaw.setFromAxisAngle(Y_AXIS, arm.pieceYaw[i]);
            this.shedPieces.push({
                model: i === last ? arm.weaponModel : arm.segmentModel,
                position,
                quaternion: this.rollQuat.clone().multiply(yaw),
                scale: arm.pieceScale[i],
                radius: arm.colliderRadii[i] * BOSS_ARM.fallRadiusScale,
                delay: (fromJoint ? i : last - i) * BOSS_ARM.fallStagger,
                score: arm.def.debrisScore,
            });
        }
        arm.detach(fromJoint);
    }

    /** The weapon of an arm as a debris cloud, and its world position (for the explosion when it is destroyed). */
    public armWeaponCloud(arm: BossArm, outPosition: THREE.Vector3): IVoxelCloud {
        arm.weaponLocal(outPosition).applyQuaternion(this.rollQuat).add(this.position);
        const { voxels, size } = arm.weaponModel;
        return voxelsToCloud(voxels, arm.weaponModel.colors, size);
    }

    /** World position of one of an arm's colliders (a shared scratch vector: read it before the next call). */
    private armColliderWorld(arm: BossArm, index: number): THREE.Vector3 {
        const c = arm.colliderCentres;
        return this.armScratch.set(c[index * 3], c[index * 3 + 1], c[index * 3 + 2]).applyQuaternion(this.rollQuat).add(this.position);
    }

    /** A hit part that is an arm's joint lights it; a destroyed one cuts the arm loose. */
    private armsReactToHit(part: number): void {
        for (let i = 0; i < this.arms.length; i++) {
            if (!this.arms[i].attached || this.armJoints[i] !== part) continue;
            if (this.model.parts[part].alive) this.arms[i].flashJoint();
            else this.shedArm(this.arms[i], true);
        }
    }

    /** True when a circle at a world position touches the boss's living columns (used to kill the player on contact). */
    public touchesCircle(worldX: number, worldZ: number, radius: number): boolean {
        if (!this.collisionEnabled) return false;
        return this.collisionModels.overlapsCircle(worldX - this.position.x, worldZ - this.position.z, radius);
    }

    public override update(dt: number): void {
        if (!this.active || dt <= 0) return;
        this.previous.copy(this.position);

        if (this.phase === 'entering') {
            this.updateEntrance(dt);
        } else {
            this.updatePath(dt);
            this.updateCycle(dt);
            this.updateWeapons(dt);
        }
        this.updateRoll(dt);
        this.updateArms(dt);
        this.velocity.subVectors(this.position, this.previous).divideScalar(dt);
        this.syncTransform();
    }

    /** Voxels of this boss as debris offsets (relative to its centre, in the palette's true colours). */
    public toCloud(voxels: readonly IVoxel[]): IVoxelCloud {
        return voxelsToCloud(voxels, this.palette, { x: this.model.width, y: this.model.height, z: this.model.depth });
    }

    public override syncTransform(): void {
        this.root.position.copy(this.position);
        this.root.quaternion.copy(this.rollQuat);
    }

    public clearLaunches(): void {
        this.launchCount = 0;
    }



    /**
     * Where fire should drip from this frame (world position), once the boss has holes in it: the rate rises with
     * the damage. Returns false when nothing should drip.
     */
    public pollDrip(dt: number, out: THREE.Vector3): boolean {
        if (!this.definition.fx.drip || this.defeated) return false;
        const damage = this.model.damageFraction;
        if (damage <= 0) return false;

        this.dripTimer -= dt;
        if (this.dripTimer > 0) return false;
        const [slow, fast] = BOSS.dripIntervalSec;
        this.dripTimer = slow + (fast - slow) * Math.min(1, damage * 2);

        if (!this.model.randomRimPoint(Math.random, this.rim)) return false;
        out.set(this.rim.x, this.rim.y - this.model.height / 2, this.rim.z).applyQuaternion(this.rollQuat).add(this.position);
        return true;
    }

    /** Tells the arms where the player is (world position), or null when there is no player to aim at. */
    public trackPlayer(world: IPoint3 | null): void {
        this.hasPlayer = world !== null;
        if (world) {
            // To the boss's local space: relative to its centre, undoing the roll.
            this.playerLocal.set(world.x - this.position.x, world.y - this.position.y, world.z - this.position.z);
            this.playerLocal.applyQuaternion(this.rollQuat.clone().invert());
        }
    }

    public override dispose(): void {
        super.dispose();
        for (const arm of this.arms) arm.dispose();
        this.root.removeFromParent();
        this.mesh.geometry.dispose();
    }

    private updateArms(dt: number): void {
        for (const arm of this.arms) {
            const active = this.phase !== 'entering' && arm.def.phases.includes(this.phase as BossCyclePhase);
            arm.update(dt, active, this.hasPlayer ? this.playerLocal : null);
            const fire = arm.pollFire(dt);
            if (fire) this.queueArmLaunch(arm, fire);
        }
    }

    /** Queues a shot from the tip of an arm, aimed by the move's fire mode (flat on the X/Z plane). */
    private queueArmLaunch(arm: BossArm, fire: IBossArmFire): void {
        const key = this.armLazerKeys[arm.def.id];
        if (!key) return;

        const tip = arm.weaponLocal(this.armScratch);
        const dir = this.fireDir;
        switch (fire.mode) {
            case 'random': {
                const a = (Math.random() * 2 - 1) * THREE.MathUtils.degToRad(fire.coneDeg ?? BOSS_ARM.defaultConeDeg);
                dir.set(Math.sin(a), 0, -Math.cos(a));
                break;
            }
            case 'aim':
                if (this.hasPlayer) dir.set(this.playerLocal.x - tip.x, 0, this.playerLocal.z - tip.z);
                else dir.set(0, 0, -1);
                break;
            case 'tip':
                dir.set(-Math.sin(arm.weaponYaw), 0, -Math.cos(arm.weaponYaw));
                break;
            default:
                dir.set(0, 0, -1);
        }
        // Aimed and tip shots are in the boss's local space (rolled with it); the others are already world-aligned.
        if (fire.mode === 'aim' || fire.mode === 'tip') dir.applyQuaternion(this.rollQuat);
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
        dir.normalize();

        let launch = this.launches[this.launchCount];
        if (!launch) {
            launch = { key, weapon: arm.def.weapon.type, origin: new THREE.Vector3(), velocity: new THREE.Vector3(), orientation: new THREE.Quaternion() };
            this.launches[this.launchCount] = launch;
        }
        this.launchCount++;
        launch.key = key;
        launch.weapon = arm.def.weapon.type;
        launch.origin.copy(tip);
        const muzzle = arm.def.weapon.muzzle;
        if (muzzle) {
            // Turned with the weapon, so the offset stays on the same part of it as it swings.
            this.muzzleOffset.set(muzzle.x, muzzle.y, muzzle.z).applyAxisAngle(Y_AXIS, arm.weaponYaw);
            launch.origin.add(this.muzzleOffset);
        }
        launch.origin.applyQuaternion(this.rollQuat).add(this.position);
        launch.velocity.copy(dir).multiplyScalar(arm.def.weapon.speed ?? BOSS_WEAPONS[arm.def.weapon.type].defaultSpeed);
        // The shot model's long axis is z (front -z), so it is turned to face where it is going.
        launch.orientation.setFromAxisAngle(Y_AXIS, Math.atan2(-dir.x, -dir.z));
    }

    private updateEntrance(dt: number): void {
        this.entranceElapsed += dt;
        const k = Math.min(1, this.entranceElapsed / BOSS.entranceSeconds);
        const eased = k * k * (3 - 2 * k);
        this.position.lerpVectors(this.entranceFrom, this.entranceTo, eased);
        if (k >= 1) {
            this.patternT = 0;
            this.beginStep(0);
        }
    }

    private updatePath(dt: number): void {
        this.patternT = (this.patternT + dt / this.path.duration) % 1;
        this.path.samplePosition(this.patternT, this.position);
        this.position.y = this.hoverY;
    }

    private updateCycle(dt: number): void {
        this.phaseRemaining -= dt;
        if (this.phaseRemaining <= 0) this.beginStep(this.cycleIndex + 1);
    }

    private beginStep(index: number): void {
        const cycle = this.definition.cycle;
        this.cycleIndex = index % cycle.length;
        const step = cycle[this.cycleIndex];
        this.phase = step.phase;
        this.phaseRemaining = step.seconds[0] + Math.random() * (step.seconds[1] - step.seconds[0]);
        for (const weapon of this.weapons) {
            weapon.cooldown = FIRST_SHOT_DELAY[0] + Math.random() * (FIRST_SHOT_DELAY[1] - FIRST_SHOT_DELAY[0]);
        }

        if (this.phase === 'rest') {
            this.mainLazerActive = false;
            this.ctx?.events.emit(GameEvents.boss1LazerOff);
        }
    }

    /** Leans into sideways movement like the player's ship; the boss never yaws, so this is its only turn. */
    private updateRoll(dt: number): void {
        const move = this.definition.movement;
        const sidewaysSpeed = (this.position.x - this.previous.x) / dt;
        const target = THREE.MathUtils.clamp(sidewaysSpeed * PLAYER.screenRightSign * move.rollGain, -move.maxRollRad, move.maxRollRad);
        this.roll += (target - this.roll) * (1 - Math.exp(-BOSS.rollSmooth * dt));
        this.rollQuat.setFromAxisAngle(Z_AXIS, this.roll);
    }

    private updateWeapons(dt: number): void {
        for (const weapon of this.weapons) {
            if (!weapon.def.phases.includes(this.phase as 'attack' | 'rest')) continue;
            weapon.cooldown -= dt;
            if (weapon.cooldown > 0) continue;
            weapon.cooldown = weapon.def.rate;
            this.release(weapon);
        }
    }

    /** Queues a release from every working mount (in sync) or from the next working one (taking turns). */
    private release(weapon: IWeaponState): void {
        const count = weapon.mounts.length;
        if (weapon.def.sync) {
            for (const mount of weapon.mounts) {
                if (this.mountWorks(mount)) this.queueLaunch(weapon, mount);
            }
            return;
        }
        for (let n = 0; n < count; n++) {
            const index = (weapon.nextMount + n) % count;
            if (!this.mountWorks(weapon.mounts[index])) continue;
            weapon.nextMount = (index + 1) % count;
            this.queueLaunch(weapon, weapon.mounts[index]);
            return;
        }
    }

    private mountWorks(mount: IMount): boolean {
        return mount.parts.every((i) => this.model.parts[i].alive);
    }

    private queueLaunch(weapon: IWeaponState, mount: IMount): void {
        let launch = this.launches[this.launchCount];
        if (!launch) {
            launch = {
                key: weapon.key,
                weapon: weapon.def.weapon,
                origin: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                orientation: new THREE.Quaternion(),
            };
            this.launches[this.launchCount] = launch;
        }
        this.launchCount++;
        launch.key = weapon.key;
        launch.weapon = weapon.def.weapon;
        launch.origin.copy(mount.local).applyQuaternion(this.rollQuat).add(this.position);
        // Weapons leave straight toward the player (-Z); the roll only moves where they leave from.
        launch.velocity.set(0, 0, -weapon.speed);
        launch.orientation.identity();

        if (weapon.def.id === 'side' || weapon.def.id === 'main' && !this.mainLazerActive) {
            this.mainLazerActive = true;
            // Only emit the audio event if the game is in play mode
            this.ctx.game.mode == 'play' ? this.ctx?.events.emit(GameEvents.boss1LazerOn) : undefined;
        } else if (weapon.def.id === 'bomb') {
            // Only emit the audio event if the game is in play mode
            this.ctx.game.mode == 'play' ? this.ctx?.events.emit(GameEvents.boss1Bomb) : undefined;
        }
    }

    private createWeaponState(def: IBossWeaponDef, key: PooledWeaponKey | undefined): IWeaponState {
        if (!key) throw new Error(`Boss "${this.definition.id}": weapon "${def.id}" has no pool`);
        const { width, height, depth } = this.model;
        return {
            def,
            key,
            speed: def.speed ?? BOSS_WEAPONS[def.weapon].defaultSpeed,
            mounts: def.mounts.map((mount: IBossMountDef) => ({
                local: new THREE.Vector3(mount.muzzle.x + 0.5 - width / 2, mount.muzzle.y + 0.5 - height / 2, mount.muzzle.z + 0.5 - depth / 2),
                parts: mount.disabledBy.map((id) => {
                    const index = this.model.indexOf(id);
                    if (index < 0) throw new Error(`Boss "${this.definition.id}": mount of "${def.id}" depends on unknown part "${id}"`);
                    return index;
                }),
            })),
            cooldown: 0,
            nextMount: 0,
        };
    }

    /** Rebuilds the mesh from the voxels that are left. */
    private syncMesh(): void {
        if (this.meshRevision === this.model.revision) return;
        this.meshRevision = this.model.revision;
        const geometry = VoxelGeometry.generateGeometry(this.model.world, this.palette, false);
        this.mesh.geometry.dispose();
        this.mesh.geometry = geometry;
    }
}

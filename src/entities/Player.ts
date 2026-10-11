import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { Entity } from './Entity';
import { PLAYER } from '../config/data/constants';
import type { IPlayerBounds, ICollisionTarget } from '../config/interfaces/interfaces';
import { CollisionLayer } from '../config/types/types';
import type { CollisionModelSet } from '../systems/collision/CollisionModel';

const FORWARD_AXIS = new Vector3(0, 0, 1);
const tempMatrix = new Matrix4();
const tempScale = new Vector3(1, 1, 1);
// Zero-scale matrix used to hide the instance on dispose.
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);

/**
 * Player ship: one instance of the shared 'player' InstancedMesh.
 * Moves laterally and within a small depth band; velocity is smoothed and the
 * ship rolls (banks) into lateral movement. Input arrives as axes via setInput().
 */
export class Player extends Entity implements ICollisionTarget {
    public readonly collisionLayer = CollisionLayer.PLAYER;
    /** Baked footprints of the ship model; assigned by the session that spawns the player. */
    public collisionModels: CollisionModelSet | null = null;

    private readonly instancedMesh: InstancedMesh;
    private readonly instanceId = 0;
    private readonly bounds: IPlayerBounds;

    private inputX = 0;
    private inputZ = 0;
    private roll = 0;
    private readonly rollQuat = new Quaternion();
    private readonly spawnX: number;

    /** Seconds of respawn protection left; while > 0 the ship flashes, cannot fire and is not collidable. */
    private respawnRemaining = 0;
    private flashVisible = true;
    /** True between being destroyed and respawn(): hidden, ignores input, not collidable. */
    private downed = false;

    constructor(mesh: InstancedMesh, bounds: IPlayerBounds, spawnX = 0) {
        super(null);
        // update() integrates and clamps itself, so the base class must not integrate too.
        this.integrateVelocity = false;
        this.instancedMesh = mesh;
        this.bounds = bounds;
        this.spawnX = spawnX;

        mesh.count = 1;
        this.position.set(spawnX, bounds.y, PLAYER.spawnZ);
        this.syncTransform();
    }

    public get isRespawning(): boolean {
        return this.respawnRemaining > 0;
    }

    public get isDown(): boolean {
        return this.downed;
    }

    /** The ship may only fire when it is in play and not in its protected respawn period. */
    public get canFire(): boolean {
        return !this.downed && this.respawnRemaining <= 0;
    }

    /** Takes the ship out of play (hidden, no input, no collisions) until respawn() is called. */
    public down(): void {
        this.downed = true;
        this.respawnRemaining = 0;
        this.velocity.set(0, 0, 0);
        this.flashVisible = false;
        this.syncTransform();
    }

    /** Puts the ship back at its original position and starts the protected, flashing respawn period. */
    public respawn(): void {
        this.downed = false;
        this.position.set(this.spawnX, this.bounds.y, PLAYER.spawnZ);
        this.velocity.set(0, 0, 0);
        this.roll = 0;
        this.respawnRemaining = PLAYER.respawn.durationSec;
        this.updateFlash();
        this.syncTransform();
    }

    /** axisX: -1 (screen left) … 1 (screen right). axisZ: -1 (toward camera) … 1 (away). */
    public setInput(axisX: number, axisZ: number): void {
        this.inputX = axisX;
        this.inputZ = axisZ;
    }

    public override update(dt: number): void {
        if (!this.active || this.downed) return;

        if (this.respawnRemaining > 0) {
            this.respawnRemaining = Math.max(0, this.respawnRemaining - dt);
            this.updateFlash();
        }

        const accelAlpha = 1 - Math.exp(-PLAYER.accel * dt);
        const targetVx = this.inputX * PLAYER.maxSpeedX * PLAYER.screenRightSign;
        const targetVz = this.inputZ * PLAYER.maxSpeedZ;
        this.velocity.x += (targetVx - this.velocity.x) * accelAlpha;
        this.velocity.z += (targetVz - this.velocity.z) * accelAlpha;

        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        this.position.y = this.bounds.y;

        const b = this.bounds;
        if (this.position.x < b.minX) { this.position.x = b.minX; this.velocity.x = 0; }
        else if (this.position.x > b.maxX) { this.position.x = b.maxX; this.velocity.x = 0; }
        if (this.position.z < b.minZ) { this.position.z = b.minZ; this.velocity.z = 0; }
        else if (this.position.z > b.maxZ) { this.position.z = b.maxZ; this.velocity.z = 0; }

        // Bank from actual (smoothed, post-clamp) screen-space lateral speed: positive roll = lean right.
        const screenSpeedX = (this.velocity.x * PLAYER.screenRightSign) / PLAYER.maxSpeedX;
        const targetRoll = screenSpeedX * PLAYER.maxBankRad;
        this.roll += (targetRoll - this.roll) * (1 - Math.exp(-PLAYER.bankSmooth * dt));

        this.syncTransform();
    }

    public override syncTransform(): void {
        this.rollQuat.setFromAxisAngle(FORWARD_AXIS, this.roll);
        // The ship flashes by toggling its instance scale between 1 and 0.
        tempScale.setScalar(this.flashVisible ? 1 : 0);
        tempMatrix.compose(this.position, this.rollQuat, tempScale);
        this.instancedMesh.setMatrixAt(this.instanceId, tempMatrix);
    }

    public get collisionEnabled(): boolean {
        return this.active && !this.downed && this.respawnRemaining <= 0;
    }

    public getCollisionRoll(): number {
        return this.roll;
    }

    /** Current orientation (the banking roll about Z), as drawn. */
    public get orientation(): Quaternion {
        return this.rollQuat;
    }

    private updateFlash(): void {
        if (this.respawnRemaining <= 0) {
            this.flashVisible = true;
            return;
        }
        const elapsed = PLAYER.respawn.durationSec - this.respawnRemaining;
        this.flashVisible = Math.floor(elapsed / PLAYER.respawn.flashIntervalSec) % 2 === 0;
    }

    public override dispose(): void {
        super.dispose();
        this.instancedMesh.setMatrixAt(this.instanceId, hiddenMatrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.count = 0;
    }
}

import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { Entity } from './Entity';
import type { ICollisionMover, IInvaderWeaponBaseConfig } from '../config/interfaces/interfaces';
import { CollisionLayer, type CollisionLayerFlag, type InvaderWeaponType } from '../config/types/types';

const tempMatrix = new Matrix4();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const unitScale = new Vector3(1, 1, 1);
const zeroScale = new Vector3(0, 0, 0);

/**
 * Base for pooled invader weapons: the same instance slot in each of a set of shared InstancedMeshes
 * (index 0 is the intact model; subclasses may add damaged variants). Only the slot in the current mesh is visible.
 * Subclasses decide how the weapon moves (advance) and what it looks like (getDisplayRotation).
 * As a mover it can hit the player.
 */
export abstract class InvaderWeapon extends Entity implements ICollisionMover {
    public readonly type: InvaderWeaponType;
    public collisionLayer: CollisionLayerFlag = CollisionLayer.INVADER_WEAPON;
    public readonly collisionRadius: number;
    /** Position at the start of the last update; the collision sweep runs previousPosition -> position. */
    public readonly previousPosition = new Vector3();

    protected readonly meshes: readonly InstancedMesh[];
    protected readonly instanceId: number;
    /** Index into meshes of the model currently shown. */
    protected meshIndex = 0;
    /** Orientation given at launch. */
    protected readonly orientation = new Quaternion();
    private readonly despawnZ: number;

    constructor(
        type: InvaderWeaponType,
        config: IInvaderWeaponBaseConfig,
        meshes: readonly InstancedMesh[],
        instanceId: number,
        despawnZ: number,
    ) {
        super(null);
        // update() moves the weapon itself so it can swap the previous position first.
        this.integrateVelocity = false;
        this.type = type;
        this.collisionRadius = config.collisionRadius;
        this.meshes = meshes;
        this.instanceId = instanceId;
        this.despawnZ = despawnZ;
        this.active = false;
        // Fresh instance slots are identity matrices, so hide this slot in every mesh.
        for (const mesh of meshes) mesh.setMatrixAt(instanceId, hiddenMatrix);
    }

    /** Only live weapons can hit or be hit; idle ones are hidden in the pool. */
    public get collisionEnabled(): boolean {
        return this.active;
    }

    public launch(origin: Vector3, velocity: Vector3, orientation: Quaternion, layer: CollisionLayerFlag): void {
        this.position.copy(origin);
        this.previousPosition.copy(origin);
        this.velocity.copy(velocity);
        this.orientation.copy(orientation);
        this.collisionLayer = layer;
        this.onLaunch();
        this.active = true;
        this.syncTransform();
    }

    /** Hides the instance and takes it out of play; the pool recycles it on its next update. */
    public hide(): void {
        this.active = false;
        this.syncTransform();
        this.meshIndex = 0;
    }

    /** Advances the weapon. Returns false once it is out of play and can go back to the pool. */
    public override update(dt: number): boolean {
        if (!this.active) return false;

        this.previousPosition.copy(this.position);
        this.advance(dt);

        if (this.isOutOfPlay()) {
            this.hide();
            return false;
        }
        this.syncTransform();
        return true;
    }

    public override syncTransform(): void {
        tempMatrix.compose(this.position, this.getDisplayRotation(), this.active ? unitScale : zeroScale);
        this.meshes[this.meshIndex].setMatrixAt(this.instanceId, tempMatrix);
    }

    /** Resets subclass state at the start of every flight. */
    protected onLaunch(): void {}

    /** Per-frame movement; previousPosition has already been stored. */
    protected abstract advance(dt: number): void;

    /** Rotation the instance is drawn with. */
    protected getDisplayRotation(): Quaternion {
        return this.orientation;
    }

    /** True once the weapon has left the area where it matters and can be recycled. */
    protected isOutOfPlay(): boolean {
        return this.position.z < this.despawnZ;
    }

    /** Moves this weapon's instance from the current mesh to another one (the old slot is hidden, so it is free for reuse). */
    protected showMesh(index: number): void {
        if (index === this.meshIndex) return;
        this.meshes[this.meshIndex].setMatrixAt(this.instanceId, hiddenMatrix);
        this.meshIndex = index;
        this.syncTransform();
    }
}

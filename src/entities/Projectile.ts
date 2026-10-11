import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { Entity } from './Entity';
import type { IWeaponConfig, ICollisionMover } from '../config/interfaces/interfaces';
import type { ProjectileState } from '../config/types/types';
import type { CollisionLayerFlag } from '../config/types/types';

const Y_AXIS = new Vector3(0, 1, 0);
const tempMatrix = new Matrix4();
const tempScale = new Vector3();

/**
 * One pooled shot: an instance slot in a shared InstancedMesh.
 * Flies via updateMovement() (override for arcs, homing, etc.), then shrinks
 * to nothing once past the weapon's despawnZ.
 */
export class Projectile extends Entity implements ICollisionMover {
    public state: ProjectileState = 'Idle';

    /** Position at the start of the last update; the collision sweep runs previousPosition -> position. */
    public readonly previousPosition = new Vector3();
    public readonly collisionLayer: CollisionLayerFlag;
    public readonly collisionRadius: number;

    private readonly instancedMesh: InstancedMesh;
    private readonly instanceId: number;
    private readonly config: IWeaponConfig;
    private readonly modelRotation = new Quaternion();
    private scale = 0;
    private fadeElapsed = 0;

    constructor(mesh: InstancedMesh, instanceId: number, config: IWeaponConfig) {
        super(null);
        // Movement is handled by updateMovement(), so the base integration must stay off.
        this.integrateVelocity = false;
        this.instancedMesh = mesh;
        this.instanceId = instanceId;
        this.config = config;
        this.collisionLayer = config.collisionLayer;
        this.collisionRadius = config.collisionRadius;
        this.modelRotation.setFromAxisAngle(Y_AXIS, config.modelRotationY);
        this.active = false;
        this.syncTransform();
    }

    /** Only shots in flight can hit anything; fading and idle shots are inert. */
    public get collisionEnabled(): boolean {
        return this.state === 'Flying';
    }

    public launch(origin: Vector3, velocity: Vector3): void {
        this.position.copy(origin);
        this.previousPosition.copy(origin);
        this.velocity.copy(velocity);
        this.state = 'Flying';
        this.scale = 1;
        this.fadeElapsed = 0;
        this.active = true;
        this.syncTransform();
    }

    /** Hides the instance and marks it Idle. */
    public hide(): void {
        this.state = 'Idle';
        this.scale = 0;
        this.active = false;
        this.syncTransform();
    }

    /** Per-frame travel. Override in a subclass to change how this weapon moves. */
    public updateMovement(dt: number): void {
        this.position.addScaledVector(this.velocity, dt);
    }

    /** Advances the shot. Returns false once it is Idle and can go back to the pool. */
    public update(dt: number): boolean {
        if (this.state === 'Flying') {
            this.previousPosition.copy(this.position);
            this.updateMovement(dt);
            if (this.position.z >= this.config.despawnZ) {
                this.state = 'Fading';
                this.fadeElapsed = 0;
            }
        } else if (this.state === 'Fading') {
            this.fadeElapsed += dt;
            const duration = this.config.fadeDurationSec;
            const t = duration > 0 ? this.fadeElapsed / duration : 1;
            if (t >= 1) {
                this.hide();
                return false;
            }
            this.scale = 1 - t;
        }
        this.syncTransform();
        return this.state !== 'Idle';
    }

    public override syncTransform(): void {
        tempScale.setScalar(this.scale);
        tempMatrix.compose(this.position, this.modelRotation, tempScale);
        this.instancedMesh.setMatrixAt(this.instanceId, tempMatrix);
    }
}

import { Vector3 } from 'three';
import type { IWeaponConfig } from '../config/interfaces/interfaces';
import { GameEvents } from '../config/types/types';
import { AUDIO } from '../config/data/constants';
import type { EventBus } from '../core/EventBus';
import type { ProjectilePool } from '../systems/ProjectilePool';

const tempOrigin = new Vector3();
const tempVelocity = new Vector3();

/** Fires shots from a pool at the weapon's fire rate. Subclass to change launch behaviour. */
export class Weapon {
    private readonly pool: ProjectilePool;
    private readonly config: IWeaponConfig;
    private readonly events: EventBus;
    private cooldown = 0;

    constructor(pool: ProjectilePool, config: IWeaponConfig, events: EventBus) {
        this.pool = pool;
        this.config = config;
        this.events = events;
    }

    public update(dt: number): void {
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - dt);
        }
    }

    /** Fires one shot from origin if the fire interval has elapsed and a shot is free. */
    public tryFire(origin: Vector3): boolean {
        if (this.cooldown > 0) return false;

        const m = this.config.muzzleOffset;
        tempOrigin.set(origin.x + m.x, origin.y + m.y, origin.z + m.z);
        tempVelocity.set(0, 0, this.config.speed);

        if (!this.pool.spawn(tempOrigin, tempVelocity)) return false;
        this.cooldown = this.config.fireIntervalSec;
        this.events.emit(GameEvents.playerFiresLazer, undefined);
        return true;
    }
}

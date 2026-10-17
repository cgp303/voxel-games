import { Matrix4, Vector3 } from 'three';
import type { Invader } from '../../entities/Invader';
import type { AttackPatternId, InvaderWeaponType } from '../../config/types/types';
import { INVADER_WEAPONS } from '../../config/data/constants';
import type {
    IInvaderWeaponConfig,
    IInvaderWeaponOverrideBase,
    ILazerWeaponConfig,
    IMineWeaponConfig,
    IMineWeaponOverride,
    IWeaponLaunch,
    IWeaponOverrides,
    LazerAimConfig,
    PerAllowedSegment,
} from '../../config/interfaces/interfaces';

type InheritHeadingAim = Extract<LazerAimConfig, { mode: 'inheritHeading' }>;
type AtPlayerAim = Extract<LazerAimConfig, { mode: 'atPlayer' }>;

const ZERO = new Vector3(0, 0, 0);
const WORLD_UP = new Vector3(0, 1, 0);
const lookMatrix = new Matrix4();

const smoothstep = (x: number): number => x * x * (3 - 2 * x);

/**
 * Decides when one invader releases one type of weapon during an attack, and where it goes.
 * One trigger exists per invader per weapon type (created up front, so nothing is allocated while playing).
 * Usage: poll() every frame; when it returns true and the weapon was actually spawned, call commit().
 */
export abstract class WeaponTrigger {
    protected readonly config: IInvaderWeaponConfig;
    /**
     * The allowedSegments entry this attack's release started in: allowedSegments[patternId][segmentSlot].
     * Per-segment settings (chance, progress, speed) are read from the same slot of their own tables.
     */
    private patternId: AttackPatternId | null = null;
    private segmentSlot = -1;
    /** The current stage's replacements for this weapon's settings; set before every poll. */
    protected tuning: IInvaderWeaponOverrideBase | undefined;

    protected constructor(config: IInvaderWeaponConfig) {
        this.config = config;
    }

    public setTuning(tuning: IInvaderWeaponOverrideBase | undefined): void {
        this.tuning = tuning;
    }

    /** Forgets everything about the current attack (a new attack starts, or the invader docks). */
    public abstract reset(): void;

    /**
     * Advances the trigger by dt. Returns true when the weapon should be released now, with `out` filled in.
     * `target` is the player's position, or null while the player is not in play; `playerPresent` is false when
     * there is no player at all (the demo), as opposed to one who is just respawning.
     */
    public abstract poll(invader: Invader, dt: number, target: Vector3 | null, out: IWeaponLaunch, playerPresent: boolean): boolean;

    /** The weapon returned by the last successful poll() has been spawned. */
    public abstract commit(): void;

    /** The invader has moved on to a new segment of its path. Does nothing unless a trigger opts in to re-arming per segment. */
    public onSegmentChanged(): void { }

    /**
     * If the invader is the right type, diving, and in a pattern and segment this weapon is allowed in, remembers
     * that allowedSegments entry (see segmentSlot) and returns true.
     */
    protected enterAllowedSegment(invader: Invader): boolean {
        if (!invader.active || invader.mode !== 'diving') return false;
        if (!this.config.allowedInvaderTypes.includes(invader.typeId)) return false;
        const id = invader.patternId;
        const slot = id ? (this.config.allowedSegments[id]?.indexOf(invader.segmentIndex) ?? -1) : -1;
        if (!id || slot < 0) return false;
        this.patternId = id;
        this.segmentSlot = slot;
        return true;
    }

    protected forgetSegment(): void {
        this.patternId = null;
        this.segmentSlot = -1;
    }

    /**
     * The entry of a per-segment table that belongs to the remembered allowedSegments entry. A stage's override
     * table, when it covers the current pattern, wins over the config's table.
     */
    protected perSegment(table: PerAllowedSegment<number>, override?: PerAllowedSegment<number>): number {
        const id = this.patternId;
        if (!id) return 0;
        return override?.[id]?.[this.segmentSlot] ?? table[id]?.[this.segmentSlot] ?? 0;
    }

    /** Rolls the remembered segment's dropChancePerFrame (frame-rate independent: it is the chance per frame at 60 fps). */
    protected rollRelease(dt: number): boolean {
        const perFrame = this.perSegment(this.config.dropChancePerFrame, this.tuning?.dropChancePerFrame);
        const chance = 1 - Math.pow(1 - perFrame, dt * 60);
        return Math.random() < chance;
    }
}

/** Mines: a random chance per frame while eligible, a limited number per attack. */
export class RandomDropTrigger extends WeaponTrigger {
    private readonly mine: IMineWeaponConfig;
    private mineTuning: IMineWeaponOverride | undefined;
    private dropped = 0;

    constructor(mine: IMineWeaponConfig) {
        super(mine);
        this.mine = mine;
    }

    public override setTuning(tuning: IMineWeaponOverride | undefined): void {
        super.setTuning(tuning);
        this.mineTuning = tuning;
    }

    public reset(): void {
        this.dropped = 0;
        this.forgetSegment();
    }

    public poll(invader: Invader, dt: number, _target: Vector3 | null, out: IWeaponLaunch): boolean {
        const mine = this.mine;
        const maxPerAttack = this.mineTuning?.maxPerAttack ?? mine.maxPerAttack;
        if (this.dropped >= maxPerAttack || !this.enterAllowedSegment(invader)) return false;
        if (invader.position.x < mine.releaseXRange.min || invader.position.x > mine.releaseXRange.max) return false;
        if (!this.rollRelease(dt)) return false;

        out.origin.copy(invader.position);
        out.velocity.copy(mine.velocity);
        out.orientation.identity();
        return true;
    }

    public commit(): void {
        this.dropped++;
    }
}

/** Lazer A: a burst of shots, each leaving along the invader's heading with the invader's orientation. */
export class ScheduledBurstTrigger extends WeaponTrigger {
    private readonly lazer: ILazerWeaponConfig;
    private readonly aim: InheritHeadingAim;
    private fired = 0;
    private waitSec = 0;

    constructor(lazer: ILazerWeaponConfig, aim: InheritHeadingAim) {
        super(lazer);
        this.lazer = lazer;
        this.aim = aim;
    }

    public reset(): void {
        this.fired = 0;
        this.waitSec = 0;
        this.forgetSegment();
    }

    public poll(invader: Invader, dt: number, _target: Vector3 | null, out: IWeaponLaunch): boolean {
        if (this.fired >= this.aim.shots) return false;

        if (this.fired === 0) {
            if (!this.enterAllowedSegment(invader)) return false;
            if (invader.segmentProgress < this.perSegment(this.lazer.segmentProgress)) return false;
        } else {
            // Once the burst has started it carries on for as long as the invader is still diving,
            // using the settings of the segment it started in.
            this.waitSec -= dt;
            if (this.waitSec > 0 || !invader.active || invader.mode !== 'diving') return false;
        }
        if (!this.rollRelease(dt)) return false;
        out.origin.copy(invader.position);
        invader.getHeading(out.velocity).multiplyScalar(this.perSegment(this.lazer.speed));
        out.orientation.copy(invader.orientation);
        return true;
    }

    public commit(): void {
        this.fired++;
        this.waitSec = this.aim.intervalSec;
    }
}

type AimPhase = 'idle' | 'turnIn' | 'face' | 'hold' | 'turnOut' | 'done';

/**
 * Lazer B: the invader turns to face the player, releases one lazer along that line, holds the aim briefly and
 * turns back to its path heading. The turn is expressed as an aim weight (0 = path heading, 1 = facing the
 * player) that the invader blends into its orientation; this trigger only drives the weight over time.
 */
export class AimedShotTrigger extends WeaponTrigger {
    private readonly lazer: ILazerWeaponConfig;
    private readonly aim: AtPlayerAim;
    private readonly noPlayerTarget = new Vector3();
    private phase: AimPhase = 'idle';
    private elapsed = 0;
    /** Aim weight last given to the invader. */
    private weight = 0;
    /** Weight when the turn back started, so the turn back is continuous even if it began early. */
    private turnOutFrom = 1;
    /** A new segment began while a shot was still in progress: re-arm once its turn back has finished. */
    private rearmWhenDone = false;

    constructor(lazer: ILazerWeaponConfig, aim: AtPlayerAim) {
        super(lazer);
        this.lazer = lazer;
        this.aim = aim;
        this.noPlayerTarget.set(aim.noPlayerTarget.x, aim.noPlayerTarget.y, aim.noPlayerTarget.z);
    }

    public reset(): void {
        this.phase = 'idle';
        this.elapsed = 0;
        this.weight = 0;
        this.rearmWhenDone = false;
        this.forgetSegment();
    }

    /** One shot per allowed segment: re-arm on every new segment, without snapping an aim that is still turning. */
    public override onSegmentChanged(): void {
        if (this.phase === 'idle' || this.phase === 'done') {
            this.phase = 'idle';
            this.elapsed = 0;
            this.forgetSegment();
        } else {
            this.rearmWhenDone = true;
        }
    }

    public poll(invader: Invader, dt: number, playerTarget: Vector3 | null, out: IWeaponLaunch, playerPresent: boolean): boolean {
        const aim = this.aim;
        const target = playerPresent ? playerTarget : this.noPlayerTarget;

        if (this.phase === 'idle') {
            if (!target || !this.enterAllowedSegment(invader)) return false;
            if (invader.segmentProgress < this.perSegment(this.lazer.segmentProgress)) return false;
            // The roll decides when the invader starts turning toward the target.
            if (!this.rollRelease(dt)) return false;
            this.phase = 'turnIn';
            this.elapsed = 0;
        }

        switch (this.phase) {
            case 'turnIn':
                if (!target) return this.beginTurnOut(invader, dt);
                this.elapsed += dt;
                this.setWeight(invader, smoothstep(Math.min(1, this.elapsed / aim.turnInSec)), target);
                if (this.elapsed >= aim.turnInSec) {
                    this.phase = 'face';
                    this.elapsed = 0;
                }
                return false;

            // case 'face':
            //     if (!target) return this.beginTurnOut(invader, dt);
            //     this.setWeight(invader, 1, target);
            //     this.elapsed += dt;
            //     if (invader.facingAngleTo(target) <= aim.facingToleranceRad) {
            //         this.fillLaunch(invader, target, out);
            //         return true;
            //     }
            //     // Never got round to facing the player in time: give up without firing.
            //     if (this.elapsed >= aim.faceTimeoutSec) this.beginTurnOut(invader, 0);
            //     return false;

            case 'face':
                if (!target) return this.beginTurnOut(invader, dt);

                this.setWeight(invader, 1, target);
                this.elapsed += dt;

                const aligned =
                    invader.facingAngleTo(target) <= aim.facingToleranceRad;

                const timedOut =
                    this.elapsed >= aim.faceTimeoutSec;

                if (aligned || timedOut) {
                    this.fillLaunch(invader, target, out);
                    return true;
                }

                return false;

            case 'hold':
                this.elapsed += dt;
                this.setWeight(invader, 1, target);
                if (this.elapsed >= aim.holdSec) this.beginTurnOut(invader, 0);
                return false;

            case 'turnOut':
                return this.updateTurnOut(invader, dt);

            default:
                return false;
        }
    }

    public commit(): void {
        this.phase = 'hold';
        this.elapsed = 0;
    }

    private beginTurnOut(invader: Invader, dt: number): false {
        this.phase = 'turnOut';
        this.elapsed = 0;
        this.turnOutFrom = this.weight;
        return this.updateTurnOut(invader, dt);
    }

    private updateTurnOut(invader: Invader, dt: number): false {
        this.elapsed += dt;
        const x = Math.min(1, this.elapsed / this.aim.turnOutSec);
        this.setWeight(invader, this.turnOutFrom * (1 - smoothstep(x)), null);
        if (x >= 1) {
            invader.clearAim();
            this.phase = 'done';
            if (this.rearmWhenDone) {
                this.rearmWhenDone = false;
                this.onSegmentChanged();
            }
        }
        return false;
    }

    private setWeight(invader: Invader, weight: number, target: Vector3 | null): void {
        this.weight = weight;
        invader.setAim(weight, target);
    }

    /**
     * Horizontal: leaves at the player's height and travels along the ground-plane line from the invader to the
     * player (plus random yaw error within aim.aimNoiseRad), with the model's +Z pointing down that line.
     * No pitch and no Y velocity.
     */
    private fillLaunch(invader: Invader, target: Vector3, out: IWeaponLaunch): void {
        out.origin.set(invader.position.x, target.y, invader.position.z);
        const direction = out.velocity.set(target.x - invader.position.x, 0, target.z - invader.position.z);
        if (direction.lengthSq() < 1e-8) {
            invader.getHeading(direction);
            direction.y = 0;
        }
        if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
        direction.normalize();

        const noise = this.aim.aimNoiseRad;
        if (noise > 0) {
            const yaw = (Math.random() * 2 - 1) * noise;
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);
            direction.set(direction.x * cos + direction.z * sin, 0, direction.z * cos - direction.x * sin);
        }

        lookMatrix.lookAt(direction, ZERO, WORLD_UP);
        out.orientation.setFromRotationMatrix(lookMatrix);
        direction.multiplyScalar(this.perSegment(this.lazer.speed));
    }
}

/** Throws if a per-segment table does not line up with allowedSegments (a typo here would silently disable a weapon). */
function checkPerSegment(config: IInvaderWeaponConfig, name: string, table: PerAllowedSegment<number>): void {
    for (const [id, segments] of Object.entries(config.allowedSegments)) {
        const values = table[id as AttackPatternId];
        if (!values || values.length !== segments.length) {
            throw new Error(
                `Invader weapon "${config.assetKey}": ${name}.${id} needs ${segments.length} value(s), one per allowedSegments.${id} entry.`,
            );
        }
    }
}

/** Picks the trigger that matches how a weapon is released. */
export function createWeaponTrigger(config: IInvaderWeaponConfig): WeaponTrigger {
    checkPerSegment(config, 'dropChancePerFrame', config.dropChancePerFrame);
    if (config.kind === 'mine') return new RandomDropTrigger(config);

    checkPerSegment(config, 'speed', config.speed);
    checkPerSegment(config, 'segmentProgress', config.segmentProgress);
    const aim = config.aim;
    return aim.mode === 'atPlayer' ? new AimedShotTrigger(config, aim) : new ScheduledBurstTrigger(config, aim);
}

/** Throws if a stage's weapon overrides name a weapon or pattern that cannot use them, or have the wrong number of values. */
export function checkWeaponOverrides(overrides: IWeaponOverrides): void {
    for (const type of Object.keys(overrides) as InvaderWeaponType[]) {
        const config = INVADER_WEAPONS[type];
        const override = overrides[type];
        if (!config || !override) throw new Error(`Weapon override for unknown weapon "${type}".`);

        for (const [id, values] of Object.entries(override.dropChancePerFrame ?? {})) {
            const allowed = config.allowedSegments[id as AttackPatternId];
            if (!allowed || values.length !== allowed.length) {
                throw new Error(
                    `Weapon override ${type}.dropChancePerFrame.${id} needs ${allowed?.length ?? 0} value(s), one per allowedSegments.${id} entry.`,
                );
            }
        }
        const maxPerAttack = (override as IMineWeaponOverride).maxPerAttack;
        if (maxPerAttack !== undefined && (!Number.isInteger(maxPerAttack) || maxPerAttack < 0)) {
            throw new Error(`Weapon override ${type}.maxPerAttack must be a whole number of 0 or more.`);
        }
    }
}

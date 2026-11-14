import type {
    BossRect,
    IBossArmDef,
    IBossArmFire,
    IBossArmMove,
    IBossArmTarget,
    IBossArmWave,
    IBossCycleStep,
    IBossDefinition,
    IBossMountDef,
    IBossPartDef,
    IBossWeaponDef,
    IParsedVoxModel,
    IVector3Like,
} from '../../config/interfaces/interfaces';
import type {
    ArmEase,
    ArmFireMode,
    ArmMotion,
    ArmStage,
    ArmTargetMode,
    BossCyclePhase,
    BossPartRole,
    BossWeaponType,
} from '../../config/types/types';

const PHASES: readonly BossCyclePhase[] = ['attack', 'rest'];
const ROLES: readonly BossPartRole[] = ['core', 'anchor'];
const ARM_STAGES: readonly ArmStage[] = ['idle', 'track', 'windup', 'strike', 'sweep', 'recover'];
const ARM_TARGET_MODES: readonly ArmTargetMode[] = ['local', 'player', 'lockedPlayer', 'sweep', 'pendulum'];
const ARM_FIRE_MODES: readonly ArmFireMode[] = ['down', 'random', 'aim', 'tip'];
const ARM_MOTIONS: readonly ArmMotion[] = ['smooth', 'whip'];
const ARM_EASES: readonly ArmEase[] = ['in', 'out', 'inOut'];

type Json = Record<string, unknown>;

/**
 * Turns a model as MagicaVoxel saves it (z up) into the boss's model space: file z (height) becomes y and
 * file y becomes z, like the font. The front of the boss, the end nearest the player, is z = 0.
 */
export function toBossSpace(model: IParsedVoxModel): IParsedVoxModel {
    return {
        size: { x: model.size.x, y: model.size.z, z: model.size.y },
        voxels: model.voxels.map((v) => ({ x: v.x, y: v.z, z: v.y, colorIndex: v.colorIndex })),
        colors: model.colors,
    };
}

/**
 * Checks a boss's JSON and returns it typed. Throws an Error naming the id and the offending field, because a
 * typo here (a part id in a mount, a rectangle off the model) would otherwise only show up mid-fight.
 * `knownWeapons` are the weapon types the game has (the keys of BOSS_WEAPONS).
 */
export function parseBossDefinition(raw: unknown, knownWeapons: readonly string[]): IBossDefinition {
    const root = asObject(raw, 'boss definition', '?');
    const id = asString(root.id, 'id', '?');
    const fail = (field: string, message: string): never => {
        throw new Error(`Boss "${id}": ${field}: ${message}`);
    };
    const object = (value: unknown, field: string): Json => asObject(value, field, id);
    const array = (value: unknown, field: string): unknown[] => {
        if (!Array.isArray(value)) return fail(field, 'expected an array');
        return value;
    };
    const string = (value: unknown, field: string): string => asString(value, field, id);
    const number = (value: unknown, field: string, min = -Infinity): number => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return fail(field, 'expected a number');
        if (value < min) return fail(field, `must be at least ${min}`);
        return value;
    };
    const integer = (value: unknown, field: string, min: number): number => {
        const n = number(value, field, min);
        if (!Number.isInteger(n)) return fail(field, 'expected a whole number');
        return n;
    };
    const flag = (value: unknown, field: string): boolean => {
        if (value === undefined) return false;
        if (typeof value !== 'boolean') return fail(field, 'expected true or false');
        return value;
    };

    const sizeJson = object(root.size, 'size');
    const size = {
        x: integer(sizeJson.x, 'size.x', 1),
        y: integer(sizeJson.y, 'size.y', 1),
        z: integer(sizeJson.z, 'size.z', 1),
    };

    const hullJson = object(root.hull, 'hull');
    const tileJson = object(hullJson.tile, 'hull.tile');
    const hull = {
        tile: { w: integer(tileJson.w, 'hull.tile.w', 1), d: integer(tileJson.d, 'hull.tile.d', 1) },
        hits: number(hullJson.hits, 'hull.hits', Number.MIN_VALUE),
    };

    const partIds = new Set<string>();
    let cores = 0;
    let anchors = 0;
    const parts: IBossPartDef[] = array(root.parts, 'parts').map((value, i) => {
        const field = `parts[${i}]`;
        const part = object(value, field);
        const partId = string(part.id, `${field}.id`);
        if (partIds.has(partId)) fail(`${field}.id`, `duplicate part id "${partId}"`);
        partIds.add(partId);

        const rects = array(part.rects, `${field}.rects`).map((r, k): BossRect => {
            const rectField = `${field}.rects[${k}]`;
            const rect = array(r, rectField);
            if (rect.length !== 4) return fail(rectField, 'expected [x0, z0, x1, z1]');
            const [x0, z0, x1, z1] = rect.map((n, j) => integer(n, `${rectField}[${j}]`, 0));
            if (x0 > x1 || z0 > z1) fail(rectField, 'needs x0 <= x1 and z0 <= z1');
            if (x1 >= size.x || z1 >= size.z) fail(rectField, `lies outside the ${size.x} x ${size.z} model`);
            return [x0, z0, x1, z1];
        });
        if (rects.length === 0) fail(`${field}.rects`, 'a part needs at least one rectangle');

        let role: BossPartRole | undefined;
        if (part.role !== undefined) {
            if (!ROLES.includes(part.role as BossPartRole)) fail(`${field}.role`, `expected one of ${ROLES.join(', ')}`);
            role = part.role as BossPartRole;
            if (role === 'core') cores++;
            else anchors++;
        }
        return { id: partId, rects, hits: number(part.hits, `${field}.hits`, Number.MIN_VALUE), role };
    });
    if (parts.length === 0) fail('parts', 'a boss needs at least one part');
    if (cores !== 1) fail('parts', `exactly one part must have role "core" (found ${cores})`);
    if (anchors > 1) fail('parts', `at most one part may have role "anchor" (found ${anchors})`);
    checkRectsDoNotOverlap(parts, fail);

    const weaponIds = new Set<string>();
    const weapons: IBossWeaponDef[] = array(root.weapons, 'weapons').map((value, i) => {
        const field = `weapons[${i}]`;
        const weapon = object(value, field);
        const weaponId = string(weapon.id, `${field}.id`);
        if (weaponIds.has(weaponId)) fail(`${field}.id`, `duplicate weapon id "${weaponId}"`);
        weaponIds.add(weaponId);

        const type = string(weapon.weapon, `${field}.weapon`);
        if (!knownWeapons.includes(type)) fail(`${field}.weapon`, `unknown weapon "${type}" (known: ${knownWeapons.join(', ')})`);

        const phases = array(weapon.phases, `${field}.phases`).map((p, k) => {
            if (!PHASES.includes(p as BossCyclePhase)) fail(`${field}.phases[${k}]`, `expected one of ${PHASES.join(', ')}`);
            return p as BossCyclePhase;
        });
        if (phases.length === 0) fail(`${field}.phases`, 'give at least one phase');

        const mounts: IBossMountDef[] = array(weapon.mounts, `${field}.mounts`).map((m, k) => {
            const mountField = `${field}.mounts[${k}]`;
            const mount = object(m, mountField);
            const muzzleJson = object(mount.muzzle, `${mountField}.muzzle`);
            const muzzle = {
                x: number(muzzleJson.x, `${mountField}.muzzle.x`, 0),
                y: number(muzzleJson.y, `${mountField}.muzzle.y`, 0),
                z: number(muzzleJson.z, `${mountField}.muzzle.z`, 0),
            };
            if (muzzle.x >= size.x || muzzle.y >= size.y || muzzle.z >= size.z) {
                fail(`${mountField}.muzzle`, `lies outside the ${size.x} x ${size.y} x ${size.z} model`);
            }
            const disabledBy = array(mount.disabledBy ?? [], `${mountField}.disabledBy`).map((p, j) => {
                const partId = string(p, `${mountField}.disabledBy[${j}]`);
                if (!partIds.has(partId)) fail(`${mountField}.disabledBy[${j}]`, `unknown part "${partId}"`);
                return partId;
            });
            return { muzzle, disabledBy };
        });
        if (mounts.length === 0) fail(`${field}.mounts`, 'a weapon needs at least one mount');

        return {
            id: weaponId,
            weapon: type as BossWeaponType,
            asset: string(weapon.asset, `${field}.asset`),
            sync: flag(weapon.sync, `${field}.sync`),
            rate: number(weapon.rate, `${field}.rate`, Number.MIN_VALUE),
            speed: weapon.speed === undefined ? undefined : number(weapon.speed, `${field}.speed`, Number.MIN_VALUE),
            phases,
            mounts,
        };
    });

    const vector = (value: unknown, field: string): IVector3Like => {
        const v = object(value, field);
        return { x: number(v.x, `${field}.x`), y: number(v.y, `${field}.y`), z: number(v.z, `${field}.z`) };
    };
    const optionalVector = (value: unknown, field: string): IVector3Like | undefined =>
        value === undefined ? undefined : vector(value, field);
    const oneOf = <T extends string>(value: unknown, field: string, allowed: readonly T[]): T => {
        if (!allowed.includes(value as T)) return fail(field, `expected one of ${allowed.join(', ')}`);
        return value as T;
    };

    const armIds = new Set<string>();
    const armJoints = new Set<string>();
    const arms: IBossArmDef[] = (root.arms === undefined ? [] : array(root.arms, 'arms')).map((value, i) => {
        const field = `arms[${i}]`;
        const arm = object(value, field);
        const armId = string(arm.id, `${field}.id`);
        if (armIds.has(armId)) fail(`${field}.id`, `duplicate arm id "${armId}"`);
        armIds.add(armId);

        const jointPart = string(arm.jointPart, `${field}.jointPart`);
        if (!partIds.has(jointPart)) fail(`${field}.jointPart`, `unknown part "${jointPart}"`);
        if (armJoints.has(jointPart)) fail(`${field}.jointPart`, `part "${jointPart}" already holds another arm`);
        armJoints.add(jointPart);

        const assets = object(arm.assets, `${field}.assets`);
        const mount = vector(arm.mount, `${field}.mount`);
        if (mount.x < 0 || mount.y < 0 || mount.z < 0 || mount.x >= size.x || mount.y >= size.y || mount.z >= size.z) {
            fail(`${field}.mount`, `lies outside the ${size.x} x ${size.y} x ${size.z} model`);
        }

        const weaponJson = object(arm.weapon, `${field}.weapon`);
        const weaponType = string(weaponJson.type, `${field}.weapon.type`);
        if (!knownWeapons.includes(weaponType)) {
            fail(`${field}.weapon.type`, `unknown weapon "${weaponType}" (known: ${knownWeapons.join(', ')})`);
        }

        const moves: IBossArmMove[] = (arm.moves === undefined ? [] : array(arm.moves, `${field}.moves`)).map((m, k) => {
            const moveField = `${field}.moves[${k}]`;
            const move = object(m, moveField);
            const stage = oneOf(move.stage, `${moveField}.stage`, ARM_STAGES);

            let seconds: readonly [number, number];
            if (Array.isArray(move.seconds)) {
                if (move.seconds.length !== 2) return fail(`${moveField}.seconds`, 'expected a number or [min, max]');
                const min = number(move.seconds[0], `${moveField}.seconds[0]`, Number.MIN_VALUE);
                seconds = [min, number(move.seconds[1], `${moveField}.seconds[1]`, min)];
            } else {
                const s = number(move.seconds, `${moveField}.seconds`, Number.MIN_VALUE);
                seconds = [s, s];
            }

            let target: IBossArmTarget | undefined;
            if (move.target !== undefined) {
                const targetField = `${moveField}.target`;
                const t = object(move.target, targetField);
                const mode = oneOf(t.mode, `${targetField}.mode`, ARM_TARGET_MODES);
                const pos = optionalVector(t.pos, `${targetField}.pos`);
                const from = optionalVector(t.from, `${targetField}.from`);
                const to = optionalVector(t.to, `${targetField}.to`);
                if (mode === 'local' && !pos) fail(targetField, 'mode "local" needs pos');
                if ((mode === 'sweep' || mode === 'pendulum') && (!from || !to)) fail(targetField, `mode "${mode}" needs from and to`);
                target = { mode, pos, offset: optionalVector(t.offset, `${targetField}.offset`), from, to, pingPong: flag(t.pingPong, `${targetField}.pingPong`) };
            }

            let wave: IBossArmWave | undefined;
            if (move.wave !== undefined) {
                const w = object(move.wave, `${moveField}.wave`);
                wave = {
                    amp: number(w.amp, `${moveField}.wave.amp`, 0),
                    freq: number(w.freq, `${moveField}.wave.freq`, 0),
                    speed: number(w.speed, `${moveField}.wave.speed`),
                };
            }

            let fire: IBossArmFire | undefined;
            if (move.fire !== undefined) {
                const f = object(move.fire, `${moveField}.fire`);
                fire = {
                    mode: oneOf(f.mode, `${moveField}.fire.mode`, ARM_FIRE_MODES),
                    rate: number(f.rate, `${moveField}.fire.rate`, Number.MIN_VALUE),
                    coneDeg: f.coneDeg === undefined ? undefined : number(f.coneDeg, `${moveField}.fire.coneDeg`, 0),
                };
            }

            return {
                stage,
                seconds,
                target,
                follow: move.follow === undefined ? undefined : number(move.follow, `${moveField}.follow`, Number.MIN_VALUE),
                motion: move.motion === undefined ? undefined : oneOf(move.motion, `${moveField}.motion`, ARM_MOTIONS),
                overshoot: move.overshoot === undefined ? undefined : number(move.overshoot, `${moveField}.overshoot`, 0),
                ease: move.ease === undefined ? undefined : oneOf(move.ease, `${moveField}.ease`, ARM_EASES),
                wave,
                fire,
            };
        });

        return {
            id: armId,
            jointPart,
            assets: {
                joint: string(assets.joint, `${field}.assets.joint`),
                segment: string(assets.segment, `${field}.assets.segment`),
                weapon: string(assets.weapon, `${field}.assets.weapon`),
                lazer: assets.lazer === undefined ? undefined : string(assets.lazer, `${field}.assets.lazer`),
            },
            mount,
            segments: integer(arm.segments, `${field}.segments`, 2),
            taper: arm.taper === undefined ? 1 : number(arm.taper, `${field}.taper`, Number.MIN_VALUE),
            spacing: arm.spacing === undefined ? undefined : number(arm.spacing, `${field}.spacing`, Number.MIN_VALUE),
            weapon: {
                type: weaponType as BossWeaponType,
                hits: number(weaponJson.hits, `${field}.weapon.hits`, Number.MIN_VALUE),
                speed: weaponJson.speed === undefined ? undefined : number(weaponJson.speed, `${field}.weapon.speed`, Number.MIN_VALUE),
                muzzle: optionalVector(weaponJson.muzzle, `${field}.weapon.muzzle`),
                scoreValue: number(weaponJson.scoreValue ?? 0, `${field}.weapon.scoreValue`, 0),
            },
            debrisScore: number(arm.debrisScore ?? 0, `${field}.debrisScore`, 0),
            phases: array(arm.phases ?? PHASES, `${field}.phases`).map((p, k) => oneOf(p, `${field}.phases[${k}]`, PHASES)),
            moves,
        };
    });

    const cycle: IBossCycleStep[] = array(root.cycle, 'cycle').map((value, i) => {
        const field = `cycle[${i}]`;
        const step = object(value, field);
        if (!PHASES.includes(step.phase as BossCyclePhase)) fail(`${field}.phase`, `expected one of ${PHASES.join(', ')}`);
        const seconds = array(step.seconds, `${field}.seconds`);
        if (seconds.length !== 2) return fail(`${field}.seconds`, 'expected [min, max]');
        const min = number(seconds[0], `${field}.seconds[0]`, Number.MIN_VALUE);
        const max = number(seconds[1], `${field}.seconds[1]`, min);
        return { phase: step.phase as BossCyclePhase, seconds: [min, max] as const };
    });
    if (cycle.length === 0) fail('cycle', 'give at least one step');

    const movementJson = object(root.movement, 'movement');
    const fxJson = root.fx === undefined ? {} : object(root.fx, 'fx');

    return {
        id,
        vox: string(root.vox, 'vox'),
        size,
        scoreValue: number(root.scoreValue, 'scoreValue', 0),
        hull,
        parts,
        weapons,
        arms,
        cycle,
        movement: {
            path: string(movementJson.path, 'movement.path'),
            durationSec: number(movementJson.durationSec, 'movement.durationSec', Number.MIN_VALUE),
            maxRollRad: number(movementJson.maxRollRad, 'movement.maxRollRad', 0),
            rollGain: number(movementJson.rollGain, 'movement.rollGain', 0),
        },
        fx: { chunks: flag(fxJson.chunks, 'fx.chunks'), drip: flag(fxJson.drip, 'fx.drip') },
    };
}

function asObject(value: unknown, field: string, id: string): Json {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`Boss "${id}": ${field}: expected an object`);
    }
    return value as Json;
}

function asString(value: unknown, field: string, id: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Boss "${id}": ${field}: expected a non-empty string`);
    }
    return value;
}

/** Two parts must not claim the same voxel column, or it would be unclear which one a shot hits. */
function checkRectsDoNotOverlap(parts: readonly IBossPartDef[], fail: (field: string, message: string) => never): void {
    for (let a = 0; a < parts.length; a++) {
        for (let b = a + 1; b < parts.length; b++) {
            for (const [ax0, az0, ax1, az1] of parts[a].rects) {
                for (const [bx0, bz0, bx1, bz1] of parts[b].rects) {
                    if (ax0 <= bx1 && bx0 <= ax1 && az0 <= bz1 && bz0 <= az1) {
                        fail('parts', `"${parts[a].id}" and "${parts[b].id}" overlap`);
                    }
                }
            }
        }
    }
}

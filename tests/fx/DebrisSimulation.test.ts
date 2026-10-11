import test from 'node:test';
import assert from 'node:assert/strict';
import { DebrisSimulation } from '../../src/systems/fx/DebrisSimulation.ts';
import type { IDebrisConfig, IGroundSampler, IVoxelCloud } from '../../src/config/interfaces/interfaces.ts';

const baseConfig: IDebrisConfig = {
    maxParticles: 64,
    gravity: 60,
    airDrag: 0,
    restitution: 0.5,
    bounceFriction: 0,
    contactFriction: 4,
    spinImpactDamping: 0.5,
    spinContactDamping: 2,
    restSpeed: 4,
    particleSize: 1,
    fadeSec: 0.5,
    killBelowY: -50,
    maxStepSec: 1 / 20,
    profiles: {
        invader: {
            speed: [10, 10],
            upward: [0, 0],
            scatter: 0,
            inheritVelocity: 1,
            spin: [5, 5],
            life: [2, 2],
            glow: { color: [1, 1, 0.5], intensity: 4, durationSec: 0.5 },
        },
        player: {
            speed: [20, 20],
            upward: [5, 5],
            scatter: 0,
            inheritVelocity: 0,
            spin: [1, 1],
            life: [3, 3],
            glow: { color: [0, 0, 1], intensity: 2, durationSec: 0 },
        },
    },
};

function flatGround(height = 0, scrollZ = 0): IGroundSampler {
    return {
        getGroundHeight: () => height,
        getGroundGradient: (_x, _z, out) => { out.x = 0; out.z = 0; return out; },
        getGroundScrollVelocityZ: () => scrollZ,
    };
}

function cloudOf(...voxels: [number, number, number][]): IVoxelCloud {
    return {
        count: voxels.length,
        x: Float32Array.from(voxels.map((v) => v[0])),
        y: Float32Array.from(voxels.map((v) => v[1])),
        z: Float32Array.from(voxels.map((v) => v[2])),
        r: Float32Array.from(voxels.map(() => 0.2)),
        g: Float32Array.from(voxels.map(() => 0.4)),
        b: Float32Array.from(voxels.map(() => 0.6)),
    };
}

const identity = { x: 0, y: 0, z: 0, w: 1 };
const still = { x: 0, y: 0, z: 0 };

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function step(sim: DebrisSimulation, seconds: number, dt = 1 / 60): void {
    for (let t = 0; t < seconds; t += dt) sim.update(dt);
}

test('spawn returns the longest particle lifetime, the moment the explosion has finished', () => {
    const config = { ...baseConfig, profiles: {
        ...baseConfig.profiles,
        invader: { ...baseConfig.profiles.invader, life: [1, 3] as const },
    } };
    const sim = new DebrisSimulation(config, flatGround(0), seeded(21));
    const voxels = Array.from({ length: 40 }, (_, i): [number, number, number] => [i, 0, 0]);
    const longest = sim.spawn('invader', cloudOf(...voxels), { x: 0, y: 5, z: 0 }, identity, still);
    assert.ok(longest > 2 && longest <= 3, `longest ${longest}`);

    step(sim, longest - 0.1);
    assert.ok(sim.count > 0, 'something is still alive just before the longest life');
    step(sim, 0.2);
    assert.equal(sim.count, 0);
});

test('debris with no particles reports no lifetime', () => {
    const sim = new DebrisSimulation({ ...baseConfig, maxParticles: 0 }, flatGround(0), seeded(22));
    assert.equal(sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 0, z: 0 }, identity, still), 0);
});

test('spawn makes one particle per voxel placed by the entity pose', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(1));
    const longestLife = sim.spawn('invader', cloudOf([1, 0, 0], [0, 0, 2]), { x: 10, y: 20, z: 30 }, identity, still);
    assert.equal(longestLife, 2);
    assert.equal(sim.count, 2);
    assert.deepEqual([sim.px[0], sim.py[0], sim.pz[0]], [11, 20, 30]);
    assert.deepEqual([sim.px[1], sim.py[1], sim.pz[1]], [10, 20, 32]);
});

test('voxel offsets are rotated by the entity orientation', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(1));
    const quarterTurnAboutY = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    sim.spawn('invader', cloudOf([1, 0, 0]), { x: 0, y: 0, z: 0 }, quarterTurnAboutY, still);
    // +X rotated 90 degrees about +Y becomes -Z.
    assert.ok(Math.abs(sim.px[0]) < 1e-6);
    assert.ok(Math.abs(sim.pz[0] + 1) < 1e-6);
});

test('debris launches outward, inherits the entity velocity and keeps the voxel colour', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(2));
    sim.spawn('invader', cloudOf([2, 0, 0], [-2, 0, 0]), { x: 0, y: 0, z: 0 }, identity, { x: 0, y: 0, z: 5 });
    sim.update(0.001);
    // vx is +/-10 outward; vz is the inherited 5.
    assert.ok(sim.px[0] > 2);
    assert.ok(sim.px[1] < -2);
    assert.ok(sim.pz[0] > 0 && sim.pz[1] > 0);
});

test('gravity pulls debris down and it comes to rest on the ground', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(0), seeded(3));
    sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 10, z: 0 }, identity, still);
    step(sim, 1.5);
    assert.equal(sim.count, 1);
    assert.ok(Math.abs(sim.py[0] - 0.5) < 1e-4, `rests on the surface, got ${sim.py[0]}`);
});

test('a dropped particle bounces to about restitution squared of its fall height', () => {
    const config = { ...baseConfig, airDrag: 0, contactFriction: 0, profiles: {
        ...baseConfig.profiles,
        invader: { ...baseConfig.profiles.invader, speed: [0, 0] as const, inheritVelocity: 0, life: [10, 10] as const },
    } };
    const sim = new DebrisSimulation(config, flatGround(0), seeded(4));
    sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 20.5, z: 0 }, identity, still);

    let bounced = false;
    let peakAfterBounce = 0;
    let lastVy = 0;
    for (let t = 0; t < 4; t += 1 / 240) {
        sim.update(1 / 240);
        const vy = sim.py[0] - lastVy;
        if (!bounced && sim.py[0] <= 0.5 + 1e-3) bounced = true;
        if (bounced) peakAfterBounce = Math.max(peakAfterBounce, sim.py[0] - 0.5);
        lastVy = sim.py[0];
        if (bounced && vy < 0 && peakAfterBounce > 1) break;
    }
    // Fall height 20, restitution 0.5: rebound height 20 * 0.25 = 5.
    assert.ok(Math.abs(peakAfterBounce - 5) < 0.6, `rebound ${peakAfterBounce}`);
});

test('a bounce off a slope is deflected sideways', () => {
    const slope: IGroundSampler = {
        getGroundHeight: () => 0,
        getGroundGradient: (_x, _z, out) => { out.x = 1; out.z = 0; return out; },
        getGroundScrollVelocityZ: () => 0,
    };
    const config = { ...baseConfig, contactFriction: 0, profiles: {
        ...baseConfig.profiles,
        invader: { ...baseConfig.profiles.invader, speed: [0, 0] as const, inheritVelocity: 0 },
    } };
    const sim = new DebrisSimulation(config, slope, seeded(5));
    sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 10, z: 0 }, identity, still);
    step(sim, 1);
    // Surface rises toward +X, so its normal tilts to -X and debris is thrown that way.
    assert.ok(sim.px[0] < -0.5, `x = ${sim.px[0]}`);
});

test('resting debris is carried along with the scrolling ground', () => {
    const scrollZ = -24;
    const sim = new DebrisSimulation(baseConfig, flatGround(0, scrollZ), seeded(6));
    const config = baseConfig.profiles.invader;
    assert.ok(config.life[0] >= 2);
    sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 0.5, z: 0 }, identity, still);
    step(sim, 1.2);
    assert.ok(Math.abs(sim.py[0] - 0.5) < 1e-3);
    // Friction has pulled its Z speed to the ground's: it keeps pace instead of staying put.
    const z0 = sim.pz[0];
    step(sim, 0.2);
    assert.ok(Math.abs((sim.pz[0] - z0) / 0.2 - scrollZ) < 2);
});

test('spin is damped on impact and while sliding', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(0), seeded(7));
    sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 12, z: 0 }, identity, still);
    step(sim, 3);
    const quietAngle = (() => {
        const before = [sim.qx[0], sim.qy[0], sim.qz[0], sim.qw[0]];
        sim.update(1 / 60);
        const dot = before[0] * sim.qx[0] + before[1] * sim.qy[0] + before[2] * sim.qz[0] + before[3] * sim.qw[0];
        return 2 * Math.acos(Math.min(1, Math.abs(dot)));
    })();
    // Started at 5 rad/s (0.083 rad per frame); after landing it has almost stopped.
    assert.ok(quietAngle < 0.02, `angle per frame ${quietAngle}`);
});

test('orientation stays a unit quaternion and actually tumbles', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(8));
    sim.spawn('invader', cloudOf([1, 1, 1]), { x: 0, y: 0, z: 0 }, { x: 0.1, y: 0.2, z: 0.3, w: Math.sqrt(1 - 0.14) }, still);
    const start = [sim.qx[0], sim.qy[0], sim.qz[0], sim.qw[0]];
    step(sim, 1);
    const q = [sim.qx[0], sim.qy[0], sim.qz[0], sim.qw[0]];
    assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-4);
    assert.notDeepEqual(q.map((v) => v.toFixed(3)), start.map((v) => v.toFixed(3)));
});

test('glow starts hot and cools to exactly the voxel colour', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(9));
    sim.spawn('invader', cloudOf([1, 0, 0]), { x: 0, y: 0, z: 0 }, identity, still);
    // Hot at birth: tint * intensity (4 * [1, 1, 0.5]).
    assert.ok(Math.abs(sim.cr[0] - 4) < 1e-5 && Math.abs(sim.cb[0] - 2) < 1e-5);
    step(sim, 0.6);
    assert.ok(Math.abs(sim.cr[0] - 0.2) < 1e-5);
    assert.ok(Math.abs(sim.cg[0] - 0.4) < 1e-5);
    assert.ok(Math.abs(sim.cb[0] - 0.6) < 1e-5);
});

test('a profile with no glow duration shows the plain voxel colour', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(10));
    sim.spawn('player', cloudOf([1, 0, 0]), { x: 0, y: 0, z: 0 }, identity, still);
    assert.ok(Math.abs(sim.cr[0] - 0.2) < 1e-6 && Math.abs(sim.cb[0] - 0.6) < 1e-6);
});

test('debris shrinks away at the end of its life and is then removed', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(0), seeded(11));
    sim.spawn('invader', cloudOf([1, 0, 0]), { x: 0, y: 0.5, z: 0 }, identity, still);
    assert.equal(sim.size[0], 1);
    step(sim, 1.9);
    assert.ok(sim.size[0] < 0.4 && sim.size[0] > 0, `size ${sim.size[0]}`);
    step(sim, 0.3);
    assert.equal(sim.count, 0);
});

test('debris with no ground below falls out of the world and is removed', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-Infinity), seeded(12));
    sim.spawn('player', cloudOf([0, 0, 0]), { x: 0, y: 0, z: 0 }, identity, still);
    step(sim, 2.9);
    assert.equal(sim.count, 0);
});

test('a full pool replaces old debris so a new explosion is always shown', () => {
    const config = { ...baseConfig, maxParticles: 10 };
    const sim = new DebrisSimulation(config, flatGround(-1000), seeded(13));
    sim.spawn('invader', cloudOf(...Array.from({ length: 10 }, (_, i): [number, number, number] => [i, 0, 0])), { x: 0, y: 0, z: 0 }, identity, still);
    step(sim, 0.5);
    assert.equal(sim.count, 10);

    sim.spawn('invader', cloudOf([0, 0, 0], [0, 0, 0], [0, 0, 0]), { x: 500, y: 0, z: 0 }, identity, still);
    assert.equal(sim.count, 10);
    const fresh = Array.from({ length: 10 }, (_, i) => sim.px[i]).filter((x) => x >= 500).length;
    assert.equal(fresh, 3);
});

test('large frame steps are clamped and clear() empties the pool', () => {
    const sim = new DebrisSimulation(baseConfig, flatGround(-1000), seeded(14));
    sim.spawn('invader', cloudOf([0, 0, 0]), { x: 0, y: 100, z: 0 }, identity, still);
    const y0 = sim.py[0];
    sim.update(5);
    // One clamped 1/20 s step: fell by at most a fraction of a unit, not 5 seconds' worth.
    assert.ok(y0 - sim.py[0] < 1);
    sim.clear();
    assert.equal(sim.count, 0);
});

test('particles removed from the middle do not disturb the others', () => {
    const config = { ...baseConfig, profiles: {
        ...baseConfig.profiles,
        invader: { ...baseConfig.profiles.invader, life: [1, 3] as const },
    } };
    const sim = new DebrisSimulation(config, flatGround(0), seeded(15));
    sim.spawn('invader', cloudOf(...Array.from({ length: 30 }, (_, i): [number, number, number] => [i, 0, 0])), { x: 0, y: 5, z: 0 }, identity, still);
    step(sim, 2);
    assert.ok(sim.count > 0 && sim.count < 30);
    for (let i = 0; i < sim.count; i++) {
        assert.ok(Number.isFinite(sim.px[i]) && Number.isFinite(sim.py[i]) && Number.isFinite(sim.cr[i]));
        assert.ok(sim.size[i] >= 0 && sim.size[i] <= 1);
    }
});

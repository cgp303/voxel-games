import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainTransition, type ITerrainTransitionOptions } from '../../../src/world/terrain/TerrainTransition.ts';

const DT = 1 / 60;
const BASE = 48;

function options(overrides: Partial<ITerrainTransitionOptions> = {}): ITerrainTransitionOptions {
    return { baseSpeed: BASE, maxSpeed: 160, seconds: 10.7, rampUpSeconds: 1, rampDownSeconds: 1.5, ...overrides };
}

/** Runs the controller until the terrain arrives and the ground is back to base speed (or `limit` seconds pass). */
function simulate(transition: TerrainTransition, distance: number, limit = 40) {
    let left = distance;
    let time = 0;
    let arrivedAt: number | null = null;
    let peak = 0;
    let lowest = Infinity;
    const speeds: number[] = [];
    while (!transition.done && time < limit) {
        const speed = transition.update(DT, left);
        left -= speed * DT;
        time += DT;
        peak = Math.max(peak, speed);
        lowest = Math.min(lowest, speed);
        speeds.push(speed);
        if (arrivedAt === null && left <= 0) arrivedAt = time;
    }
    return { arrivedAt, peak, lowest, speeds, time, left };
}

test('a boost that fits arrives at the deadline, never below base speed or above the cap', () => {
    const t = new TerrainTransition(options());
    const result = simulate(t, 700);
    assert.ok(result.arrivedAt !== null);
    assert.ok(Math.abs(result.arrivedAt! - 10.7) < 0.25, `arrived at ${result.arrivedAt}`);
    assert.ok(result.lowest >= BASE - 1e-9);
    assert.ok(result.peak <= 160 + 1e-9);
    assert.ok(result.peak > BASE + 10, 'a real boost was needed');
    assert.equal(t.done, true);
    assert.equal(t.update(DT, -1), BASE);
});

test('the speed ramps up, holds, then eases back, ending at base speed when it arrives', () => {
    const t = new TerrainTransition(options());
    const { speeds, arrivedAt } = simulate(t, 700);
    const at = (seconds: number) => speeds[Math.round(seconds / DT)];
    assert.ok(at(0.5) > BASE && at(0.5) < at(3), 'still accelerating after half a second');
    assert.ok(Math.abs(at(3) - at(6)) < 2, 'holds a steady speed in the middle');
    assert.ok(at(arrivedAt! - 0.1) < at(6), 'easing back near the end');
    assert.ok(Math.abs(at(arrivedAt! - 0.05) - BASE) < 5, 'close to base speed on arrival');
});

test('no boost is used when base speed alone is quick enough', () => {
    const t = new TerrainTransition(options());
    const { peak, arrivedAt } = simulate(t, 300);
    assert.ok(Math.abs(peak - BASE) < 1e-6);
    assert.ok(Math.abs(arrivedAt! - 300 / BASE) < 0.05);
});

test('when the cap makes the deadline impossible the terrain lands late, at the cap, then the ground eases back', () => {
    const t = new TerrainTransition(options({ seconds: 4 }));
    const result = simulate(t, 700);
    assert.ok(result.arrivedAt! > 4, `arrived at ${result.arrivedAt}`);
    assert.ok(result.arrivedAt! < 6.5, `arrived at ${result.arrivedAt}`);
    assert.ok(Math.abs(result.peak - 160) < 1e-6);
    assert.equal(t.done, true);
    // no sudden drop: it never changes by more than the ramp allows per frame
    const maxStep = (160 - BASE) * DT + 1e-9; // the fastest ramp is the 1 s ramp up
    for (let i = 1; i < result.speeds.length; i++) {
        assert.ok(Math.abs(result.speeds[i] - result.speeds[i - 1]) <= maxStep, `jump at frame ${i}`);
    }
});

test('a slower or stuttering frame rate still lands on time', () => {
    const t = new TerrainTransition(options());
    let left = 700;
    let time = 0;
    let arrivedAt: number | null = null;
    let frame = 0;
    while (!t.done && time < 40) {
        const dt = frame++ % 7 === 0 ? 0.12 : 1 / 30; // regular hitches
        const speed = t.update(dt, left);
        left -= speed * dt;
        time += dt;
        if (arrivedAt === null && left <= 0) arrivedAt = time;
    }
    assert.ok(Math.abs(arrivedAt! - 10.7) < 0.7, `arrived at ${arrivedAt}`);
});

test('the default tuning covers the view within the pause plus one second', () => {
    // pause 2.5 s + settle 1 s; about 690 units from the fog edge to the bottom of the view
    const t = new TerrainTransition(options({ seconds: 3.5, rampUpSeconds: 0.4, rampDownSeconds: 0.6, maxSpeed: 300 }));
    const result = simulate(t, 690);
    assert.ok(Math.abs(result.arrivedAt! - 3.5) < 0.2, `arrived at ${result.arrivedAt}`);
    assert.ok(result.peak < 300 && result.peak > 150, `peak ${result.peak}`);
    assert.equal(t.done, true);
});

test('a distance too long for the cap lands late at the cap, and a higher cap brings it back to the deadline', () => {
    const capped = simulate(new TerrainTransition(options({ seconds: 3.5, rampUpSeconds: 0.4, rampDownSeconds: 0.6, maxSpeed: 200 })), 900);
    assert.ok(capped.arrivedAt! > 3.9, `arrived at ${capped.arrivedAt}`);
    assert.ok(Math.abs(capped.peak - 200) < 1e-6);

    const raised = simulate(new TerrainTransition(options({ seconds: 3.5, rampUpSeconds: 0.4, rampDownSeconds: 0.6, maxSpeed: 500 })), 900);
    assert.ok(Math.abs(raised.arrivedAt! - 3.5) < 0.2, `arrived at ${raised.arrivedAt}`);
});

test('a retargeted transition carries on from the current speed instead of jumping', () => {
    const first = new TerrainTransition(options());
    let left = 700;
    let speed = BASE;
    for (let i = 0; i < 120; i++) {
        speed = first.update(DT, left);
        left -= speed * DT;
    }
    const second = new TerrainTransition(options({ startSpeed: speed, seconds: 8 }));
    const next = second.update(DT, left);
    assert.ok(Math.abs(next - speed) < ((160 - BASE) / 1) * DT + 1e-6);
    assert.equal(second.speed, next);
});

test('cancel eases the ground back to base speed without waiting for arrival', () => {
    const t = new TerrainTransition(options());
    let left = 700;
    for (let i = 0; i < 180; i++) left -= t.update(DT, left) * DT;
    assert.ok(t.speed > BASE);
    t.cancel();
    let guard = 0;
    while (!t.done && guard++ < 600) t.update(DT, left);
    assert.equal(t.done, true);
    assert.equal(t.speed, BASE);
    assert.equal(t.hasArrived, true);
});

test('a destination that is already reached finishes at once', () => {
    const t = new TerrainTransition(options());
    assert.equal(t.update(DT, -5), BASE);
    assert.equal(t.done, true);
});

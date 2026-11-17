import test from 'node:test';
import assert from 'node:assert/strict';
import { SplinePath, ease, pingPong, smoothing, sweptCircleHit, whip } from '../../src/systems/boss/armMath.ts';

test('ease endpoints and midpoint', () => {
    for (const kind of ['in', 'out', 'inOut', undefined] as const) {
        assert.equal(ease(kind, 0), 0);
        assert.equal(ease(kind, 1), 1);
    }
    assert.ok(ease('in', 0.5) < 0.5);
    assert.ok(ease('out', 0.5) > 0.5);
});

test('whip overshoots then settles on 1', () => {
    assert.equal(whip(0, 0.2), 0);
    assert.ok(Math.abs(whip(1, 0.2) - 1) < 1e-9);
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, whip(i / 100, 0.2));
    assert.ok(peak > 1.05);
    for (let i = 0; i <= 100; i++) assert.ok(whip(i / 100, 0) <= 1 + 1e-9);
});

test('pingPong goes out and back', () => {
    assert.equal(pingPong(0), 0);
    assert.equal(pingPong(0.5), 1);
    assert.equal(pingPong(1), 0);
});

test('smoothing is frame-rate independent', () => {
    const once = 1 - smoothing(3, 0.2);
    const twice = (1 - smoothing(3, 0.1)) ** 2;
    assert.ok(Math.abs(once - twice) < 1e-12);
});

test('spline passes through its control points and samples by distance', () => {
    const controls = [0, 0, 0, 10, 0, 0, 20, 0, 0, 30, 0, 0];
    const spline = new SplinePath(4, 8);
    spline.build(controls);
    assert.ok(Math.abs(spline.totalLength - 30) < 1e-6);

    const position = new Float64Array(3);
    const tangent = new Float64Array(3);
    spline.sample(15, position, tangent, 0);
    assert.ok(Math.abs(position[0] - 15) < 1e-6);
    assert.ok(Math.abs(tangent[0] - 1) < 1e-6);

    spline.sample(1000, position, tangent, 0);
    assert.ok(Math.abs(position[0] - 30) < 1e-6);
});

test('spline ends exactly on the first and last control points', () => {
    const controls = [1, 2, 3, 5, -4, 0, 9, 9, 9];
    const spline = new SplinePath(3, 6);
    spline.build(controls);
    const position = new Float64Array(3);
    const tangent = new Float64Array(3);
    spline.sample(0, position, tangent, 0);
    assert.deepEqual(Array.from(position), [1, 2, 3]);
    spline.sample(spline.totalLength, position, tangent, 0);
    assert.deepEqual(Array.from(position), [9, 9, 9]);
});

test('sweptCircleHit finds the first contact along a path', () => {
    assert.ok(Math.abs(sweptCircleHit(0, 0, 10, 0, 5, 0, 1) - 0.4) < 1e-9);
    assert.equal(sweptCircleHit(0, 0, 10, 0, 5, 3, 1), -1);
    assert.equal(sweptCircleHit(0, 0, 3, 0, 5, 0, 1), -1);
    assert.equal(sweptCircleHit(5, 0, 10, 0, 5, 0, 1), 0);
    assert.equal(sweptCircleHit(10, 0, 20, 0, 5, 0, 1), -1);
});

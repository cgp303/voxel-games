import test from 'node:test';
import assert from 'node:assert/strict';
import { clipSegmentToBox, traceSegmentThroughMask } from '../../src/systems/collision/segmentTests.ts';
import type { ICollisionBucket } from '../../src/systems/collision/CollisionModel.ts';

const slab = { tEnter: 0, tExit: 0 };

test('segment crossing a box reports entry and exit', () => {
    assert.ok(clipSegmentToBox(0, -10, 0, 10, -1, -1, 1, 1, slab));
    assert.ok(Math.abs(slab.tEnter - 0.45) < 1e-9);
    assert.ok(Math.abs(slab.tExit - 0.55) < 1e-9);
});

test('segment that starts inside enters at zero', () => {
    assert.ok(clipSegmentToBox(0, 0, 0, 10, -1, -1, 1, 1, slab));
    assert.equal(slab.tEnter, 0);
});

test('segments that stop short, pass beside or run parallel to the box miss', () => {
    assert.equal(clipSegmentToBox(0, -10, 0, -5, -1, -1, 1, 1, slab), false);
    assert.equal(clipSegmentToBox(3, -10, 3, 10, -1, -1, 1, 1, slab), false);
    assert.equal(clipSegmentToBox(-10, 3, 10, 3, -1, -1, 1, 1, slab), false);
});

test('reversed and diagonal segments are handled', () => {
    assert.ok(clipSegmentToBox(0, 10, 0, -10, -1, -1, 1, 1, slab));
    assert.ok(Math.abs(slab.tEnter - 0.45) < 1e-9);
    assert.ok(clipSegmentToBox(-5, -5, 5, 5, -1, -1, 1, 1, slab));
    assert.equal(clipSegmentToBox(-5, 5, -2, 8, -1, -1, 1, 1, slab), false);
});

function bucketFrom(rows: string[], cellsPerUnit = 1): ICollisionBucket {
    const cols = rows[0].length;
    const data = new Uint8Array(cols * rows.length);
    rows.forEach((row, r) => {
        for (let c = 0; c < cols; c++) data[r * cols + c] = row[c] === '#' ? 1 : 0;
    });
    return {
        minX: 0,
        minZ: 0,
        maxX: cols / cellsPerUnit,
        maxZ: rows.length / cellsPerUnit,
        cols,
        rows: rows.length,
        cellsPerUnit,
        data,
    };
}

const out = { t: 0 };

test('walk finds the first solid cell along Z', () => {
    const bucket = bucketFrom(['....', '....', '.#..', '.#..']);
    assert.ok(traceSegmentThroughMask(bucket, 1.5, -2, 1.5, 6, 0.25, 0.75, out));
    // Enters the solid cell at z = 2: t = (2 - -2) / 8.
    assert.ok(Math.abs(out.t - 0.5) < 1e-9);
});

test('walk passes through a gap without hitting', () => {
    const bucket = bucketFrom(['#..#', '#..#', '#..#']);
    assert.equal(traceSegmentThroughMask(bucket, 1.5, -2, 1.5, 6, 0.25, 0.625, out), false);
    assert.ok(traceSegmentThroughMask(bucket, 0.5, -2, 0.5, 6, 0.25, 0.625, out));
});

test('walk follows diagonals and detects a corner cell', () => {
    const bucket = bucketFrom(['....', '....', '....', '...#']);
    assert.ok(traceSegmentThroughMask(bucket, -1, -1, 5, 5, 1 / 6, 5 / 6, out));
    assert.ok(out.t >= 4 / 6 - 1e-9);
    assert.equal(traceSegmentThroughMask(bucket, 0, 3.5, 2.9, 3.5, 0, 1, out), false);
});

test('walk honours the range limit and stationary segments', () => {
    const bucket = bucketFrom(['....', '....', '..#.']);
    assert.equal(traceSegmentThroughMask(bucket, 2.5, -1, 2.5, 4, 0.2, 0.5, out), false);
    assert.ok(traceSegmentThroughMask(bucket, 2.5, 2.5, 2.5, 2.5, 0, 1, out));
    assert.equal(out.t, 0);
});

test('walk respects mask resolution', () => {
    const bucket = bucketFrom(['..', '.#'], 2);
    assert.ok(traceSegmentThroughMask(bucket, 0.75, -1, 0.75, 2, 0.5, 0.75, out));
    assert.ok(Math.abs(out.t - 0.5) < 1e-9);
});

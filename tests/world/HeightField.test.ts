import test from 'node:test';
import assert from 'node:assert/strict';
import { HeightField } from '../../src/world/HeightField.ts';

// 4 columns wide, 3 rows deep; height = 10 * z + x.
const heights = Array.from({ length: 12 }, (_, i) => 10 * Math.floor(i / 4) + (i % 4));

test('height lookup uses the column that contains the point', () => {
    const field = new HeightField(heights, 4, 3, false);
    assert.equal(field.heightAt(0.1, 0.9), 0);
    assert.equal(field.heightAt(3.99, 0), 3);
    assert.equal(field.heightAt(2, 2.5), 22);
    assert.equal(field.heightAt(1.5, 1.5), 11);
});

test('outside the terrain there is no ground', () => {
    const field = new HeightField(heights, 4, 3, false);
    assert.equal(field.heightAt(-0.01, 1), -Infinity);
    assert.equal(field.heightAt(4, 1), -Infinity);
    assert.equal(field.heightAt(1, -0.01), -Infinity);
    assert.equal(field.heightAt(1, 3), -Infinity);
});

test('a wrapping field repeats along Z in both directions but not along X', () => {
    const field = new HeightField(heights, 4, 3, true);
    assert.equal(field.heightAt(1, 3.5), field.heightAt(1, 0.5));
    assert.equal(field.heightAt(1, -0.5), field.heightAt(1, 2.5));
    assert.equal(field.heightAt(1, 3 * 7 + 1.5), field.heightAt(1, 1.5));
    assert.equal(field.heightAt(1, -3 * 7 - 0.5), field.heightAt(1, 2.5));
    assert.equal(field.heightAt(4.5, 1), -Infinity);
});

test('gradient is the central difference of neighbouring columns', () => {
    const field = new HeightField(heights, 4, 3, false);
    const out = { x: 0, z: 0 };
    field.gradientAt(1.5, 1.5, out);
    assert.equal(out.x, 1);
    assert.equal(out.z, 10);
});

test('gradient at an edge treats the missing neighbour as the column itself', () => {
    const field = new HeightField(heights, 4, 3, false);
    const out = { x: 0, z: 0 };
    field.gradientAt(0.5, 0.5, out);
    assert.equal(out.x, 0.5);
    assert.equal(out.z, 5);
    field.gradientAt(3.5, 2.5, out);
    assert.equal(out.x, 0.5);
    assert.equal(out.z, 5);
});

test('gradient wraps across the Z seam and is zero off the terrain', () => {
    const field = new HeightField(heights, 4, 3, true);
    const out = { x: 9, z: 9 };
    field.gradientAt(1.5, 0.5, out);
    // Neighbours are row 1 (11) and the wrapped row 2 (21): (11 - 21) / 2.
    assert.equal(out.z, -5);

    field.gradientAt(-3, 1, out);
    assert.deepEqual(out, { x: 0, z: 0 });
});

test('gradient returns the object it was given', () => {
    const field = new HeightField(heights, 4, 3, false);
    const out = { x: 0, z: 0 };
    assert.equal(field.gradientAt(1, 1, out), out);
});

test('the heights array must match the dimensions', () => {
    assert.throws(() => new HeightField([1, 2, 3], 2, 2, false));
    assert.throws(() => new HeightField([], 0, 0, false));
});

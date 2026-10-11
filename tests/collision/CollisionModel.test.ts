import test from 'node:test';
import assert from 'node:assert/strict';
import { CollisionModelSet } from '../../src/systems/collision/CollisionModel.ts';
import type { ICollisionBucket } from '../../src/systems/collision/CollisionModel.ts';
import { box } from './helpers.ts';

const options = { rollBuckets: 4, maskResolution: 2 };

test('axis-aligned footprint matches the voxel extents', () => {
    const set = new CollisionModelSet(box(4, 1, 4), options);
    const bucket = set.get(0).buckets[0];
    assert.equal(bucket.cols, 8);
    assert.equal(bucket.rows, 8);
    assert.equal(bucket.minX, -2);
    assert.equal(bucket.maxX, 2);
    assert.equal(bucket.minZ, -2);
    assert.equal(bucket.maxZ, 2);
    assert.ok(bucket.data.every((cell) => cell === 1));
});

test('rolling 90 degrees swaps the X extent for the Y thickness, leaving Z alone', () => {
    const set = new CollisionModelSet(box(4, 2, 1), options);
    const model = set.get(0);
    const flat = model.buckets[0];
    const upright = model.buckets[1];
    assert.equal(flat.maxX - flat.minX, 4);
    assert.equal(upright.maxX - upright.minX, 2);
    assert.equal(flat.maxZ - flat.minZ, 1);
    assert.equal(upright.maxZ - upright.minZ, 1);
});

test('positive roll turns +Y toward -X (the rotation direction three.js uses about +Z)', () => {
    // Base: z = 0..2 at y = 0, plus a single extra voxel at y = 1, z = 0.
    const voxels = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 }, { x: 0, y: 1, z: 0 }];
    const model = new CollisionModelSet(voxels, options).get(0);
    const countSolidRows = (bucket: ICollisionBucket, firstCol: number, lastCol: number): number => {
        let rows = 0;
        for (let row = 0; row < bucket.rows; row++) {
            for (let col = firstCol; col <= lastCol; col++) {
                if (bucket.data[row * bucket.cols + col] === 1) { rows++; break; }
            }
        }
        return rows;
    };

    const quarter = model.buckets[1];
    assert.equal(quarter.cols, 4);
    // y = 1 maps to x < 0 and only covers the z = 0 voxel (2 rows); y = 0 maps to x > 0 and covers all 6 rows.
    assert.equal(countSolidRows(quarter, 0, 1), 2);
    assert.equal(countSolidRows(quarter, 2, 3), 6);

    const threeQuarter = model.buckets[3];
    assert.equal(countSolidRows(threeQuarter, 0, 1), 6);
    assert.equal(countSolidRows(threeQuarter, 2, 3), 2);
});

test('mover radius dilates the footprint by that many world units', () => {
    const set = new CollisionModelSet(box(1, 1, 1), options);
    const bare = set.get(0).buckets[0];
    const fat = set.get(1).buckets[0];
    assert.equal(bare.minX, -0.5);
    assert.equal(fat.minX, -1.5);
    assert.equal(fat.maxX, 1.5);
    assert.equal(fat.cols, 6);
    // Disc, not square: the extreme corner cell stays empty while the edge cell is solid.
    assert.equal(fat.data[0], 0);
    assert.equal(fat.data[2 * fat.cols + 0], 1);
});

test('variants are cached per radius', () => {
    const set = new CollisionModelSet(box(2, 1, 2), options);
    assert.equal(set.get(0.5), set.get(0.5));
    assert.notEqual(set.get(0.5), set.get(1));
});

test('roll maps to the nearest bucket and wraps in both directions', () => {
    const model = new CollisionModelSet(box(2, 1, 2), { rollBuckets: 8, maskResolution: 2 }).get(0);
    assert.equal(model.bucketIndexForRoll(0), 0);
    assert.equal(model.bucketIndexForRoll(Math.PI / 4), 1);
    assert.equal(model.bucketIndexForRoll(Math.PI * 2), 0);
    assert.equal(model.bucketIndexForRoll(-Math.PI / 4), 7);
    assert.equal(model.bucketIndexForRoll(Math.PI * 4 + Math.PI / 4), 1);
});

test('broad extents cover every roll of the model', () => {
    const set = new CollisionModelSet(box(8, 2, 3), options);
    const model = set.get(0.5);
    for (const bucket of model.buckets) {
        assert.ok(Math.max(-bucket.minX, bucket.maxX) <= set.broadHalfX + 0.5);
        assert.ok(Math.max(-bucket.minZ, bucket.maxZ) <= set.broadHalfZ + 0.5);
    }
});

test('invalid input is rejected', () => {
    assert.throws(() => new CollisionModelSet([], options));
    assert.throws(() => new CollisionModelSet(box(1, 1, 1), { rollBuckets: 0, maskResolution: 2 }));
    assert.throws(() => new CollisionModelSet(box(1, 1, 1), { rollBuckets: 4, maskResolution: 0.5 }));
});

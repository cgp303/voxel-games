import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoxelCloud } from '../../src/voxel/VoxelCloud.ts';

const palette = [
    { r: 255, g: 0, b: 0, a: 255 },
    { r: 0, g: 128, b: 255, a: 255 },
];

test('positions are voxel centres relative to the bounding-box centre', () => {
    // Voxels span x 2..5, y 0, z 7..8: box centre is (4, 0.5, 8).
    const cloud = buildVoxelCloud({
        size: { x: 8, y: 1, z: 9 },
        voxels: [
            { x: 2, y: 0, z: 7, colorIndex: 0 },
            { x: 5, y: 0, z: 8, colorIndex: 1 },
        ],
        colors: palette,
    });
    assert.equal(cloud.count, 2);
    assert.deepEqual(Array.from(cloud.x), [-1.5, 1.5]);
    assert.deepEqual(Array.from(cloud.y), [0, 0]);
    assert.deepEqual(Array.from(cloud.z), [-0.5, 0.5]);
});

test('colours are the exact palette entries scaled to 0..1', () => {
    const cloud = buildVoxelCloud({
        size: { x: 2, y: 1, z: 1 },
        voxels: [
            { x: 0, y: 0, z: 0, colorIndex: 0 },
            { x: 1, y: 0, z: 0, colorIndex: 1 },
        ],
        colors: palette,
    });
    assert.deepEqual([cloud.r[0], cloud.g[0], cloud.b[0]], [1, 0, 0]);
    assert.ok(Math.abs(cloud.g[1] - 128 / 255) < 1e-6);
    assert.deepEqual([cloud.r[1], cloud.b[1]], [0, 1]);
});

test('palette indices wrap like the voxel mesh and an empty palette is black', () => {
    const wrapped = buildVoxelCloud({
        size: { x: 1, y: 1, z: 1 },
        voxels: [{ x: 0, y: 0, z: 0, colorIndex: 3 }],
        colors: palette,
    });
    assert.deepEqual([wrapped.r[0], wrapped.b[0]], [0, 1]);

    const black = buildVoxelCloud({
        size: { x: 1, y: 1, z: 1 },
        voxels: [{ x: 0, y: 0, z: 0, colorIndex: 5 }],
        colors: [],
    });
    assert.deepEqual([black.r[0], black.g[0], black.b[0]], [0, 0, 0]);
});

test('an empty model is rejected', () => {
    assert.throws(() => buildVoxelCloud({ size: { x: 1, y: 1, z: 1 }, voxels: [], colors: palette }));
});

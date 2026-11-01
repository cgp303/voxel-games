import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld } from '../../src/voxel/VoxelWorld.ts';
import { GREEDY_QUAD_STRIDE, greedyMesh, greedyQuads, sliceAxes } from '../../src/voxel/GreedyMesher.ts';
import { FACE_CORNERS, FACE_NORMALS } from '../../src/voxel/VoxelFaceTables.ts';

const PALETTE = [
    { r: 255, g: 0, b: 0, a: 255 },
    { r: 0, g: 255, b: 0, a: 255 },
    { r: 0, g: 0, b: 255, a: 255 },
];

const DIRECTION_STEPS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
];

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

/** What the per-voxel mesher emits: one entry per exposed face, keyed by direction + voxel, valued by cell. */
function exposedFaces(world: VoxelWorld, cullBottomFaces: boolean): Map<string, number> {
    const faces = new Map<string, number>();
    world.forEachVoxel((x, y, z, colorIndex) => {
        for (let d = 0; d < 6; d++) {
            if (cullBottomFaces && d === 3 && y === 0) continue;
            const [sx, sy, sz] = DIRECTION_STEPS[d];
            if (!world.hasVoxel(x + sx, y + sy, z + sz)) faces.set(`${d}:${x},${y},${z}`, colorIndex + 1);
        }
    });
    return faces;
}

/** Unit faces covered by the greedy quads; fails on any overlap. */
function coveredFaces(world: VoxelWorld, cullBottomFaces: boolean): Map<string, number> {
    const { quads, count } = greedyQuads(world, cullBottomFaces);
    const faces = new Map<string, number>();
    const p = [0, 0, 0];
    for (let q = 0; q < count; q++) {
        const at = q * GREEDY_QUAD_STRIDE;
        const [d, slice, u0, v0, w, h, cell] = quads.subarray(at, at + GREEDY_QUAD_STRIDE);
        const axis = d >> 1;
        const [uAxis, vAxis] = sliceAxes(axis);
        for (let dv = 0; dv < h; dv++) {
            for (let du = 0; du < w; du++) {
                p[axis] = slice;
                p[uAxis] = u0 + du;
                p[vAxis] = v0 + dv;
                const key = `${d}:${p[0]},${p[1]},${p[2]}`;
                assert.ok(!faces.has(key), `quads overlap at ${key}`);
                faces.set(key, cell);
            }
        }
    }
    return faces;
}

function randomWorld(seed: number, sx: number, sy: number, sz: number, fill: number): VoxelWorld {
    const next = rng(seed);
    const world = new VoxelWorld({ x: sx, y: sy, z: sz });
    for (let z = 0; z < sz; z++) {
        for (let y = 0; y < sy; y++) {
            for (let x = 0; x < sx; x++) {
                if (next() < fill) world.setVoxel(x, y, z, Math.floor(next() * PALETTE.length));
            }
        }
    }
    return world;
}

function terrainWorld(seed: number, sx: number, sy: number, sz: number): VoxelWorld {
    const next = rng(seed);
    const world = new VoxelWorld({ x: sx, y: sy, z: sz });
    for (let z = 0; z < sz; z++) {
        for (let x = 0; x < sx; x++) {
            const h = 1 + Math.floor(next() * sy);
            const colour = Math.floor(next() * 2);
            for (let y = 0; y < h; y++) world.setVoxel(x, y, z, colour);
        }
    }
    return world;
}

function vertex(positions: Float32Array, i: number): [number, number, number] {
    return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
}

test('greedy quads cover exactly the exposed faces, with matching colours and no overlaps', () => {
    const worlds = [
        randomWorld(1, 7, 5, 6, 0.5),
        randomWorld(2, 9, 4, 3, 0.85),
        randomWorld(3, 4, 8, 5, 0.2),
        terrainWorld(4, 12, 6, 10),
    ];
    for (const world of worlds) {
        for (const cull of [false, true]) {
            assert.deepEqual(coveredFaces(world, cull), exposedFaces(world, cull));
        }
    }
});

test('a single voxel gives the same six unit faces as the per-voxel mesher', () => {
    const world = new VoxelWorld({ x: 1, y: 1, z: 1 });
    world.setVoxel(0, 0, 0, 1);
    const mesh = greedyMesh(world, PALETTE, false, true);

    assert.equal(mesh.quadCount, 6);
    assert.deepEqual(Array.from(mesh.positions), Array.from(FACE_CORNERS));
    for (let q = 0; q < 6; q++) {
        for (let corner = 0; corner < 4; corner++) {
            const at = (q * 4 + corner) * 3;
            assert.deepEqual(Array.from(mesh.normals!.subarray(at, at + 3)), Array.from(FACE_NORMALS.subarray(q * 3, q * 3 + 3)));
            assert.deepEqual(Array.from(mesh.colors.subarray(at, at + 3)), [0, 1, 0]);
        }
    }
    assert.deepEqual(Array.from(mesh.indices.subarray(0, 6)), [0, 1, 2, 0, 2, 3]);
});

test('a solid one-colour box becomes six quads that keep the original winding', () => {
    const [sx, sy, sz] = [3, 2, 4];
    const world = new VoxelWorld({ x: sx, y: sy, z: sz });
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) world.setVoxel(x, y, z, 2);

    const mesh = greedyMesh(world, PALETTE, false, true);
    assert.equal(mesh.quadCount, 6);
    assert.deepEqual(mesh.bounds, { minX: 0, maxX: sx, minY: 0, maxY: sy, minZ: 0, maxZ: sz });

    const size = [sx, sy, sz];
    const directions = new Set<number>();
    for (let q = 0; q < 6; q++) {
        const [a, b, c] = [0, 1, 2].map((k) => vertex(mesh.positions, mesh.indices[q * 6 + k]));
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];

        const n = Array.from(mesh.normals!.subarray(q * 12, q * 12 + 3));
        const d = FACE_NORMALS.findIndex((_, i) => i % 3 === 0 && FACE_NORMALS[i] === n[0] && FACE_NORMALS[i + 1] === n[1] && FACE_NORMALS[i + 2] === n[2]) / 3;
        directions.add(d);

        // Triangle winding agrees with the face normal, as computeVertexNormals() would see it.
        assert.ok(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0, `quad ${q} winding disagrees with its normal`);

        // Each quad spans the whole side of the box.
        const axis = d >> 1;
        const [uAxis, vAxis] = sliceAxes(axis);
        const corners = [0, 1, 2, 3].map((k) => vertex(mesh.positions, q * 4 + k));
        const span = (k: number) => Math.max(...corners.map((p) => p[k])) - Math.min(...corners.map((p) => p[k]));
        assert.equal(span(uAxis), size[uAxis]);
        assert.equal(span(vAxis), size[vAxis]);
        assert.equal(span(axis), 0);
    }
    assert.equal(directions.size, 6);
});

test('faces of different colours are never merged', () => {
    const world = new VoxelWorld({ x: 2, y: 1, z: 1 });
    world.setVoxel(0, 0, 0, 0);
    world.setVoxel(1, 0, 0, 1);
    const { count } = greedyQuads(world, false);
    // +X and -X ends: 1 each; +Y, -Y, +Z, -Z: one per colour.
    assert.equal(count, 10);

    world.setVoxel(1, 0, 0, 0);
    assert.equal(greedyQuads(world, false).count, 6);
});

test('cullBottomFaces drops only the downward faces of the bottom layer', () => {
    const box = new VoxelWorld({ x: 2, y: 2, z: 2 });
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) box.setVoxel(x, y, z, 0);
    assert.equal(greedyQuads(box, true).count, 5);

    const floating = new VoxelWorld({ x: 1, y: 2, z: 1 });
    floating.setVoxel(0, 1, 0, 0);
    assert.equal(greedyQuads(floating, true).count, 6);
});

test('an empty world produces no geometry', () => {
    const mesh = greedyMesh(new VoxelWorld({ x: 3, y: 3, z: 3 }), PALETTE, true, false);
    assert.equal(mesh.quadCount, 0);
    assert.equal(mesh.positions.length, 0);
    assert.equal(mesh.normals, null);
    assert.deepEqual(mesh.bounds, { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
});

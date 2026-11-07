import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld } from '../../src/voxel/VoxelWorld.ts';
import { GREEDY_QUAD_STRIDE, greedyQuadsFromCells, sliceAxes } from '../../src/voxel/GreedyMesher.ts';
import type { IGreedyOptions } from '../../src/config/interfaces/interfaces.ts';

const AGGRESSIVE: IGreedyOptions = {
    cullBottomFaces: true,
    coverHiddenFaces: true,
    solidLateralBorders: true,
    tryBothOrientations: true,
};

const STEPS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
];

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

function terrainWorld(seed: number, sx: number, sy: number, sz: number, colours: number): VoxelWorld {
    const next = rng(seed);
    const world = new VoxelWorld({ x: sx, y: sy, z: sz });
    for (let z = 0; z < sz; z++) {
        for (let x = 0; x < sx; x++) {
            const h = 1 + Math.floor(next() * sy);
            const colour = Math.floor(next() * colours);
            for (let y = 0; y < h; y++) world.setVoxel(x, y, z, colour);
        }
    }
    return world;
}

function randomWorld(seed: number, sx: number, sy: number, sz: number, fill: number): VoxelWorld {
    const next = rng(seed);
    const world = new VoxelWorld({ x: sx, y: sy, z: sz });
    for (let z = 0; z < sz; z++) {
        for (let y = 0; y < sy; y++) {
            for (let x = 0; x < sx; x++) {
                if (next() < fill) world.setVoxel(x, y, z, Math.floor(next() * 3));
            }
        }
    }
    return world;
}

/** Is the face of the solid voxel at (x, y, z) in direction d visible, given the options? */
function isVisible(world: VoxelWorld, options: IGreedyOptions, d: number, x: number, y: number, z: number): boolean {
    if (options.cullBottomFaces && d === 3 && y === 0) return false;
    const { x: sx, y: sy, z: sz } = world.getDimensions();
    const [dx, dy, dz] = STEPS[d];
    const nx = x + dx, ny = y + dy, nz = z + dz;
    const outside = nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz;
    if (outside) return !(options.solidLateralBorders && (d >> 1) !== 1);
    return !world.hasVoxel(nx, ny, nz);
}

function run(world: VoxelWorld, options: IGreedyOptions) {
    return greedyQuadsFromCells(world.getCells(), world.getDimensions(), options);
}

/** How many quads cover each (direction, voxel) face, and the cell colour of the quad covering it. */
function coverage(world: VoxelWorld, options: IGreedyOptions) {
    const { quads, count } = run(world, options);
    const covered = new Map<string, { times: number; cell: number }>();
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
                const entry = covered.get(key) ?? { times: 0, cell };
                entry.times++;
                covered.set(key, entry);
            }
        }
    }
    return { covered, count };
}

const WORLDS = [
    terrainWorld(1, 16, 8, 16, 2),
    terrainWorld(2, 12, 6, 9, 3),
    randomWorld(3, 7, 5, 6, 0.5),
    randomWorld(4, 9, 4, 3, 0.85),
];

test('aggressive meshing covers every visible face once, in its own colour', () => {
    for (const world of WORLDS) {
        const { covered } = coverage(world, AGGRESSIVE);
        world.forEachVoxel((x, y, z, colorIndex) => {
            for (let d = 0; d < 6; d++) {
                if (!isVisible(world, AGGRESSIVE, d, x, y, z)) continue;
                const entry = covered.get(`${d}:${x},${y},${z}`);
                assert.ok(entry, `face ${d} of ${x},${y},${z} is not covered`);
                assert.equal(entry.times, 1, `face ${d} of ${x},${y},${z} is covered ${entry.times} times`);
                assert.equal(entry.cell, colorIndex + 1);
            }
        });
    }
});

test('aggressive meshing only ever spans faces of solid voxels that nobody can see', () => {
    for (const world of WORLDS) {
        const { covered } = coverage(world, AGGRESSIVE);
        for (const key of covered.keys()) {
            const [d, rest] = key.split(':');
            const [x, y, z] = rest.split(',').map(Number);
            assert.ok(world.hasVoxel(x, y, z), `quad covers empty space at ${key}`);
            if (isVisible(world, AGGRESSIVE, Number(d), x, y, z)) continue;
            // hidden extras are fine, but never the culled bottom layer
            assert.ok(!(Number(d) === 3 && y === 0), `quad covers a culled bottom face at ${key}`);
        }
    }
});

test('aggressive meshing never emits more quads than exact meshing, and fewer on terrain', () => {
    let exactTotal = 0;
    let aggressiveTotal = 0;
    for (const world of WORLDS) {
        const exact = run(world, { ...AGGRESSIVE, coverHiddenFaces: false, solidLateralBorders: false, tryBothOrientations: false });
        const aggressive = run(world, AGGRESSIVE);
        assert.ok(aggressive.count <= exact.count, `${aggressive.count} > ${exact.count}`);
        exactTotal += exact.count;
        aggressiveTotal += aggressive.count;
    }
    assert.ok(aggressiveTotal < exactTotal);
});

test('hidden faces let one rectangle span a face a neighbour would otherwise split', () => {
    // A 5-wide wall one voxel thick; the middle voxel has a solid voxel behind it, so its +Z face is hidden.
    const world = new VoxelWorld({ x: 5, y: 1, z: 2 });
    for (let x = 0; x < 5; x++) world.setVoxel(x, 0, 0, 0);
    world.setVoxel(2, 0, 1, 1);

    const options = { cullBottomFaces: false, coverHiddenFaces: false, solidLateralBorders: false, tryBothOrientations: false };
    const split = run(world, options);
    const merged = run(world, { ...options, coverHiddenFaces: true });
    assert.ok(merged.count < split.count);
});

test('border faces of a tiled chunk are dropped when the borders count as solid', () => {
    const world = new VoxelWorld({ x: 4, y: 2, z: 4 });
    for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) world.setVoxel(x, y, z, 0);

    const closed = run(world, { cullBottomFaces: true, coverHiddenFaces: false, solidLateralBorders: true, tryBothOrientations: false });
    // Only the top remains: one quad.
    assert.equal(closed.count, 1);
    assert.equal(closed.quads[0], 2);
});

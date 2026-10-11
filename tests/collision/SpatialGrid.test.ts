import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialGrid } from '../../src/systems/collision/SpatialGrid.ts';

const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

function ids(grid: SpatialGrid, count: number): number[] {
    return Array.from(grid.candidates.slice(0, count)).sort((a, b) => a - b);
}

test('query returns only boxes sharing a cell with the query box', () => {
    const grid = new SpatialGrid(bounds, 10);
    grid.begin();
    const a = grid.insert(-5, -5, 5, 5);
    const b = grid.insert(30, 30, 35, 35);
    grid.build();

    assert.deepEqual(ids(grid, grid.query(-1, -1, 1, 1)), [a]);
    assert.deepEqual(ids(grid, grid.query(31, 31, 32, 32)), [b]);
    assert.equal(grid.query(-40, 30, -35, 35), 0);
});

test('a box spanning many cells is reported once', () => {
    const grid = new SpatialGrid(bounds, 10);
    grid.begin();
    grid.insert(-45, -45, 45, 45);
    grid.build();
    assert.equal(grid.query(-45, -45, 45, 45), 1);
});

test('segment-sized queries find boxes along their path', () => {
    const grid = new SpatialGrid(bounds, 10);
    grid.begin();
    grid.insert(-1, 20, 1, 22);
    grid.build();
    assert.equal(grid.query(0, -40, 0, 40), 1);
    assert.equal(grid.query(20, -40, 20, 40), 0);
});

test('boxes and queries outside the bounds are clamped into the edge cells', () => {
    const grid = new SpatialGrid(bounds, 10);
    grid.begin();
    const far = grid.insert(500, 500, 510, 510);
    grid.build();
    assert.deepEqual(ids(grid, grid.query(600, 600, 700, 700)), [far]);
    assert.equal(grid.query(-40, -40, -35, -35), 0);
});

test('the grid can be rebuilt each frame and grows past its initial capacity', () => {
    const grid = new SpatialGrid(bounds, 10);
    for (let frame = 0; frame < 3; frame++) {
        grid.begin();
        const count = 200 + frame * 100;
        for (let i = 0; i < count; i++) grid.insert(0, 0, 1, 1);
        grid.build();
        assert.equal(grid.query(0, 0, 1, 1), count);
    }
    grid.begin();
    grid.build();
    assert.equal(grid.query(0, 0, 1, 1), 0);
});

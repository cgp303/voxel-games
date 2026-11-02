import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkLibrary } from '../../../src/world/terrain/ChunkLibrary.ts';
import { TerrainBelt } from '../../../src/world/terrain/TerrainBelt.ts';
import { TerrainTrack } from '../../../src/world/terrain/TerrainTrack.ts';
import { createTerrainStyle } from '../../../src/world/terrain/TerrainStyle.ts';
import { visibleGroundRange } from '../../../src/world/terrain/visibleGroundRange.ts';
import { makeChunk } from './helpers.ts';

/**
 * 2 columns x 3 rows. Chunk (col, row) is flat at height 4 + col + row... except for a 7 high pillar at
 * local (5, 9) of the chunk in column 1, row 1 so lookups can be checked to the voxel.
 */
function setup(cols = 2) {
    const library = new ChunkLibrary();
    const ids: number[] = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < cols; col++) {
            const pillar = col === 1 && row === 1;
            ids.push(library.add(makeChunk((x, z) => (pillar && x === 5 && z === 9 ? 7 : 4 + col + row))));
        }
    }
    const style = createTerrainStyle({ name: 'test', cols, rows: 3, ids });
    const track = new TerrainTrack(style);
    return { library, track, belt: new TerrainBelt(library, track, { cols, zBase: 100 }) };
}

test('world X and Z map to the right chunk and voxel', () => {
    const { belt } = setup();
    // belt spans x in [-32, 32); row 1 spans z in [132, 164)
    assert.equal(belt.heightAt(-20, 110), 4); // col 0, row 0
    assert.equal(belt.heightAt(20, 110), 5); // col 1, row 0
    assert.equal(belt.heightAt(-20, 140), 5); // col 0, row 1
    assert.equal(belt.heightAt(5.5, 132 + 9.5), 7); // the pillar: column 1 starts at x = 0
    assert.equal(belt.heightAt(5.5, 132 + 10.5), 6); // beside the pillar
});

test('outside the belt there is no ground', () => {
    const { belt } = setup();
    assert.equal(belt.heightAt(-33, 110), -Infinity);
    assert.equal(belt.heightAt(32, 110), -Infinity);
    assert.equal(belt.heightAt(0, 99), -Infinity); // before row 0
});

test('scrolling moves the ground toward -Z and rows keep their chunks', () => {
    const { belt } = setup();
    assert.equal(belt.heightAt(5.5, 132 + 9.5), 7);
    belt.advance(50);
    assert.equal(belt.heightAt(5.5, 132 + 9.5 - 50), 7);
    assert.equal(belt.rowMinZ(1), 132 - 50);
    assert.equal(belt.rowAt(132 - 50 + 1), 1);
    belt.advance(-10);
    assert.equal(belt.travelled, 50, 'the ground never scrolls backwards');
});

test('past the last row the track keeps supplying rows', () => {
    const { belt } = setup();
    assert.equal(belt.heightAt(-20, 100 + 3 * 32 + 5), 4); // row 3 wraps to row 0
    assert.equal(belt.heightAt(-20, 100 + 4 * 32 + 5), 5); // row 4 wraps to row 1
});

test('the gradient is measured across chunk borders and is zero outside', () => {
    const { belt } = setup();
    const out = { x: 0, z: 0 };
    // Border voxels are 3 high, interiors 4. x = -1.5 is voxel 30 of column 0; the voxel east of it is the border.
    belt.gradientAt(-1.5, 110, out);
    assert.equal(out.x, -0.5);
    assert.equal(out.z, 0);
    // Across the border between column 0 and column 1 (height 4 and 5 inside, 3 on both border voxels).
    belt.gradientAt(1.5, 110, out);
    assert.equal(out.x, (5 - 3) / 2);
    belt.gradientAt(100, 110, out);
    assert.deepEqual(out, { x: 0, z: 0 });
    // At the belt's edge the missing neighbour is replaced by the column itself.
    belt.gradientAt(-31.5, 110, out);
    assert.equal(out.x, (4 - 3) / 2);
});

test('rows are found from world Z', () => {
    const { belt } = setup();
    assert.equal(belt.rowAt(100), 0);
    assert.equal(belt.rowAt(131.9), 0);
    assert.equal(belt.rowAt(90), -1);
    assert.equal(belt.rowAt(170), 2);
});

// The game's camera: 80 degree vertical field of view, square, 78 up, 172 behind the origin, looking at (0, -50, 0).
function gameView() {
    const origin = { x: 0, y: 78.1, z: -172.3 };
    const target = { x: 0, y: -50, z: 0 };
    const f = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
    const len = Math.hypot(f.x, f.y, f.z);
    const forward = { x: f.x / len, y: f.y / len, z: f.z / len };
    const right = { x: -1, y: 0, z: 0 }; // looking along +Z, screen right is world -X
    const up = {
        x: right.y * forward.z - right.z * forward.y,
        y: right.z * forward.x - right.x * forward.z,
        z: right.x * forward.y - right.y * forward.x,
    };
    const tan = Math.tan((80 / 2) * (Math.PI / 180));
    return { origin, right, up, forward, tanHalfFovX: tan, tanHalfFovY: tan };
}

test('the visible ground for the game camera runs from just ahead of it out to the fog depth', () => {
    const view = gameView();
    assert.ok(view.up.y > 0, 'camera up points up');
    const range = visibleGroundRange(view, 0, 8, 750)!;
    assert.ok(range.min > -175 && range.min < -140, `near edge ${range.min}`);
    // The far edge is where the view-depth reaches the fog distance, further in Z than the euclidean distance would be.
    assert.ok(range.max > 650 && range.max < 760, `far edge ${range.max}`);
});

test('a shorter fog distance shortens the visible range', () => {
    const view = gameView();
    const far = visibleGroundRange(view, 0, 8, 750)!;
    const near = visibleGroundRange(view, 0, 8, 300)!;
    assert.equal(near.min, far.min);
    assert.ok(near.max < far.max - 300);
});

test('looking straight up shows no ground', () => {
    const view = gameView();
    view.forward = { x: 0, y: 1, z: 0 };
    view.up = { x: 0, y: 0, z: -1 };
    assert.equal(visibleGroundRange(view, 0, 8, 750), null);
});

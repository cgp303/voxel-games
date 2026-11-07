import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkField } from '../../../src/world/terrain/ChunkField.ts';
import { ChunkLibrary } from '../../../src/world/terrain/ChunkLibrary.ts';
import { TerrainTrack } from '../../../src/world/terrain/TerrainTrack.ts';
import { createTerrainStyle } from '../../../src/world/terrain/TerrainStyle.ts';
import { makeChunk } from './helpers.ts';

const COLS = 3;
const MAX_ROWS = 6;

function setup() {
    // A flat zero-height border lets a chunk be completely empty.
    const library = new ChunkLibrary(new Array(32).fill(0));
    const options = { edgeHeight: 0 };
    const bump = library.add(makeChunk((x, z) => 3 + ((x + z) % 4), options));
    const flat = library.add(makeChunk(() => 3, options));
    const empty = library.add(makeChunk(() => 0, options));
    return { library, bump, flat, empty };
}

function visibleInstances(field: ChunkField): number {
    let count = 0;
    for (let i = 0; i < COLS * MAX_ROWS; i++) if (field.mesh.getVisibleAt(i)) count++;
    return count;
}

function worldZOfInstance(field: ChunkField, instance: number): number {
    const matrix = new (field.mesh.matrixWorld.constructor as new () => { elements: number[] })();
    field.mesh.getMatrixAt(instance, matrix as never);
    return field.mesh.position.z + matrix.elements[14];
}

test('only the rows overlapping the visible range are built', () => {
    const { library, bump } = setup();
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols: COLS, rows: 4, ids: new Array(COLS * 4).fill(bump) }));
    const field = new ChunkField(library, track, { cols: COLS, maxRows: MAX_ROWS, zBase: 0 });

    field.update(0, { min: 10, max: 100 }, 0); // rows 0..3
    assert.equal(visibleInstances(field), COLS * 4);
    assert.equal(track.nextRow, 5, 'rows 0..3 are shown and row 4 is fixed too, since it decides how row 3 is meshed');

    field.update(0, null, 0);
    assert.equal(visibleInstances(field), 0);
});

test('the window is capped at maxRows', () => {
    const { library, bump } = setup();
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols: COLS, rows: 4, ids: new Array(COLS * 4).fill(bump) }));
    const field = new ChunkField(library, track, { cols: COLS, maxRows: MAX_ROWS, zBase: 0 });
    field.update(0, { min: 0, max: 10000 }, 0);
    assert.equal(visibleInstances(field), COLS * MAX_ROWS);
});

test('scrolling a row recycles the row that left for the one entering at the far end', () => {
    const { library, bump, flat } = setup();
    // row r holds chunk `bump` for even rows and `flat` for odd rows
    const ids: number[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) ids.push(r % 2 === 0 ? bump : flat);
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols: COLS, rows: 4, ids }));
    const field = new ChunkField(library, track, { cols: COLS, maxRows: MAX_ROWS, zBase: 0 });
    const range = { min: 0, max: 95 }; // fixed view in world Z: three rows at a time

    field.update(0, range, 0);
    assert.equal(visibleInstances(field), COLS * 3);
    const geometryBefore = field.mesh.getGeometryIdAt(0);

    field.update(32, range, 0); // one whole row has scrolled by
    assert.equal(visibleInstances(field), COLS * 3);
    // world Z of the rows now shown: rows 1..3 at -0, 32, 64 relative... row 1 starts at 0 again
    const zs = new Set<number>();
    for (let i = 0; i < COLS * MAX_ROWS; i++) if (field.mesh.getVisibleAt(i)) zs.add(worldZOfInstance(field, i));
    assert.deepEqual([...zs].sort((a, b) => a - b), [0, 32, 64]);
    assert.equal(field.belt.rowAt(0), 1);
    assert.notEqual(field.mesh.getGeometryIdAt(0), -1);
    assert.ok(geometryBefore >= 0);
    assert.equal(track.nextRow, 5);
});

test('part of a row of scroll only moves the mesh', () => {
    const { library, bump } = setup();
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols: COLS, rows: 4, ids: new Array(COLS * 4).fill(bump) }));
    const field = new ChunkField(library, track, { cols: COLS, maxRows: MAX_ROWS, zBase: 0 });
    field.update(0, { min: 0, max: 60 }, 0);
    const start = field.mesh.position.z;
    field.update(10, { min: 0, max: 60 }, 0);
    assert.equal(field.mesh.position.z, start - 10);
});

test('chunks with nothing to draw stay hidden, and identical chunks share one geometry', () => {
    const { library, flat, empty } = setup();
    const ids = [flat, empty, flat, flat, flat, empty];
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols: COLS, rows: 2, ids }));
    const field = new ChunkField(library, track, { cols: COLS, maxRows: MAX_ROWS, zBase: 0 });
    field.update(0, { min: 0, max: 60 }, 0);

    assert.equal(visibleInstances(field), 4);
    const shared = new Set<number>();
    for (let i = 0; i < COLS * 2; i++) if (field.mesh.getVisibleAt(i)) shared.add(field.mesh.getGeometryIdAt(i));
    assert.equal(shared.size, 1);
});

test('the batch grows its buffers when more geometry is shown than it was sized for', () => {
    const library = new ChunkLibrary();
    const ids: number[] = [];
    for (let i = 0; i < COLS * 4; i++) {
        // distinct interiors so every chunk has its own geometry (a few hundred quads each)
        ids.push(library.add(makeChunk((x, z) => 3 + ((x * 7 + z * 3 + i) % 5))));
    }
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols: COLS, rows: 4, ids }));
    const field = new ChunkField(library, track, { cols: COLS, maxRows: MAX_ROWS, zBase: 0 });
    field.update(0, { min: 0, max: 127 }, 0);
    assert.equal(visibleInstances(field), COLS * 4);
    const distinct = new Set<number>();
    for (let i = 0; i < COLS * 4; i++) distinct.add(field.mesh.getGeometryIdAt(i));
    assert.equal(distinct.size, COLS * 4);
});

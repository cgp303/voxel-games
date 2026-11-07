import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_CELLS, CHUNK_X, ChunkLibrary } from '../../../src/world/terrain/ChunkLibrary.ts';
import { makeChunk } from './helpers.ts';

test('a chunk with the neutral border is accepted and meshed', () => {
    const library = new ChunkLibrary();
    const id = library.add(makeChunk(() => 5, { name: 'plateau' }));
    const entry = library.get(id);
    assert.equal(entry.name, 'plateau');
    assert.ok(entry.buffers.quadCount > 0);
    assert.ok(entry.buffers.normals);
    assert.equal(library.size, 1);
});

test('ground heights are the top of each column, border included', () => {
    const library = new ChunkLibrary();
    const entry = library.get(library.add(makeChunk((x, z) => (x === 10 && z === 12 ? 7 : 4))));
    assert.equal(entry.heights[10 + 12 * CHUNK_X], 7);
    assert.equal(entry.heights[11 + 12 * CHUNK_X], 4);
    assert.equal(entry.heights[0], 3);
    assert.equal(entry.heights[CHUNK_X * CHUNK_X - 1], 3);
});

test('a chunk whose border differs from the edge profile is rejected', () => {
    const library = new ChunkLibrary();
    assert.throws(() => library.add(makeChunk(() => 4, { edgeHeight: 5, name: 'tall edge' })), /tall edge.*edge profile/);
});

test('an overhang on the border is rejected even when its height matches', () => {
    const library = new ChunkLibrary();
    const chunk = makeChunk(() => 4);
    // lift the border voxel at y=1 on x=0, z=5 into y=6 (a floating cell)
    chunk.cells[0 + 1 * CHUNK_X + 5 * CHUNK_X * 8] = 0;
    chunk.cells[0 + 6 * CHUNK_X + 5 * CHUNK_X * 8] = 1;
    assert.throws(() => library.add(chunk), /edge profile/);
});

test('a chunk with the wrong number of cells is rejected', () => {
    const library = new ChunkLibrary();
    assert.throws(() => library.add({ cells: new Uint16Array(CHUNK_CELLS - 1), palette: [] }), /needs 8192 cells/);
});

test('a custom edge profile is honoured and must close on itself', () => {
    const profile = Array.from({ length: CHUNK_X }, (_, i) => 2 + (i % 3 === 0 ? 1 : 0));
    profile[CHUNK_X - 1] = profile[0];
    const library = new ChunkLibrary(profile);
    assert.deepEqual(Array.from(library.edgeProfile), profile);
    // the flat-border helper chunk no longer fits this profile
    assert.throws(() => library.add(makeChunk(() => 4)), /edge profile/);

    const open = profile.slice();
    open[CHUNK_X - 1] = open[0] + 1;
    assert.throws(() => new ChunkLibrary(open), /same height/);
});

test('border faces are not emitted, so a flat chunk is a single top quad', () => {
    const library = new ChunkLibrary();
    const flat = library.get(library.add(makeChunk(() => 3)));
    assert.equal(flat.buffers.quadCount, 1);
});

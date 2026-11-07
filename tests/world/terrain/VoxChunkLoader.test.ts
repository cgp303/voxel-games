import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js';
import { ChunkLibrary, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../../../src/world/terrain/ChunkLibrary.ts';
import { chunkFromVoxModel } from '../../../src/world/terrain/VoxChunkLoader.ts';
import { buildHandAuthoredStyle } from '../../../src/world/terrain/HandAuthoredStyle.ts';
import { ChunkField } from '../../../src/world/terrain/ChunkField.ts';
import { TerrainTrack } from '../../../src/world/terrain/TerrainTrack.ts';
import { createTerrainStyle } from '../../../src/world/terrain/TerrainStyle.ts';
import type { IParsedVoxModel } from '../../../src/config/interfaces/interfaces.ts';
import { makeChunk } from './helpers.ts';

const PALETTE = [{ r: 10, g: 20, b: 30, a: 255 }];

function model(voxels: Array<[number, number, number, number]>, size = { x: CHUNK_X, y: CHUNK_Y, z: CHUNK_Z }): IParsedVoxModel {
    return { size, voxels: voxels.map(([x, y, z, colorIndex]) => ({ x, y, z, colorIndex })), colors: PALETTE };
}

/** The shipped tile, parsed the way VoxParser does (the loader's output is the same shape). */
function shippedTile(): IParsedVoxModel {
    const file = readFileSync('public/assets/vox/terrains/ataria-1/ataria-1-1.vox');
    const parsed = new VOXLoader().parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    const chunk = parsed.chunks[0];
    const voxels: IParsedVoxModel['voxels'] = [];
    for (let i = 0; i < chunk.data.length; i += 4) {
        voxels.push({ x: chunk.data[i], y: chunk.data[i + 1], z: chunk.data[i + 2], colorIndex: chunk.data[i + 3] });
    }
    const colors = chunk.palette.map((c: number) => ({ r: c & 255, g: (c >>> 8) & 255, b: (c >>> 16) & 255, a: (c >>> 24) & 255 }));
    return { size: chunk.size, voxels, colors };
}

test('a 32 x 8 x 32 model becomes an open chunk with its voxels and palette', () => {
    const chunk = chunkFromVoxModel(model([[3, 7, 5, 0], [4, 7, 5, 0]]), 'tile');
    assert.equal(chunk.name, 'tile');
    assert.equal(chunk.borders, 'open');
    assert.equal(chunk.palette, PALETTE);
    assert.equal(chunk.cells[3 + 7 * CHUNK_X + 5 * CHUNK_X * CHUNK_Y], 1);
    assert.equal(chunk.cells.reduce((n, c) => n + (c ? 1 : 0), 0), 2);
});

test('a model of the wrong size is rejected with the axis convention in the message', () => {
    assert.throws(() => chunkFromVoxModel(model([], { x: 32, y: 32, z: 8 }), 'tall'), /tall is 32 x 32 x 8.*file y up/);
});

test('an open chunk may have any borders, floating voxels included', () => {
    const library = new ChunkLibrary();
    const id = library.add(chunkFromVoxModel(model([[10, 7, 0, 0], [10, 7, 31, 0]]), 'floating'));
    const entry = library.get(id);
    assert.equal(entry.sealed, false);
    assert.equal(entry.heights[10 + 0 * CHUNK_X], 8, 'a floating voxel at the top makes its column 8 high');
    assert.equal(entry.heights[11], 0);
    assert.equal(library.openBuffers(id), entry.buffers);
});

test('downward faces are never emitted, so a floating voxel is five faces', () => {
    const library = new ChunkLibrary();
    const entry = library.get(library.add(chunkFromVoxModel(model([[10, 7, 10, 0]]), 'one')));
    assert.equal(entry.buffers.quadCount, 5);
});

test('the shipped ataria-1 tile loads as a chunk', () => {
    const library = new ChunkLibrary();
    const tile = shippedTile();
    const entry = library.get(library.add(chunkFromVoxModel(tile, 'ataria-1-1')));
    assert.ok(tile.voxels.length > 0);
    assert.equal(entry.sealed, false);
    assert.ok(entry.buffers.quadCount > 0);
    assert.ok(entry.buffers.quadCount < tile.voxels.length * 5, 'faces merge into larger quads');
});

test('a hand-authored style places each tile once and wraps its grid', () => {
    const library = new ChunkLibrary();
    const models = { a: model([[1, 7, 1, 0]]), b: model([[2, 7, 2, 0]]) };
    const style = buildHandAuthoredStyle(library, { name: 'hand', tiles: ['a', 'b'], grid: [[0, 1], [1, 0], [0, 0]], introRows: 1, loopStartRow: 1 }, models);
    assert.equal(style.cols, 2);
    assert.equal(style.rows, 3);
    assert.equal(library.size, 2);
    assert.deepEqual(Array.from(style.ids), [0, 1, 1, 0, 0, 0]);
    assert.equal(style.introRows, 1);
});

test('hand-authored style specs are checked', () => {
    const library = new ChunkLibrary();
    const models = { a: model([]) };
    const spec = { name: 'bad', tiles: ['a'], grid: [[0]] };
    assert.throws(() => buildHandAuthoredStyle(library, { ...spec, grid: [] }, models), /at least one row/);
    assert.throws(() => buildHandAuthoredStyle(library, { ...spec, grid: [[0, 0], [0]] }, models), /row 1 has 1 columns/);
    assert.throws(() => buildHandAuthoredStyle(library, { ...spec, grid: [[1]] }, models), /uses tile 1/);
    assert.throws(() => buildHandAuthoredStyle(library, { ...spec, tiles: ['missing'] }, models), /"missing" has not been loaded/);
});

test('a neutral chunk keeps its border faces beside an open chunk and drops them beside neutral ones', () => {
    const library = new ChunkLibrary();
    const neutral = library.add(makeChunk(() => 5, { name: 'neutral' }));
    const open = library.add(chunkFromVoxModel(model([[10, 7, 10, 0]]), 'open'));
    const sealedVertices = library.get(neutral).buffers.positions.length / 3;
    const openVertices = library.openBuffers(neutral).positions.length / 3;
    assert.ok(openVertices > sealedVertices, 'the open mesh has the border walls');

    // column 0: neutral, neutral, open; row 0 col 0 touches only neutrals, row 1 col 0 touches an open chunk
    const cols = 1;
    const ids = [neutral, neutral, neutral, open];
    const track = new TerrainTrack(createTerrainStyle({ name: 's', cols, rows: 4, ids }));
    const field = new ChunkField(library, track, { cols, maxRows: 6, zBase: 0 });
    field.update(0, { min: 0, max: 127 }, 0);

    const vertexCount = (instance: number) => field.mesh.getGeometryRangeAt(field.mesh.getGeometryIdAt(instance)).vertexCount;
    assert.equal(vertexCount(0), sealedVertices); // row 0: neighbours are row 1 (neutral) and nothing
    assert.equal(vertexCount(1), sealedVertices); // row 1: rows 0 and 2 are neutral
    assert.equal(vertexCount(2), openVertices); // row 2: row 3 is open
    assert.equal(vertexCount(3), library.get(open).buffers.positions.length / 3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProceduralStyle } from '../../../src/world/terrain/ProceduralStyleBuilder.ts';
import { ChunkLibrary, CHUNK_X, CHUNK_Z } from '../../../src/world/terrain/ChunkLibrary.ts';
import { TerrainBelt } from '../../../src/world/terrain/TerrainBelt.ts';
import { TerrainTrack } from '../../../src/world/terrain/TerrainTrack.ts';
import type { IProceduralStyleOptions, ITerrainConfig } from '../../../src/config/interfaces/interfaces.ts';

const CONFIG: ITerrainConfig = {
    width: 0,
    depth: 0,
    maxHeight: 8,
    tileSize: 512,
    noiseScale: 4,
    noiseOctaves: 3,
    noisePersistence: 0.5,
    noiseLacunarity: 2,
    noiseExponent: 1,
    colorBands: [
        { height: 0, color: { r: 0, g: 0, b: 0 } },
        { height: 1, color: { r: 200, g: 100, b: 50 } },
    ],
    seed: 4242,
    enableSlopeVariation: true,
    slopeColorShift: 0.2,
};

function options(overrides: Partial<IProceduralStyleOptions> = {}): IProceduralStyleOptions {
    return { name: 'proc', config: CONFIG, cols: 2, rows: 3, edgeBlend: 4, slopeLevels: 3, ...overrides };
}

test('a procedural style fills a cols x rows id grid from chunks that all fit the border', () => {
    const library = new ChunkLibrary();
    const style = buildProceduralStyle(library, options());
    assert.equal(style.cols, 2);
    assert.equal(style.rows, 3);
    assert.equal(style.ids.length, 6);
    assert.ok(library.size >= 1 && library.size <= 6);
    for (const id of style.ids) assert.ok(id < library.size);
});

test('the same options give the same terrain', () => {
    const a = new ChunkLibrary();
    const b = new ChunkLibrary();
    const styleA = buildProceduralStyle(a, options());
    const styleB = buildProceduralStyle(b, options());
    assert.deepEqual(Array.from(styleA.ids), Array.from(styleB.ids));
    for (let id = 0; id < a.size; id++) assert.deepEqual(Array.from(a.get(id).heights), Array.from(b.get(id).heights));
});

test('different seeds give different terrain', () => {
    const a = new ChunkLibrary();
    const b = new ChunkLibrary();
    buildProceduralStyle(a, options());
    buildProceduralStyle(b, options({ config: { ...CONFIG, seed: 99 } }));
    const heights = (library: ChunkLibrary) => Array.from({ length: library.size }, (_, id) => library.get(id).heights.join());
    assert.notDeepEqual(heights(a), heights(b));
});

test('neighbouring chunks meet at the same height on every shared border', () => {
    const library = new ChunkLibrary();
    const style = buildProceduralStyle(library, options({ cols: 3, rows: 3 }));
    const track = new TerrainTrack(style);
    const belt = new TerrainBelt(library, track, { cols: 3 });
    // wrap-around neighbours included: the style (and so the track) repeats
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 2; col++) {
            const left = library.get(track.idAt(row, col)).heights;
            const right = library.get(track.idAt(row, col + 1)).heights;
            for (let z = 0; z < CHUNK_Z; z++) assert.equal(left[CHUNK_X - 1 + z * CHUNK_X], right[z * CHUNK_X]);
        }
    }
    for (let row = 0; row < 5; row++) {
        const below = library.get(track.idAt(row, 1)).heights;
        const above = library.get(track.idAt(row + 1, 1)).heights;
        for (let x = 0; x < CHUNK_X; x++) assert.equal(below[x + (CHUNK_Z - 1) * CHUNK_X], above[x]);
    }
    assert.ok(Number.isFinite(belt.heightAt(0, 10)));
});

test('fewer slope shades means fewer distinct chunk colours to merge across', () => {
    const shaded = new ChunkLibrary();
    const flat = new ChunkLibrary();
    buildProceduralStyle(shaded, options({ slopeLevels: 5 }));
    buildProceduralStyle(flat, options({ slopeLevels: 1 }));
    const quads = (library: ChunkLibrary) =>
        Array.from({ length: library.size }, (_, id) => library.get(id).buffers.quadCount).reduce((a, b) => a + b, 0);
    assert.ok(quads(flat) <= quads(shaded));
});

test('introRows and the wrap point are passed through', () => {
    const library = new ChunkLibrary();
    const style = buildProceduralStyle(library, options({ rows: 4, introRows: 1, loopStartRow: 2, loopEndRow: 4 }));
    assert.equal(style.introRows, 1);
    assert.equal(style.loopStartRow, 2);
    assert.equal(style.loopEndRow, 4);
});

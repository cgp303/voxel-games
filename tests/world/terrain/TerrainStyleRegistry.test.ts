import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkLibrary, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../../../src/world/terrain/ChunkLibrary.ts';
import { TerrainStyleRegistry } from '../../../src/world/terrain/TerrainStyleRegistry.ts';
import type { IParsedVoxModel, ITerrainConfig, ITerrainStyleDef } from '../../../src/config/interfaces/interfaces.ts';
import type { TerrainStyleId } from '../../../src/config/types/types.ts';

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
    seed: 7,
    enableSlopeVariation: false,
    slopeColorShift: 0,
};

const TILE: IParsedVoxModel = {
    size: { x: CHUNK_X, y: CHUNK_Y, z: CHUNK_Z },
    voxels: [{ x: 4, y: 7, z: 4, colorIndex: 0 }],
    colors: [{ r: 255, g: 0, b: 0, a: 255 }],
};

const DEFS: Record<TerrainStyleId, ITerrainStyleDef> = {
    crystal: { kind: 'procedural', options: { name: 'p1', config: CONFIG, cols: 2, rows: 2, edgeBlend: 4, slopeLevels: 1 } },
    steelBlock: { kind: 'procedural', options: { name: 'p2', config: { ...CONFIG, seed: 8 }, cols: 2, rows: 2, edgeBlend: 4, slopeLevels: 1 } },
    atari: { kind: 'procedural', options: { name: 'p3', config: { ...CONFIG, seed: 9 }, cols: 2, rows: 2, edgeBlend: 4, slopeLevels: 1 } },
    ataria1: { kind: 'handAuthored', spec: { name: 'hand', tiles: ['tile'], grid: [[0, 0]] } },
};

const models = (key: string) => (key === 'tile' ? TILE : undefined);

test('each style is built once, on first use, and shared after that', () => {
    const library = new ChunkLibrary();
    const registry = new TerrainStyleRegistry(library, DEFS, models);
    assert.equal(library.size, 0, 'nothing is built until asked for');

    const first = registry.get('crystal');
    const afterFirst = library.size;
    assert.ok(afterFirst > 0);
    assert.equal(registry.get('crystal'), first, 'the same style object comes back');
    assert.equal(library.size, afterFirst, 'no chunks are added a second time');
});

test('every style comes from the same chunk library', () => {
    const library = new ChunkLibrary();
    const registry = new TerrainStyleRegistry(library, DEFS, models);
    registry.buildAll();
    for (const id of Object.keys(DEFS) as TerrainStyleId[]) {
        for (const chunk of registry.get(id).ids) assert.ok(chunk < library.size, `${id} uses chunk ${chunk}`);
    }
    assert.equal(registry.get('ataria1').name, 'hand');
    assert.equal(registry.get('ataria1').cols, 2);
});

test('a hand-authored style with a tile that was not loaded says which', () => {
    const registry = new TerrainStyleRegistry(new ChunkLibrary(), DEFS, () => undefined);
    assert.throws(() => registry.get('ataria1'), /tile model "tile".*not loaded/);
});

test('an unknown style id is rejected', () => {
    const registry = new TerrainStyleRegistry(new ChunkLibrary(), DEFS, models);
    assert.throws(() => registry.get('nope' as TerrainStyleId), /no terrain style "nope"/);
});

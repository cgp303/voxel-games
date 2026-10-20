import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js';
import { parseBossDefinition, toBossSpace } from '../../src/systems/boss/BossDefinition.ts';
import { DestructibleVoxelModel } from '../../src/systems/boss/DestructibleVoxelModel.ts';
import { DestructibleCollisionModels } from '../../src/systems/boss/DestructibleCollisionModels.ts';
import { clipSegmentToBox, traceSegmentThroughMask } from '../../src/systems/collision/segmentTests.ts';

const FOLDER = 'public/assets/vox/bosses/boss1/';
const WEAPONS = ['BossLazerA', 'BossLazerB', 'Missile'];

function loadVox(name: string) {
    const bytes = readFileSync(FOLDER + name);
    const chunk = new VOXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).chunks[0];
    const voxels = [];
    for (let i = 0; i < chunk.data.length; i += 4) {
        voxels.push({ x: chunk.data[i], y: chunk.data[i + 1], z: chunk.data[i + 2], colorIndex: chunk.data[i + 3] });
    }
    return toBossSpace({ size: chunk.size, voxels, colors: [] });
}

const definition = parseBossDefinition(JSON.parse(readFileSync(FOLDER + 'boss1.json', 'utf8')), WEAPONS);

test('boss1.json is a valid definition', () => {
    assert.equal(definition.id, 'boss1');
    assert.equal(definition.parts.length, 6);
    assert.equal(definition.weapons.length, 3);
});

test('the boss model matches the declared size once its axes are swapped', () => {
    const model = loadVox('boss1.vox');
    assert.deepEqual(model.size, definition.size);
});

test('every weapon names a model that exists, spelt exactly (case matters on a real web server)', () => {
    const files = readdirSync(FOLDER);
    for (const weapon of definition.weapons) {
        assert.ok(files.includes(`${weapon.asset}.vox`), `${weapon.asset}.vox`);
    }
});

test('every part has voxels, the eye is behind armour, and shots dig toward it as parts are destroyed', () => {
    const model = new DestructibleVoxelModel(definition, loadVox('boss1.vox').voxels);
    for (const part of definition.parts) assert.ok(model.parts[model.indexOf(part.id)].columns.length > 0, part.id);
    assert.ok(model.parts.some((p) => p.hull), 'the armour is tiled');
    assert.equal(model.parts[model.coreIndex].id, 'eye');

    const models = new DestructibleCollisionModels(model, 2);
    const eyeX = 15.5 - 16; // local x of the eye's columns (x 15..16 -> centre 16 -> local 0)
    const stop = (): number => {
        const bucket = models.get(2).buckets[0];
        const slab = { tEnter: 0, tExit: 1 };
        const x = eyeX + 0.5;
        assert.ok(clipSegmentToBox(x, -60, x, 60, bucket.minX, bucket.minZ, bucket.maxX, bucket.maxZ, slab));
        const hit = { t: 0 };
        if (!traceSegmentThroughMask(bucket, x, -60, x, 60, slab.tEnter, slab.tExit, hit)) return Infinity;
        return -60 + 120 * hit.t;
    };

    const eyeFrontLocalZ = 22 - 16; // the eye starts at model z 22
    const first = stop();
    assert.ok(first < eyeFrontLocalZ - 2, `a shot along the eye's lane stops in the armour first (z ${first})`);

    // Shoot the lane's armour away, front to back, until the eye is exposed.
    let guard = 0;
    while (stop() < eyeFrontLocalZ - 2.5 && guard++ < 40) {
        const z = stop();
        const part = model.nearestPart(eyeX + 0.5, z, 3);
        assert.ok(part >= 0 && part !== model.coreIndex, 'something in front of the eye to destroy');
        model.damage(part, 99);
    }
    assert.ok(guard < 40);
    const exposed = model.nearestPart(eyeX + 0.5, stop(), 3);
    assert.equal(exposed, model.coreIndex, 'the lane now ends at the eye');
    assert.equal(model.damage(model.coreIndex, 99).coreDestroyed, true);
});

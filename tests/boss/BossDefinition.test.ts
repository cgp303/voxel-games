import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBossDefinition, toBossSpace } from '../../src/systems/boss/BossDefinition.ts';

const WEAPONS = ['BossLazerA', 'BossLazerB', 'Missile'];

function validJson(): Record<string, any> {
    return {
        id: 'testboss',
        vox: 'assets/vox/bosses/testboss/testboss.vox',
        size: { x: 16, y: 3, z: 16 },
        scoreValue: 100,
        hull: { tile: { w: 4, d: 4 }, hits: 2 },
        parts: [
            { id: 'eye', rects: [[7, 12, 8, 14]], hits: 3, role: 'core' },
            { id: 'canL', rects: [[0, 2, 2, 10]], hits: 4 },
        ],
        weapons: [
            {
                id: 'main', weapon: 'BossLazerA', asset: 'lazer', sync: true, rate: 0.5, speed: 200,
                phases: ['attack'],
                mounts: [{ muzzle: { x: 1, y: 1, z: 2 }, disabledBy: ['canL'] }],
            },
        ],
        cycle: [{ phase: 'attack', seconds: [4, 6] }, { phase: 'rest', seconds: [3, 4] }],
        movement: { path: 'p', durationSec: 10, maxRollRad: 0.2, rollGain: 0.02 },
        fx: { chunks: true, drip: false },
    };
}

test('a valid definition is parsed and typed', () => {
    const def = parseBossDefinition(validJson(), WEAPONS);
    assert.equal(def.id, 'testboss');
    assert.deepEqual(def.parts[0].rects[0], [7, 12, 8, 14]);
    assert.equal(def.parts[0].role, 'core');
    assert.equal(def.weapons[0].sync, true);
    assert.deepEqual(def.cycle[1].seconds, [3, 4]);
    assert.equal(def.fx.drip, false);
});

test('missing optional fields get defaults', () => {
    const json = validJson();
    delete json.fx;
    delete json.weapons[0].sync;
    delete json.weapons[0].speed;
    const def = parseBossDefinition(json, WEAPONS);
    assert.deepEqual(def.fx, { chunks: false, drip: false });
    assert.equal(def.weapons[0].sync, false);
    assert.equal(def.weapons[0].speed, undefined);
});

const bad: Array<[string, (j: Record<string, any>) => void, RegExp]> = [
    ['no core', (j) => { delete j.parts[0].role; }, /exactly one part must have role "core"/],
    ['two cores', (j) => { j.parts[1].role = 'core'; }, /exactly one part must have role "core"/],
    ['two anchors', (j) => { j.parts[0].role = 'anchor'; j.parts[1].role = 'anchor'; }, /core|anchor/],
    ['duplicate part id', (j) => { j.parts[1].id = 'eye'; }, /duplicate part id/],
    ['overlapping parts', (j) => { j.parts[1].rects = [[6, 11, 9, 13]]; }, /overlap/],
    ['rect outside model', (j) => { j.parts[1].rects = [[0, 2, 2, 16]]; }, /outside/],
    ['inverted rect', (j) => { j.parts[1].rects = [[5, 2, 2, 10]]; }, /x0 <= x1/],
    ['zero hits', (j) => { j.parts[1].hits = 0; }, /parts\[1\]\.hits/],
    ['unknown weapon', (j) => { j.weapons[0].weapon = 'Plasma'; }, /unknown weapon/],
    ['unknown disabledBy part', (j) => { j.weapons[0].mounts[0].disabledBy = ['nope']; }, /unknown part "nope"/],
    ['muzzle outside model', (j) => { j.weapons[0].mounts[0].muzzle.y = 3; }, /muzzle/],
    ['no mounts', (j) => { j.weapons[0].mounts = []; }, /at least one mount/],
    ['bad phase', (j) => { j.weapons[0].phases = ['sleep']; }, /phases\[0\]/],
    ['non-positive rate', (j) => { j.weapons[0].rate = 0; }, /rate/],
    ['empty cycle', (j) => { j.cycle = []; }, /cycle/],
    ['cycle range backwards', (j) => { j.cycle[0].seconds = [6, 4]; }, /seconds\[1\]/],
    ['fractional size', (j) => { j.size.x = 16.5; }, /size\.x/],
    ['missing movement', (j) => { delete j.movement; }, /movement/],
];

for (const [name, mutate, message] of bad) {
    test(`rejects: ${name}`, () => {
        const json = validJson();
        mutate(json);
        assert.throws(() => parseBossDefinition(json, WEAPONS), message);
    });
}

test('errors name the boss', () => {
    const json = validJson();
    json.weapons[0].weapon = 'Plasma';
    assert.throws(() => parseBossDefinition(json, WEAPONS), /Boss "testboss"/);
});

test('toBossSpace swaps file y and z (height) like the font', () => {
    const out = toBossSpace({
        size: { x: 32, y: 30, z: 5 },
        voxels: [{ x: 3, y: 20, z: 4, colorIndex: 7 }],
        colors: [],
    });
    assert.deepEqual(out.size, { x: 32, y: 5, z: 30 });
    assert.deepEqual(out.voxels[0], { x: 3, y: 4, z: 20, colorIndex: 7 });
});

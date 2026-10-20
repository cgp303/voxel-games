import test from 'node:test';
import assert from 'node:assert/strict';
import { DestructibleVoxelModel, voxelsToCloud } from '../../src/systems/boss/DestructibleVoxelModel.ts';
import { DestructibleCollisionModels } from '../../src/systems/boss/DestructibleCollisionModels.ts';
import { clipSegmentToBox, traceSegmentThroughMask } from '../../src/systems/collision/segmentTests.ts';
import type { IBossDefinition } from '../../src/config/interfaces/interfaces.ts';

/**
 * A 12 x 2 x 12 slab. z = 0 is the front (nearest the player).
 *   a neck (x 5..6, z 0..10) runs from the front to the core
 *   "front" (x 4..7, z 0..1, hits 3) is the block at the front end of the neck
 *   "eye", the core (x 5..6, z 9..10, hits 2), is at the back end
 *   a wing (x 7..11, z 4..8) is joined to the neck along x = 6 | 7
 * Everything else is hull armour (hits 2, 4 x 4 tiles).
 */
function slab(): { def: IBossDefinition; voxels: { x: number; y: number; z: number; colorIndex: number }[] } {
    const solid = (x: number, z: number): boolean => {
        if (x >= 5 && x <= 6 && z >= 0 && z <= 10) return true; // neck + eye line
        if (x >= 4 && x <= 7 && z <= 1) return true; // front block
        if (x >= 7 && x <= 11 && z >= 4 && z <= 8) return true; // wing, touching the neck at x = 7? (x 7 is next to x 6)
        return false;
    };
    const voxels = [];
    for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) if (solid(x, z)) for (let y = 0; y < 2; y++) voxels.push({ x, y, z, colorIndex: (x + z) % 4 });
    const def: IBossDefinition = {
        id: 'slab', vox: '', size: { x: 12, y: 2, z: 12 }, scoreValue: 10,
        hull: { tile: { w: 4, d: 4 }, hits: 2 },
        parts: [
            { id: 'eye', rects: [[5, 9, 6, 10]], hits: 2, role: 'core' },
            { id: 'front', rects: [[4, 0, 7, 1]], hits: 3 },
        ],
        weapons: [], cycle: [{ phase: 'attack', seconds: [1, 1] }],
        movement: { path: 'p', durationSec: 1, maxRollRad: 0, rollGain: 0 },
        fx: { chunks: true, drip: true },
    };
    return { def, voxels };
}

test('every solid column belongs to exactly one part and hull parts are tiled', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const owned = new Set<number>();
    for (const part of model.parts) {
        for (const column of part.columns) {
            assert.equal(owned.has(column), false, 'column claimed twice');
            owned.add(column);
        }
    }
    assert.equal(owned.size, new Set(voxels.map((v) => v.x + v.z * 12)).size);
    assert.ok(model.parts.some((p) => p.hull));
    for (const part of model.parts.filter((p) => p.hull)) {
        const tiles = new Set(part.columns.map((c) => `${Math.floor((c % 12) / 4)},${Math.floor(Math.floor(c / 12) / 4)}`));
        assert.equal(tiles.size, 1, `${part.id} spans several tiles`);
        assert.equal(part.hitsMax, 2);
    }
    assert.equal(model.parts[model.coreIndex].id, 'eye');
    assert.equal(model.anchorIndex, model.coreIndex);
});

test('a part with no voxels is an error', () => {
    const { def, voxels } = slab();
    def.parts[1].rects = [[0, 11, 0, 11]];
    assert.throws(() => new DestructibleVoxelModel(def, voxels), /covers no voxels/);
});

test('hits are spent until the part is destroyed, then its columns leave the model', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const front = model.indexOf('front');
    const before = model.voxelCount;

    const first = model.damage(front, 1);
    assert.equal(first.destroyed, false);
    assert.equal(model.parts[front].hits, 2);
    assert.equal(model.voxelCount, before);

    model.damage(front, 1);
    const last = model.damage(front, 1);
    assert.equal(last.destroyed, true);
    assert.equal(last.coreDestroyed, false);
    assert.equal(model.isAlive('front'), false);
    assert.equal(last.removed.length, model.parts[front].columns.length * 2);
    assert.equal(model.voxelCount, before - last.removed.length - last.chunk.length);
    assert.equal(model.partAtColumn(4, 0), -1);

    assert.equal(model.damage(front, 1).part, -1, 'a destroyed part cannot be hit again');
});

test('destroying the core kills the boss and cuts nothing off', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const result = model.damage(model.coreIndex, 5);
    assert.equal(result.coreDestroyed, true);
    assert.equal(result.chunk.length, 0);
});

test('a part cut off from the core falls away as a chunk, with its voxels', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    // The neck joins the front block to the eye; destroy the hull tile(s) of the neck and what is beyond falls.
    const neckParts = new Set<number>();
    for (let z = 2; z <= 8; z++) neckParts.add(model.partAtColumn(5, z));
    let detached = 0;
    let chunkVoxels = 0;
    for (const index of neckParts) {
        if (model.parts[index].role === 'core') continue;
        const r = model.damage(index, 99);
        detached += r.detachedParts.length;
        chunkVoxels += r.chunk.length;
    }
    // The front block is no longer connected to the eye through the neck.
    assert.equal(model.isAlive('front'), false);
    assert.ok(detached >= 1);
    assert.ok(chunkVoxels >= 8, 'the front block voxels are in the chunk');
    // The core survives with its own columns.
    assert.equal(model.isAlive('eye'), true);
});

test('an anchor part, when named, is what the rest must stay connected to', () => {
    const { def, voxels } = slab();
    def.parts[1].role = 'anchor';
    const model = new DestructibleVoxelModel(def, voxels);
    assert.equal(model.parts[model.anchorIndex].id, 'front');
    // Destroying the neck leaves both the anchor and the core alive (both are seeds), so neither is cut off.
    for (let z = 2; z <= 8; z++) {
        const index = model.partAtColumn(5, z);
        if (index >= 0 && model.parts[index].hull) model.damage(index, 99);
    }
    assert.equal(model.isAlive('front'), true);
    assert.equal(model.isAlive('eye'), true);
});

test('shots reach deeper as parts are destroyed (the mask follows the damage)', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const models = new DestructibleCollisionModels(model, 2);
    const radius = 1;

    // A shot flying +Z down the middle of the neck (x = 5.5 in model space = local -0.5), from in front of the boss.
    const shoot = (): number => {
        const bucket = models.get(radius).buckets[0];
        const x = 5.5 - 6;
        const slab = { tEnter: 0, tExit: 1 };
        const ax = x, az = -20, bx = x, bz = 20;
        assert.ok(clipSegmentToBox(ax, az, bx, bz, bucket.minX, bucket.minZ, bucket.maxX, bucket.maxZ, slab));
        const hit = { t: 0 };
        assert.ok(traceSegmentThroughMask(bucket, ax, az, bx, bz, slab.tEnter, slab.tExit, hit));
        return az + (bz - az) * hit.t; // local z where the shot stops
    };

    const firstStop = shoot();
    model.damage(model.indexOf('front'), 99);
    const secondStop = shoot();
    assert.ok(secondStop > firstStop + 1, `expected deeper (${firstStop} -> ${secondStop})`);

    // Once the whole neck is gone the shot only stops at the eye.
    for (let z = 2; z <= 8; z++) {
        const index = model.partAtColumn(5, z);
        if (index >= 0) model.damage(index, 99);
    }
    const lastStop = shoot();
    assert.ok(lastStop > secondStop);
});

test('nearestPart finds the closest column within reach, preferring the front', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const front = model.indexOf('front');
    // Local (-0.5, -5.5) is the middle of column x=5,z=0 in model space (front block).
    assert.equal(model.nearestPart(-0.5, -5.5, 0.1), front);
    // Far from anything.
    assert.equal(model.nearestPart(-5.9, 5.9, 0.5), -1);
    // 1.2 units to the left of the front block's left edge (local x = -2) reaches it with reach 2 but not reach 1.
    assert.equal(model.nearestPart(-2 - 1.2, -5.5, 2), front);
    assert.equal(model.nearestPart(-2 - 1.2, -5.5, 1), -1);
});

test('contact test sees through holes', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const models = new DestructibleCollisionModels(model, 2);
    assert.equal(models.overlapsCircle(-0.5, -5.5, 1), true);
    model.damage(model.indexOf('front'), 99);
    assert.equal(models.overlapsCircle(-0.5, -5.5, 1), false);
});

test('drip points come from the rim of a hole, and only once there is one', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    const out = { x: 0, y: 0, z: 0 };
    assert.equal(model.randomRimPoint(Math.random, out), false);
    model.damage(model.indexOf('front'), 99);
    let found = false;
    for (let i = 0; i < 20 && !found; i++) found = model.randomRimPoint(Math.random, out);
    assert.equal(found, true);
    assert.equal(out.y, 2);
});

test('voxelsToCloud centres on the model and uses true palette colours', () => {
    const cloud = voxelsToCloud(
        [{ x: 0, y: 0, z: 0, colorIndex: 1 }, { x: 11, y: 1, z: 11, colorIndex: 5 }],
        [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }],
        { x: 12, y: 2, z: 12 },
    );
    assert.deepEqual(Array.from(cloud.x), [-5.5, 5.5]);
    assert.deepEqual(Array.from(cloud.y), [-0.5, 0.5]);
    assert.deepEqual(Array.from(cloud.g), [1, 1]); // index 5 wraps to 1
    assert.deepEqual(Array.from(cloud.r), [0, 0]);
});

test('damageFraction tracks lost voxels', () => {
    const { def, voxels } = slab();
    const model = new DestructibleVoxelModel(def, voxels);
    assert.equal(model.damageFraction, 0);
    model.damage(model.indexOf('front'), 99);
    assert.ok(model.damageFraction > 0 && model.damageFraction < 1);
});

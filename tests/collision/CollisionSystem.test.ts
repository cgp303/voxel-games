import test from 'node:test';
import assert from 'node:assert/strict';
import { CollisionSystem } from '../../src/systems/collision/CollisionSystem.ts';
import { CollisionLayer } from '../../src/config/types/types.ts';
import { CollisionModelSet } from '../../src/systems/collision/CollisionModel.ts';
import type {
    ICollisionMover,
    ICollisionSystemConfig,
    ICollisionTarget,
} from '../../src/config/interfaces/interfaces.ts';
import { box } from './helpers.ts';

const options = { rollBuckets: 4, maskResolution: 2 };

const config: ICollisionSystemConfig = {
    grid: { minX: -100, maxX: 100, minZ: -100, maxZ: 100, cellSize: 10 },
    directLayers: CollisionLayer.PLAYER,
    rules: [
        { mover: CollisionLayer.PLAYER_MISSILE, targets: CollisionLayer.INVADER | CollisionLayer.INVADER_WEAPON_SHOOTABLE },
        { mover: CollisionLayer.INVADER_WEAPON, targets: CollisionLayer.PLAYER },
    ],
};

function makeTarget(
    layer: ICollisionTarget['collisionLayer'],
    set: CollisionModelSet,
    x: number,
    z: number,
    extra: { y?: number; roll?: number; enabled?: boolean } = {},
): ICollisionTarget & { roll: number; collisionEnabled: boolean } {
    return {
        collisionLayer: layer,
        collisionEnabled: extra.enabled ?? true,
        collisionModels: set,
        position: { x, y: extra.y ?? 0, z },
        roll: extra.roll ?? 0,
        getCollisionRoll() {
            return this.roll;
        },
    };
}

function makeMover(
    layer: ICollisionMover['collisionLayer'],
    from: [number, number],
    to: [number, number],
    extra: { y?: number; radius?: number; pierces?: boolean; enabled?: boolean } = {},
): ICollisionMover {
    return {
        collisionLayer: layer,
        collisionEnabled: extra.enabled ?? true,
        collisionRadius: extra.radius ?? 0,
        collisionPierces: extra.pierces,
        position: { x: to[0], y: extra.y ?? 0, z: to[1] },
        previousPosition: { x: from[0], y: extra.y ?? 0, z: from[1] },
    };
}

const block = new CollisionModelSet(box(4, 1, 4), options);

test('a shot that stays clear of the target does not hit', () => {
    const system = new CollisionSystem(config);
    const target = makeTarget(CollisionLayer.INVADER, block, 0, 0);
    const hits = system.update([makeMover(CollisionLayer.PLAYER_MISSILE, [10, -20], [10, -10])], [target]);
    assert.equal(hits.length, 0);
});

test('a shot reports where along its path it struck the target', () => {
    const system = new CollisionSystem(config);
    const target = makeTarget(CollisionLayer.INVADER, block, 0, 0);
    const mover = makeMover(CollisionLayer.PLAYER_MISSILE, [0.5, -10], [0.5, 0]);
    const hits = system.update([mover], [target]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].mover, mover);
    assert.equal(hits[0].target, target);
    assert.ok(Math.abs(hits[0].t - 0.8) < 1e-9);
    assert.ok(Math.abs(hits[0].z + 2) < 1e-9);
    assert.ok(Math.abs(hits[0].localZ + 2) < 1e-9);
});

test('a very fast shot does not tunnel through a thin target', () => {
    const system = new CollisionSystem(config);
    const thin = new CollisionModelSet(box(1, 1, 1), options);
    const target = makeTarget(CollisionLayer.INVADER, thin, 0, 0);
    for (const speed of [30, 90, 250, 1000]) {
        const hits = system.update([makeMover(CollisionLayer.PLAYER_MISSILE, [0, -speed / 2], [0, speed / 2])], [target]);
        assert.equal(hits.length, 1, `speed ${speed}`);
    }
});

test('the voxel stage rejects shots that pass through gaps inside the bounding box', () => {
    const system = new CollisionSystem(config);
    // Two walls with a 2-unit gap between them.
    const walls = new CollisionModelSet(box(6, 1, 6, (x) => x === 2 || x === 3), options);
    const target = makeTarget(CollisionLayer.INVADER, walls, 0, 0);
    const through = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -20], [0, 20]);
    const into = makeMover(CollisionLayer.PLAYER_MISSILE, [-2.5, -20], [-2.5, 20]);

    assert.equal(system.update([through], [target]).length, 0);
    assert.equal(system.update([into], [target]).length, 1);
});

test('the footprint follows the target roll', () => {
    const system = new CollisionSystem(config);
    // A flat bar 8 wide in X; rolled a quarter turn it stands on end and is only 1 wide.
    const bar = new CollisionModelSet(box(8, 1, 1), options);
    const flat = makeTarget(CollisionLayer.INVADER, bar, 0, 0, { roll: 0 });
    const upright = makeTarget(CollisionLayer.INVADER, bar, 0, 0, { roll: Math.PI / 2 });
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [3, -10], [3, 10]);

    assert.equal(system.update([shot], [flat]).length, 1);
    assert.equal(system.update([shot], [upright]).length, 0);
});

test('mover radius widens the contact area', () => {
    const system = new CollisionSystem(config);
    const target = makeTarget(CollisionLayer.INVADER, block, 0, 0);
    const slim = makeMover(CollisionLayer.PLAYER_MISSILE, [3, -20], [3, 20], { radius: 0 });
    const fat = makeMover(CollisionLayer.PLAYER_MISSILE, [3, -20], [3, 20], { radius: 2 });

    assert.equal(system.update([slim], [target]).length, 0);
    assert.equal(system.update([fat], [target]).length, 1);
    assert.equal(system.update([makeMover(CollisionLayer.PLAYER_MISSILE, [5, -20], [5, 20], { radius: 2 })], [target]).length, 0);
});

test('layer rules decide which pairs are tested', () => {
    const system = new CollisionSystem(config);
    const invader = makeTarget(CollisionLayer.INVADER, block, 0, 0);
    const player = makeTarget(CollisionLayer.PLAYER, block, 0, 0);
    const missile = makeTarget(CollisionLayer.PLAYER_MISSILE, block, 0, 0);
    const shootable = makeTarget(CollisionLayer.INVADER_WEAPON_SHOOTABLE, block, 0, 0);
    const plain = makeTarget(CollisionLayer.INVADER_WEAPON, block, 0, 0);
    const targets = [invader, player, missile, shootable, plain];

    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -20], [0, 20], { pierces: true });
    const hitByMissile = system.update([shot], targets).map((hit) => hit.target);
    assert.equal(hitByMissile.length, 2);
    assert.ok(hitByMissile.includes(invader));
    assert.ok(hitByMissile.includes(shootable));

    const bomb = makeMover(CollisionLayer.INVADER_WEAPON, [0, -20], [0, 20], { pierces: true });
    const hitByBomb = system.update([bomb], targets).map((hit) => hit.target);
    assert.deepEqual(hitByBomb, [player]);
});

test('a mover is never tested against itself', () => {
    const system = new CollisionSystem({
        ...config,
        rules: [{ mover: CollisionLayer.PLAYER_MISSILE, targets: CollisionLayer.PLAYER_MISSILE }],
    });
    const both = { ...makeMover(CollisionLayer.PLAYER_MISSILE, [0, -5], [0, 5]), ...makeTarget(CollisionLayer.PLAYER_MISSILE, block, 0, 0) };
    assert.equal(system.update([both], [both]).length, 0);
});

test('Y only filters: pairs beyond the tolerance are skipped, otherwise Y is ignored', () => {
    const system = new CollisionSystem({
        ...config,
        rules: [{ mover: CollisionLayer.PLAYER_MISSILE, targets: CollisionLayer.INVADER, yTolerance: 5 }],
    });
    const near = makeTarget(CollisionLayer.INVADER, block, 0, 0, { y: 4 });
    const far = makeTarget(CollisionLayer.INVADER, block, 0, 0, { y: 6 });
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -20], [0, 20]);

    assert.equal(system.update([shot], [near]).length, 1);
    assert.equal(system.update([shot], [far]).length, 0);
});

test('a non-piercing mover only reports its nearest target', () => {
    const system = new CollisionSystem(config);
    const nearer = makeTarget(CollisionLayer.INVADER, block, 0, -10);
    const farther = makeTarget(CollisionLayer.INVADER, block, 0, 10);
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -40], [0, 40]);

    const hits = system.update([shot], [farther, nearer]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].target, nearer);
});

test('a piercing mover reports every target, nearest first', () => {
    const system = new CollisionSystem(config);
    const targets = [20, -20, 0].map((z) => makeTarget(CollisionLayer.INVADER, block, 0, z));
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -40], [0, 40], { pierces: true });

    const hits = system.update([shot], targets);
    assert.deepEqual(hits.map((hit) => hit.target!.position.z), [-20, 0, 20]);
});

test('each mover gets its own result', () => {
    const system = new CollisionSystem(config);
    const left = makeTarget(CollisionLayer.INVADER, block, -30, 0);
    const right = makeTarget(CollisionLayer.INVADER, block, 30, 0);
    const shots = [
        makeMover(CollisionLayer.PLAYER_MISSILE, [-30, -10], [-30, 10]),
        makeMover(CollisionLayer.PLAYER_MISSILE, [30, -10], [30, 10]),
        makeMover(CollisionLayer.PLAYER_MISSILE, [0, -10], [0, 10]),
    ];
    const hits = system.update(shots, [left, right]);
    assert.equal(hits.length, 2);
    assert.equal(hits[0].target, left);
    assert.equal(hits[1].target, right);
});

test('a target spanning many grid cells is hit once', () => {
    const system = new CollisionSystem({ ...config, grid: { ...config.grid, cellSize: 2 } });
    const big = makeTarget(CollisionLayer.INVADER, new CollisionModelSet(box(20, 1, 20), options), 0, 0);
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -40], [0, 40], { pierces: true });
    assert.equal(system.update([shot], [big]).length, 1);
});

test('direct layers skip the broadphase but are still tested', () => {
    const system = new CollisionSystem(config);
    const player = makeTarget(CollisionLayer.PLAYER, block, 0, 0);
    const bomb = makeMover(CollisionLayer.INVADER_WEAPON, [0, 10], [0, -10]);
    const hits = system.update([bomb], [player]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].target, player);
});

test('disabled movers and targets are ignored', () => {
    const system = new CollisionSystem(config);
    const live = makeTarget(CollisionLayer.INVADER, block, 0, 0);
    const dead = makeTarget(CollisionLayer.INVADER, block, 0, 0, { enabled: false });
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -20], [0, 20]);
    const spent = makeMover(CollisionLayer.PLAYER_MISSILE, [0, -20], [0, 20], { enabled: false });

    assert.equal(system.update([shot], [dead]).length, 0);
    assert.equal(system.update([spent], [live]).length, 0);
    assert.equal(system.update([], [live]).length, 0);
});

test('targets far outside the grid bounds are still found', () => {
    const system = new CollisionSystem(config);
    const distant = makeTarget(CollisionLayer.INVADER, block, 400, 400);
    const shot = makeMover(CollisionLayer.PLAYER_MISSILE, [400, 380], [400, 420]);
    assert.equal(system.update([shot], [distant]).length, 1);
});

test('results do not keep references to entities after the next update', () => {
    const system = new CollisionSystem(config);
    const target = makeTarget(CollisionLayer.INVADER, block, 0, 0);
    const first = system.update([makeMover(CollisionLayer.PLAYER_MISSILE, [0, -20], [0, 20])], [target]);
    const hit = first[0];
    system.update([], []);
    assert.equal(hit.target, null);
    assert.equal(hit.mover, null);
});

test('invaders as movers hit the player (a direct target) and ignore each other', () => {
    const system = new CollisionSystem({
        ...config,
        rules: [...config.rules, { mover: CollisionLayer.INVADER, targets: CollisionLayer.PLAYER }],
    });
    const player = makeTarget(CollisionLayer.PLAYER, block, 0, 0);
    const neighbour = makeTarget(CollisionLayer.INVADER, block, 6, 0);
    const diving = { ...makeMover(CollisionLayer.INVADER, [0, 20], [0, 4], { radius: 3 }), ...makeTarget(CollisionLayer.INVADER, block, 0, 4) };

    const hits = system.update([diving], [diving, neighbour, player]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].target, player);
    assert.equal(system.update([makeMover(CollisionLayer.INVADER, [30, 20], [30, 4], { radius: 3 })], [player]).length, 0);
});

test('invalid rules are rejected', () => {
    assert.throws(() => new CollisionSystem({
        ...config,
        rules: [{ mover: (CollisionLayer.PLAYER | CollisionLayer.INVADER) as never, targets: 1 }],
    }));
});

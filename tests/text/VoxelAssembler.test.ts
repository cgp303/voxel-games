import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelAssembler } from '../../src/systems/text/VoxelAssembler.ts';
import type { IVoxelAssemblyConfig, IVoxelCloud } from '../../src/config/interfaces/interfaces.ts';

const config: IVoxelAssemblyConfig = {
    assembleSeconds: 2,
    travelSeconds: 1,
    spawnRadius: [150, 300],
    minElevationDeg: 5,
    curve: 0.35,
    spinTurns: 1.5,
    flashSeconds: 0.25,
    flashIntensity: 1.5,
};

const target: IVoxelCloud = {
    count: 3,
    x: Float32Array.of(-1, 0, 1),
    y: Float32Array.of(10, 10, 10),
    z: Float32Array.of(0, 0, 0),
    r: Float32Array.of(0.5, 0.5, 0.5),
    g: Float32Array.of(0.6, 0.6, 0.6),
    b: Float32Array.of(0.1, 0.1, 0.1),
};

function makeCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(50, 1.5, 1, 2000);
    camera.position.set(0, 60, -100);
    camera.lookAt(0, 10, 0);
    camera.updateMatrixWorld();
    return camera;
}

test('voxels land exactly on their slots, at rest colour, once done', () => {
    const assembler = new VoxelAssembler(target, 1, new THREE.Quaternion(), makeCamera(), config);
    assert.equal(assembler.done, false);

    for (let t = 0; t < 4 && !assembler.done; t += 1 / 60) assembler.update(1 / 60);
    assert.equal(assembler.done, true);

    for (let i = 0; i < target.count; i++) {
        assert.ok(Math.abs(assembler.px[i] - target.x[i]) < 1e-4);
        assert.ok(Math.abs(assembler.py[i] - target.y[i]) < 1e-4);
        assert.ok(Math.abs(assembler.pz[i] - target.z[i]) < 1e-4);
        assert.equal(assembler.size[i], 1);
        assert.ok(Math.abs(assembler.qw[i] - 1) < 1e-4);
        assert.ok(Math.abs(assembler.cg[i] - target.g[i]) < 1e-4);
    }
});

test('unlaunched voxels are hidden, and none start below the target or inside the view', () => {
    const camera = makeCamera();
    const assembler = new VoxelAssembler(target, 1, new THREE.Quaternion(), camera, config);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    for (let i = 0; i < target.count; i++) {
        if (assembler.size[i] === 0) {
            assert.ok(assembler.py[i] >= 10);
            assert.equal(frustum.containsPoint(new THREE.Vector3(assembler.px[i], assembler.py[i], assembler.pz[i])), false);
        }
    }
});

test('landing flashes brighter than the rest colour', () => {
    const assembler = new VoxelAssembler(target, 1, new THREE.Quaternion(), makeCamera(), config);
    let peak = 0;
    for (let t = 0; t < 4 && !assembler.done; t += 1 / 60) {
        assembler.update(1 / 60);
        peak = Math.max(peak, assembler.cg[0]);
    }
    assert.ok(peak > 1);
});

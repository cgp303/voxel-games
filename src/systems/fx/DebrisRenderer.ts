import * as THREE from 'three';
import { FX } from '../../config/data/constants';
import type { DebrisSimulation } from './DebrisSimulation';

/**
 * Draws a DebrisSimulation as one InstancedMesh of unit cubes (a single draw call).
 * Each particle's colour is its voxel's palette colour, written per instance. The mesh sits on the FX layer
 * so the selective bloom picks it up; colours above 1 (the initial glow) bloom hardest.
 */
export class DebrisRenderer {
    public readonly mesh: THREE.InstancedMesh;

    private readonly matrices: THREE.InstancedBufferAttribute;
    private readonly colors: THREE.InstancedBufferAttribute;

    constructor(capacity: number) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
        // The bloom pass has no lights (lights are not on the FX layer), so lit colour alone renders black there.
        // Emit the part of the instance colour above 1 (the hot glow): it survives without lights and blooms,
        // while cooled debris (colour <= 1) adds nothing and keeps its normal shading.
        material.emissive.setRGB(1, 1, 1);
        material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance = max(diffuseColor.rgb - 1.0, 0.0);',
            );
        };
        material.customProgramCacheKey = () => 'debrisHotEmissive';

        this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
        this.mesh.name = 'Debris';
        this.mesh.count = 0;
        // The bounding sphere would go stale as debris flies, and debris is cheap to draw anyway.
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = false;
        if (FX.enabled) this.mesh.layers.set(FX.layer);

        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.colors = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        this.colors.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = this.colors;
        this.matrices = this.mesh.instanceMatrix;
    }

    /** Copies the simulation's live particles into the instance buffers and uploads only that range. */
    public sync(sim: DebrisSimulation): void {
        const count = sim.count;
        this.mesh.count = count;
        if (count === 0) return;

        const te = this.matrices.array as Float32Array;
        const col = this.colors.array as Float32Array;
        for (let i = 0; i < count; i++) {
            const x = sim.qx[i], y = sim.qy[i], z = sim.qz[i], w = sim.qw[i];
            const x2 = x + x, y2 = y + y, z2 = z + z;
            const xx = x * x2, xy = x * y2, xz = x * z2;
            const yy = y * y2, yz = y * z2, zz = z * z2;
            const wx = w * x2, wy = w * y2, wz = w * z2;
            const s = sim.size[i];

            const o = i * 16;
            te[o] = (1 - (yy + zz)) * s;
            te[o + 1] = (xy + wz) * s;
            te[o + 2] = (xz - wy) * s;
            te[o + 3] = 0;
            te[o + 4] = (xy - wz) * s;
            te[o + 5] = (1 - (xx + zz)) * s;
            te[o + 6] = (yz + wx) * s;
            te[o + 7] = 0;
            te[o + 8] = (xz + wy) * s;
            te[o + 9] = (yz - wx) * s;
            te[o + 10] = (1 - (xx + yy)) * s;
            te[o + 11] = 0;
            te[o + 12] = sim.px[i];
            te[o + 13] = sim.py[i];
            te[o + 14] = sim.pz[i];
            te[o + 15] = 1;

            col[i * 3] = sim.cr[i];
            col[i * 3 + 1] = sim.cg[i];
            col[i * 3 + 2] = sim.cb[i];
        }

        this.matrices.clearUpdateRanges();
        this.matrices.addUpdateRange(0, count * 16);
        this.matrices.needsUpdate = true;
        this.colors.clearUpdateRanges();
        this.colors.addUpdateRange(0, count * 3);
        this.colors.needsUpdate = true;
    }

    public dispose(): void {
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.dispose();
    }
}

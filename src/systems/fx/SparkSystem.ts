import * as THREE from 'three';
import { FX, SPARKS } from '../../config/data/constants';
import type { ISparkConfig, IVector3Like } from '../../config/interfaces/interfaces';

/**
 * Glowing single-voxel sparks: one pooled InstancedMesh of cubes on the FX layer (so the selective bloom
 * picks them up). A spark starts hot (colour above 1), cools to red, then dims and shrinks away.
 * Add `mesh` to the scene once; call emit() on a hit and update() every frame.
 */
export class SparkSystem {
    public readonly mesh: THREE.InstancedMesh;

    private readonly config: ISparkConfig;
    private readonly px: Float32Array;
    private readonly py: Float32Array;
    private readonly pz: Float32Array;
    private readonly vx: Float32Array;
    private readonly vy: Float32Array;
    private readonly vz: Float32Array;
    private readonly age: Float32Array;
    private readonly life: Float32Array;
    private liveCount = 0;

    private readonly matrices: THREE.InstancedBufferAttribute;
    private readonly colors: THREE.InstancedBufferAttribute;

    // Scratch basis for building a direction inside the scatter cone.
    private readonly dir = new THREE.Vector3();
    private readonly sideA = new THREE.Vector3();
    private readonly sideB = new THREE.Vector3();

    constructor(config: ISparkConfig = SPARKS) {
        this.config = config;
        const n = config.maxParticles;
        this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
        this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
        this.age = new Float32Array(n); this.life = new Float32Array(n);

        this.mesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial(),
            n,
        );
        this.mesh.name = 'Sparks';
        this.mesh.count = 0;
        // Sparks fly around too fast for a stable bounding sphere, and they are cheap to draw.
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = false;
        if (FX.enabled) this.mesh.layers.set(FX.layer);

        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.colors = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        this.colors.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = this.colors;
        this.matrices = this.mesh.instanceMatrix;
    }

    public get count(): number {
        return this.liveCount;
    }

    /**
     * Throws a few sparks from `origin`, scattered in a cone around the configured direction.
     * `velocity` is the emitter's own motion. Sparks beyond the pool size are dropped.
     */
    public emit(origin: IVector3Like, velocity: IVector3Like): void {
        const c = this.config;
        const count = Math.round(c.count[0] + Math.random() * (c.count[1] - c.count[0]));

        this.dir.set(c.direction.x, c.direction.y, c.direction.z).normalize();
        // Any vector not parallel to the direction gives a perpendicular basis.
        this.sideA.set(Math.abs(this.dir.y) < 0.9 ? 0 : 1, Math.abs(this.dir.y) < 0.9 ? 1 : 0, 0)
            .cross(this.dir).normalize();
        this.sideB.crossVectors(this.dir, this.sideA);

        for (let i = 0; i < count && this.liveCount < c.maxParticles; i++) {
            const slot = this.liveCount++;
            const angle = c.spread * Math.sqrt(Math.random());
            const phi = Math.random() * Math.PI * 2;
            const sinA = Math.sin(angle), cosA = Math.cos(angle);
            const cosP = Math.cos(phi) * sinA, sinP = Math.sin(phi) * sinA;
            const speed = c.speed[0] + Math.random() * (c.speed[1] - c.speed[0]);

            this.px[slot] = origin.x; this.py[slot] = origin.y; this.pz[slot] = origin.z;
            this.vx[slot] = (this.dir.x * cosA + this.sideA.x * cosP + this.sideB.x * sinP) * speed + velocity.x * c.inheritVelocity;
            this.vy[slot] = (this.dir.y * cosA + this.sideA.y * cosP + this.sideB.y * sinP) * speed + velocity.y * c.inheritVelocity;
            this.vz[slot] = (this.dir.z * cosA + this.sideA.z * cosP + this.sideB.z * sinP) * speed + velocity.z * c.inheritVelocity;
            this.age[slot] = 0;
            this.life[slot] = c.life[0] + Math.random() * (c.life[1] - c.life[0]);
        }
        this.sync();
    }

    public update(dt: number): void {
        if (this.liveCount === 0 && this.mesh.count === 0) return;

        // Backwards so swap-removal (last into the freed slot) never skips a particle.
        for (let i = this.liveCount - 1; i >= 0; i--) {
            this.age[i] += dt;
            if (this.age[i] >= this.life[i]) {
                this.remove(i);
                continue;
            }
            this.vy[i] -= this.config.gravity * dt;
            this.px[i] += this.vx[i] * dt;
            this.py[i] += this.vy[i] * dt;
            this.pz[i] += this.vz[i] * dt;
        }
        this.sync();
    }

    public clear(): void {
        this.liveCount = 0;
        this.sync();
    }

    public dispose(): void {
        this.liveCount = 0;
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.dispose();
    }

    private remove(i: number): void {
        const last = --this.liveCount;
        if (i === last) return;
        this.px[i] = this.px[last]; this.py[i] = this.py[last]; this.pz[i] = this.pz[last];
        this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]; this.vz[i] = this.vz[last];
        this.age[i] = this.age[last]; this.life[i] = this.life[last];
    }

    /** Writes position, size and colour of every live spark into the instance buffers. */
    private sync(): void {
        const count = this.liveCount;
        this.mesh.count = count;
        if (count === 0) return;

        const c = this.config;
        const hot = c.hotColor, red = c.redColor;
        const te = this.matrices.array as Float32Array;
        const col = this.colors.array as Float32Array;

        for (let i = 0; i < count; i++) {
            const t = this.age[i] / this.life[i];
            let size = c.size;
            let r: number, g: number, b: number;
            if (t < c.redAtFraction) {
                // Hot -> red: the glow intensity cools away as the colour blends into red.
                const u = t / c.redAtFraction;
                const hotScale = c.hotIntensity * (1 - u);
                r = hot[0] * hotScale + red[0] * u;
                g = hot[1] * hotScale + red[1] * u;
                b = hot[2] * hotScale + red[2] * u;
            } else {
                // Red -> out: dim and shrink together.
                const fade = 1 - (t - c.redAtFraction) / (1 - c.redAtFraction);
                r = red[0] * fade; g = red[1] * fade; b = red[2] * fade;
                size *= fade;
            }

            const o = i * 16;
            te[o] = size; te[o + 1] = 0; te[o + 2] = 0; te[o + 3] = 0;
            te[o + 4] = 0; te[o + 5] = size; te[o + 6] = 0; te[o + 7] = 0;
            te[o + 8] = 0; te[o + 9] = 0; te[o + 10] = size; te[o + 11] = 0;
            te[o + 12] = this.px[i]; te[o + 13] = this.py[i]; te[o + 14] = this.pz[i]; te[o + 15] = 1;

            col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
        }

        this.matrices.clearUpdateRanges();
        this.matrices.addUpdateRange(0, count * 16);
        this.matrices.needsUpdate = true;
        this.colors.clearUpdateRanges();
        this.colors.addUpdateRange(0, count * 3);
        this.colors.needsUpdate = true;
    }
}

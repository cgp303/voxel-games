import type {
    IDebrisConfig,
    IExplosionProfile,
    IGradient2,
    IGroundSampler,
    IQuaternionLike,
    IVector3Like,
    IVoxelCloud,
} from '../../config/interfaces/interfaces';
import type { ExplosionKind } from '../../config/types/types';

const EVICTION_SAMPLES = 8;

/**
 * Pure debris simulation: gravity, drag, tumbling spin and bounces off the terrain for a pool of cube
 * particles. Holds no rendering objects; a renderer reads the public output arrays (first `count` entries).
 * Particles are compact: removing one moves the last into its slot.
 */
export class DebrisSimulation {
    // Outputs for the renderer.
    public readonly px: Float32Array;
    public readonly py: Float32Array;
    public readonly pz: Float32Array;
    /** Current orientation (initial orientation composed with the spin so far). */
    public readonly qx: Float32Array;
    public readonly qy: Float32Array;
    public readonly qz: Float32Array;
    public readonly qw: Float32Array;
    /** Edge length of the cube this frame (shrinks to 0 at the end of life). */
    public readonly size: Float32Array;
    /** Colour this frame: glow tint while hot, cooling to the voxel's own colour. */
    public readonly cr: Float32Array;
    public readonly cg: Float32Array;
    public readonly cb: Float32Array;

    private readonly config: IDebrisConfig;
    private readonly ground: IGroundSampler;
    private readonly random: () => number;
    private readonly profiles: IExplosionProfile[];
    private readonly profileIndex: Record<ExplosionKind, number>;

    private readonly vx: Float32Array;
    private readonly vy: Float32Array;
    private readonly vz: Float32Array;
    private readonly q0x: Float32Array;
    private readonly q0y: Float32Array;
    private readonly q0z: Float32Array;
    private readonly q0w: Float32Array;
    private readonly axisX: Float32Array;
    private readonly axisY: Float32Array;
    private readonly axisZ: Float32Array;
    private readonly spinRate: Float32Array;
    private readonly spinAngle: Float32Array;
    private readonly age: Float32Array;
    private readonly life: Float32Array;
    private readonly baseR: Float32Array;
    private readonly baseG: Float32Array;
    private readonly baseB: Float32Array;
    private readonly kind: Uint8Array;

    private liveCount = 0;

    // Scratch values reused to keep the per-particle code allocation-free.
    private readonly gradient: IGradient2 = { x: 0, z: 0 };
    private readonly slide = { x: 0, y: 0, z: 0 };
    private dirX = 0;
    private dirY = 0;
    private dirZ = 0;

    constructor(config: IDebrisConfig, ground: IGroundSampler, random: () => number = Math.random) {
        this.config = config;
        this.ground = ground;
        this.random = random;

        const kinds = Object.keys(config.profiles) as ExplosionKind[];
        this.profiles = kinds.map((k) => config.profiles[k]);
        this.profileIndex = {} as Record<ExplosionKind, number>;
        kinds.forEach((k, i) => { this.profileIndex[k] = i; });

        const n = config.maxParticles;
        const floats = (): Float32Array => new Float32Array(n);
        this.px = floats(); this.py = floats(); this.pz = floats();
        this.qx = floats(); this.qy = floats(); this.qz = floats(); this.qw = floats();
        this.size = floats();
        this.cr = floats(); this.cg = floats(); this.cb = floats();
        this.vx = floats(); this.vy = floats(); this.vz = floats();
        this.q0x = floats(); this.q0y = floats(); this.q0z = floats(); this.q0w = floats();
        this.axisX = floats(); this.axisY = floats(); this.axisZ = floats();
        this.spinRate = floats(); this.spinAngle = floats();
        this.age = floats(); this.life = floats();
        this.baseR = floats(); this.baseG = floats(); this.baseB = floats();
        this.kind = new Uint8Array(n);
    }

    public get count(): number {
        return this.liveCount;
    }

    public clear(): void {
        this.liveCount = 0;
    }

    /**
     * Breaks a model into one particle per voxel. `orientation` and `origin` place the model in the world;
     * `velocity` is the dying entity's own velocity. When the pool is full the oldest-looking debris is replaced.
     * Returns the number of particles created.
     */
    public spawn(
        kind: ExplosionKind,
        cloud: IVoxelCloud,
        origin: IVector3Like,
        orientation: IQuaternionLike,
        velocity: IVector3Like,
    ): number {
        const capacity = this.config.maxParticles;
        if (capacity === 0) return 0;

        const profile = this.config.profiles[kind];
        const kindIndex = this.profileIndex[kind];
        const { x: qx, y: qy, z: qz, w: qw } = orientation;

        for (let i = 0; i < cloud.count; i++) {
            const slot = this.liveCount < capacity ? this.liveCount++ : this.pickEvictionSlot();

            // Voxel offset rotated into the world: v + w*t + q.xyz x t, with t = 2 * (q.xyz x v).
            const ox = cloud.x[i], oy = cloud.y[i], oz = cloud.z[i];
            const tx = 2 * (qy * oz - qz * oy);
            const ty = 2 * (qz * ox - qx * oz);
            const tz = 2 * (qx * oy - qy * ox);
            const rx = ox + qw * tx + (qy * tz - qz * ty);
            const ry = oy + qw * ty + (qz * tx - qx * tz);
            const rz = oz + qw * tz + (qx * ty - qy * tx);

            this.px[slot] = origin.x + rx;
            this.py[slot] = origin.y + ry;
            this.pz[slot] = origin.z + rz;

            // Outward from the model centre; a voxel at the centre goes in a random direction.
            let dx = rx, dy = ry, dz = rz;
            const len = Math.hypot(dx, dy, dz);
            if (len > 1e-4) {
                dx /= len; dy /= len; dz /= len;
            } else {
                this.randomDirection();
                dx = this.dirX; dy = this.dirY; dz = this.dirZ;
            }
            const speed = this.between(profile.speed);
            this.randomDirection();
            const scatter = profile.scatter * this.random();
            const inherit = profile.inheritVelocity;
            this.vx[slot] = dx * speed + this.dirX * scatter + velocity.x * inherit;
            this.vy[slot] = dy * speed + this.dirY * scatter + velocity.y * inherit + this.between(profile.upward);
            this.vz[slot] = dz * speed + this.dirZ * scatter + velocity.z * inherit;

            this.q0x[slot] = qx; this.q0y[slot] = qy; this.q0z[slot] = qz; this.q0w[slot] = qw;
            this.randomDirection();
            this.axisX[slot] = this.dirX; this.axisY[slot] = this.dirY; this.axisZ[slot] = this.dirZ;
            this.spinRate[slot] = this.between(profile.spin);
            this.spinAngle[slot] = 0;

            this.age[slot] = 0;
            this.life[slot] = this.between(profile.life);
            this.baseR[slot] = cloud.r[i];
            this.baseG[slot] = cloud.g[i];
            this.baseB[slot] = cloud.b[i];
            this.kind[slot] = kindIndex;

            this.writeOutputs(slot);
        }
        return cloud.count;
    }

    public update(dtRaw: number): void {
        const dt = Math.min(dtRaw, this.config.maxStepSec);
        if (!(dt > 0)) return;

        const { gravity, killBelowY } = this.config;
        const drag = Math.exp(-this.config.airDrag * dt);

        // Backwards so swap-removal never skips a particle.
        for (let i = this.liveCount - 1; i >= 0; i--) {
            this.age[i] += dt;
            if (this.age[i] >= this.life[i]) {
                this.remove(i);
                continue;
            }

            this.vx[i] *= drag;
            this.vy[i] = this.vy[i] * drag - gravity * dt;
            this.vz[i] *= drag;
            this.px[i] += this.vx[i] * dt;
            this.py[i] += this.vy[i] * dt;
            this.pz[i] += this.vz[i] * dt;

            this.collideWithGround(i, dt);
            if (this.py[i] < killBelowY) {
                this.remove(i);
                continue;
            }

            this.spinAngle[i] += this.spinRate[i] * dt;
            this.writeOutputs(i);
        }
    }

    private collideWithGround(i: number, dt: number): void {
        const cfg = this.config;
        const radius = cfg.particleSize * 0.5;
        const groundY = this.ground.getGroundHeight(this.px[i], this.pz[i]);
        if (this.py[i] - radius >= groundY) return;

        const grad = this.ground.getGroundGradient(this.px[i], this.pz[i], this.gradient);
        const inv = 1 / Math.hypot(grad.x, 1, grad.z);
        const nx = -grad.x * inv, ny = inv, nz = -grad.z * inv;

        // Work relative to the ground, which scrolls along Z.
        const groundVz = this.ground.getGroundScrollVelocityZ();
        let rx = this.vx[i];
        let ry = this.vy[i];
        let rz = this.vz[i] - groundVz;

        const normalSpeed = rx * nx + ry * ny + rz * nz;
        if (normalSpeed < 0) {
            const bounce = -normalSpeed >= cfg.restSpeed;
            const k = bounce ? 1 + cfg.restitution : 1;
            rx -= k * normalSpeed * nx;
            ry -= k * normalSpeed * ny;
            rz -= k * normalSpeed * nz;

            if (bounce) {
                // One-off friction at the impact, then the spin is knocked down.
                const loss = this.slideShare(rx, ry, rz, nx, ny, nz, cfg.bounceFriction);
                rx -= loss.x; ry -= loss.y; rz -= loss.z;
                this.spinRate[i] *= cfg.spinImpactDamping;
            }
        }

        // Continuous friction while touching: carries resting debris along with the ground.
        const loss = this.slideShare(rx, ry, rz, nx, ny, nz, 1 - Math.exp(-cfg.contactFriction * dt));
        rx -= loss.x; ry -= loss.y; rz -= loss.z;
        this.spinRate[i] *= Math.exp(-cfg.spinContactDamping * dt);

        this.vx[i] = rx;
        this.vy[i] = ry;
        this.vz[i] = rz + groundVz;
        this.py[i] = groundY + radius;
    }

    /** `share` of the part of (rx, ry, rz) that lies along the surface (perpendicular to the normal). */
    private slideShare(
        rx: number, ry: number, rz: number,
        nx: number, ny: number, nz: number,
        share: number,
    ): { x: number; y: number; z: number } {
        const along = rx * nx + ry * ny + rz * nz;
        this.slide.x = (rx - along * nx) * share;
        this.slide.y = (ry - along * ny) * share;
        this.slide.z = (rz - along * nz) * share;
        return this.slide;
    }

    private writeOutputs(i: number): void {
        const profile = this.profiles[this.kind[i]];
        const age = this.age[i];
        const remaining = this.life[i] - age;
        const fade = this.config.fadeSec;
        this.size[i] = this.config.particleSize * (remaining < fade ? Math.max(0, remaining / fade) : 1);

        const half = this.spinAngle[i] * 0.5;
        const s = Math.sin(half);
        const sx = this.axisX[i] * s, sy = this.axisY[i] * s, sz = this.axisZ[i] * s;
        const sw = Math.cos(half);
        const ax = this.q0x[i], ay = this.q0y[i], az = this.q0z[i], aw = this.q0w[i];
        this.qx[i] = aw * sx + ax * sw + ay * sz - az * sy;
        this.qy[i] = aw * sy - ax * sz + ay * sw + az * sx;
        this.qz[i] = aw * sz + ax * sy - ay * sx + az * sw;
        this.qw[i] = aw * sw - ax * sx - ay * sy - az * sz;

        const glow = profile.glow;
        const hot = glow.durationSec > 0 ? Math.max(0, 1 - age / glow.durationSec) : 0;
        const g = hot * hot;
        const boost = glow.intensity * g;
        this.cr[i] = this.baseR[i] * (1 - g) + glow.color[0] * boost;
        this.cg[i] = this.baseG[i] * (1 - g) + glow.color[1] * boost;
        this.cb[i] = this.baseB[i] * (1 - g) + glow.color[2] * boost;
    }

    private remove(i: number): void {
        const last = --this.liveCount;
        if (i === last) return;
        this.px[i] = this.px[last]; this.py[i] = this.py[last]; this.pz[i] = this.pz[last];
        this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]; this.vz[i] = this.vz[last];
        this.q0x[i] = this.q0x[last]; this.q0y[i] = this.q0y[last]; this.q0z[i] = this.q0z[last]; this.q0w[i] = this.q0w[last];
        this.qx[i] = this.qx[last]; this.qy[i] = this.qy[last]; this.qz[i] = this.qz[last]; this.qw[i] = this.qw[last];
        this.axisX[i] = this.axisX[last]; this.axisY[i] = this.axisY[last]; this.axisZ[i] = this.axisZ[last];
        this.spinRate[i] = this.spinRate[last]; this.spinAngle[i] = this.spinAngle[last];
        this.age[i] = this.age[last]; this.life[i] = this.life[last];
        this.size[i] = this.size[last];
        this.cr[i] = this.cr[last]; this.cg[i] = this.cg[last]; this.cb[i] = this.cb[last];
        this.baseR[i] = this.baseR[last]; this.baseG[i] = this.baseG[last]; this.baseB[i] = this.baseB[last];
        this.kind[i] = this.kind[last];
    }

    /** Samples a few particles and returns the oldest, a cheap stand-in for "evict the oldest". */
    private pickEvictionSlot(): number {
        let best = Math.floor(this.random() * this.liveCount);
        for (let s = 1; s < EVICTION_SAMPLES; s++) {
            const candidate = Math.floor(this.random() * this.liveCount);
            if (this.age[candidate] > this.age[best]) best = candidate;
        }
        return best;
    }

    private between(range: readonly [number, number]): number {
        return range[0] + (range[1] - range[0]) * this.random();
    }

    /** Uniform random direction written to dirX/dirY/dirZ. */
    private randomDirection(): void {
        const z = 2 * this.random() - 1;
        const a = 2 * Math.PI * this.random();
        const r = Math.sqrt(1 - z * z);
        this.dirX = r * Math.cos(a);
        this.dirY = r * Math.sin(a);
        this.dirZ = z;
    }
}

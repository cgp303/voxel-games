import * as THREE from 'three';
import type { IParticleBuffers, IVoxelAssemblyConfig, IVoxelCloud } from '../../config/interfaces/interfaces';

const MAX_SPAWN_TRIES = 20;

/**
 * Simulation for building a voxel cloud out of loose cubes: each starts at a random point outside the camera's
 * view, swoops along a curved path (tumbling) and settles on its slot with a brief flash, matching the final voxel
 * exactly in position, size, orientation and colour. Holds no rendering objects; a DebrisRenderer draws it.
 * Call update() every frame and swap in the real model once `done`.
 * Voxels start on the upper hemisphere around the target, so they never come from below it, and paths never dip
 * below the lower of their two ends.
 */
export class VoxelAssembler implements IParticleBuffers {
    // Drawn state (IParticleBuffers).
    public readonly count: number;
    public readonly px: Float32Array;
    public readonly py: Float32Array;
    public readonly pz: Float32Array;
    public readonly qx: Float32Array;
    public readonly qy: Float32Array;
    public readonly qz: Float32Array;
    public readonly qw: Float32Array;
    public readonly size: Float32Array;
    public readonly cr: Float32Array;
    public readonly cg: Float32Array;
    public readonly cb: Float32Array;

    private readonly config: IVoxelAssemblyConfig;
    private readonly voxelSize: number;
    private readonly target: IVoxelCloud;
    private readonly orientation: THREE.Quaternion;

    // Per-voxel flight plan: quadratic Bezier start -> control -> end, plus timing and tumble.
    private readonly startX: Float32Array;
    private readonly startY: Float32Array;
    private readonly startZ: Float32Array;
    private readonly ctrlX: Float32Array;
    private readonly ctrlY: Float32Array;
    private readonly ctrlZ: Float32Array;
    private readonly delay: Float32Array;
    private readonly travel: Float32Array;
    private readonly axisX: Float32Array;
    private readonly axisY: Float32Array;
    private readonly axisZ: Float32Array;
    private readonly spinSign: Float32Array;

    private readonly finishAt: number;
    private elapsed = 0;

    private readonly spin = new THREE.Quaternion();
    private readonly pose = new THREE.Quaternion();
    private readonly unit = new THREE.Vector3();

    /**
     * @param target Where every voxel ends up: world-space centres and the colour each should rest at.
     * @param voxelSize World units per voxel.
     * @param orientation World orientation of the finished model.
     * @param camera Voxels start outside this camera's view.
     */
    constructor(
        target: IVoxelCloud,
        voxelSize: number,
        orientation: THREE.Quaternion,
        camera: THREE.Camera,
        config: IVoxelAssemblyConfig,
    ) {
        this.target = target;
        this.voxelSize = voxelSize;
        this.orientation = orientation.clone();
        this.config = config;

        const n = target.count;
        this.count = n;
        const floats = (): Float32Array => new Float32Array(n);
        this.px = floats(); this.py = floats(); this.pz = floats();
        this.qx = floats(); this.qy = floats(); this.qz = floats(); this.qw = floats();
        this.size = floats();
        this.cr = floats(); this.cg = floats(); this.cb = floats();
        this.startX = floats(); this.startY = floats(); this.startZ = floats();
        this.ctrlX = floats(); this.ctrlY = floats(); this.ctrlZ = floats();
        this.delay = floats(); this.travel = floats();
        this.axisX = floats(); this.axisY = floats(); this.axisZ = floats();
        this.spinSign = floats();

        this.planFlights(camera);

        let lastLanding = 0;
        for (let i = 0; i < n; i++) lastLanding = Math.max(lastLanding, this.delay[i] + this.travel[i]);
        this.finishAt = lastLanding + config.flashSeconds;
        this.update(0);
    }

    /** True once every voxel has landed and its flash has faded: the model can replace the cubes. */
    public get done(): boolean {
        return this.elapsed >= this.finishAt;
    }

    public update(dt: number): void {
        this.elapsed += dt;
        const { target, voxelSize, orientation, config } = this;
        const turn = config.spinTurns * Math.PI * 2;

        for (let i = 0; i < this.count; i++) {
            const flight = (this.elapsed - this.delay[i]) / this.travel[i];
            const sinceLanding = this.elapsed - (this.delay[i] + this.travel[i]);
            const flash = sinceLanding < 0 ? 0 : Math.max(0, 1 - sinceLanding / config.flashSeconds);
            this.cr[i] = target.r[i] + flash * config.flashIntensity;
            this.cg[i] = target.g[i] + flash * config.flashIntensity;
            this.cb[i] = target.b[i] + flash * config.flashIntensity;

            if (flight <= 0) {
                // Not launched yet: keep it invisible rather than hanging at its off-screen start.
                this.size[i] = 0;
                this.px[i] = this.startX[i]; this.py[i] = this.startY[i]; this.pz[i] = this.startZ[i];
                this.qx[i] = 0; this.qy[i] = 0; this.qz[i] = 0; this.qw[i] = 1;
                continue;
            }

            // Ease-out so voxels decelerate into their slot.
            const remaining = Math.pow(1 - Math.min(flight, 1), 3);
            const progress = 1 - remaining;
            const a = remaining * remaining;
            const b = 2 * remaining * progress;
            const c = progress * progress;
            this.px[i] = a * this.startX[i] + b * this.ctrlX[i] + c * target.x[i];
            this.py[i] = a * this.startY[i] + b * this.ctrlY[i] + c * target.y[i];
            this.pz[i] = a * this.startZ[i] + b * this.ctrlZ[i] + c * target.z[i];
            this.size[i] = voxelSize;

            this.unit.set(this.axisX[i], this.axisY[i], this.axisZ[i]);
            this.spin.setFromAxisAngle(this.unit, turn * remaining * this.spinSign[i]);
            this.pose.multiplyQuaternions(this.spin, orientation);
            this.qx[i] = this.pose.x; this.qy[i] = this.pose.y; this.qz[i] = this.pose.z; this.qw[i] = this.pose.w;
        }
    }

    private planFlights(camera: THREE.Camera): void {
        const { target, config } = this;
        const n = target.count;

        const centre = new THREE.Vector3();
        for (let i = 0; i < n; i++) centre.add(this.unit.set(target.x[i], target.y[i], target.z[i]));
        if (n > 0) centre.divideScalar(n);

        camera.updateMatrixWorld();
        const view = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const frustum = new THREE.Frustum().setFromProjectionMatrix(view);
        const minElevation = Math.sin(THREE.MathUtils.degToRad(config.minElevationDeg));
        const start = new THREE.Vector3();
        const control = new THREE.Vector3();

        for (let i = 0; i < n; i++) {
            // A random point on the upper hemisphere shell; keep trying until it is outside the view.
            for (let attempt = 0; attempt < MAX_SPAWN_TRIES; attempt++) {
                const up = minElevation + Math.random() * (1 - minElevation);
                const around = Math.random() * Math.PI * 2;
                const flat = Math.sqrt(1 - up * up);
                const radius = config.spawnRadius[0] + Math.random() * (config.spawnRadius[1] - config.spawnRadius[0]);
                start.set(flat * Math.cos(around), up, flat * Math.sin(around)).multiplyScalar(radius).add(centre);
                if (!frustum.containsPoint(start)) break;
            }
            this.startX[i] = start.x; this.startY[i] = start.y; this.startZ[i] = start.z;

            // Bow the path sideways by a random vector, but never below the lower end.
            const endX = target.x[i], endY = target.y[i], endZ = target.z[i];
            const length = Math.hypot(endX - start.x, endY - start.y, endZ - start.z);
            this.randomUnit(control);
            control.multiplyScalar(config.curve * length);
            control.x += (start.x + endX) / 2;
            control.y = Math.max(control.y + (start.y + endY) / 2, Math.min(start.y, endY));
            control.z += (start.z + endZ) / 2;
            this.ctrlX[i] = control.x; this.ctrlY[i] = control.y; this.ctrlZ[i] = control.z;

            this.travel[i] = config.travelSeconds * (0.7 + Math.random() * 0.3);
            this.delay[i] = Math.random() * Math.max(0, config.assembleSeconds - this.travel[i]);

            this.randomUnit(this.unit);
            this.axisX[i] = this.unit.x; this.axisY[i] = this.unit.y; this.axisZ[i] = this.unit.z;
            this.spinSign[i] = Math.random() < 0.5 ? -1 : 1;
        }
    }

    private randomUnit(out: THREE.Vector3): THREE.Vector3 {
        const y = Math.random() * 2 - 1;
        const around = Math.random() * Math.PI * 2;
        const flat = Math.sqrt(1 - y * y);
        return out.set(flat * Math.cos(around), y, flat * Math.sin(around));
    }
}

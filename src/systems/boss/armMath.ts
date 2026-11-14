import type { ArmEase } from '../../config/types/types.ts';

/** Pure maths for boss arms: easing, smoothing, and a Catmull-Rom curve sampled by distance along it. */

/** Share of the gap closed this frame by something that chases its target at `rate` per second (frame-rate independent). */
export function smoothing(rate: number, dt: number): number {
    return 1 - Math.exp(-rate * dt);
}

export function ease(kind: ArmEase | undefined, t: number): number {
    const k = t < 0 ? 0 : t > 1 ? 1 : t;
    switch (kind) {
        case 'in':
            return k * k * k;
        case 'out':
            return 1 - (1 - k) * (1 - k) * (1 - k);
        case 'inOut':
            return k * k * (3 - 2 * k);
        default:
            return k;
    }
}

/**
 * Runs 0 to 1 but swings past 1 and settles back (an "ease out back"). `overshoot` is roughly the fraction by
 * which it goes past (0.1 is about 10%); 0 gives a plain ease out.
 */
export function whip(t: number, overshoot: number): number {
    const k = t < 0 ? 0 : t > 1 ? 1 : t;
    const c1 = overshoot * 17;
    const c3 = c1 + 1;
    const u = k - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
}

/** Ping-pong: 0 to 1 over the first half of `t`, back to 0 over the second. */
export function pingPong(t: number): number {
    const k = t < 0 ? 0 : t > 1 ? 1 : t;
    return k < 0.5 ? k * 2 : (1 - k) * 2;
}

/**
 * A curve through a list of points (x, y, z triples), flattened into a polyline with the distance along it stored
 * for every vertex, so points can be found by distance rather than by curve parameter.
 */
export class SplinePath {
    /** Vertex positions, x y z each. */
    public readonly points: Float64Array;
    /** Distance from the start to each vertex. */
    public readonly lengths: Float64Array;
    public readonly vertexCount: number;
    private readonly spanSamples: number;

    constructor(controlCount: number, spanSamples: number) {
        this.spanSamples = spanSamples;
        this.vertexCount = (controlCount - 1) * spanSamples + 1;
        this.points = new Float64Array(this.vertexCount * 3);
        this.lengths = new Float64Array(this.vertexCount);
    }

    public get totalLength(): number {
        return this.lengths[this.vertexCount - 1];
    }

    /** Rebuilds the polyline from `controls` (x y z triples; the curve passes through all of them). */
    public build(controls: ArrayLike<number>): void {
        const n = controls.length / 3;
        const out = this.points;
        let v = 0;
        for (let span = 0; span < n - 1; span++) {
            const i1 = span;
            const i2 = span + 1;
            const i0 = span === 0 ? 0 : span - 1;
            const i3 = span + 2 >= n ? n - 1 : span + 2;
            // The first and last spans borrow the end points as their missing neighbours.
            for (let s = 0; s < this.spanSamples; s++, v++) {
                const t = s / this.spanSamples;
                for (let axis = 0; axis < 3; axis++) {
                    out[v * 3 + axis] = catmullRom(
                        span === 0 ? 2 * controls[i1 * 3 + axis] - controls[i2 * 3 + axis] : controls[i0 * 3 + axis],
                        controls[i1 * 3 + axis],
                        controls[i2 * 3 + axis],
                        span + 2 >= n ? 2 * controls[i2 * 3 + axis] - controls[i1 * 3 + axis] : controls[i3 * 3 + axis],
                        t,
                    );
                }
            }
        }
        for (let axis = 0; axis < 3; axis++) out[v * 3 + axis] = controls[(n - 1) * 3 + axis];

        this.lengths[0] = 0;
        for (let i = 1; i < this.vertexCount; i++) {
            const dx = out[i * 3] - out[(i - 1) * 3];
            const dy = out[i * 3 + 1] - out[(i - 1) * 3 + 1];
            const dz = out[i * 3 + 2] - out[(i - 1) * 3 + 2];
            this.lengths[i] = this.lengths[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
    }

    /**
     * Writes the point `distance` along the curve (clamped to its ends) to `position` (x y z at `offset`) and the unit
     * direction of the curve there to `tangent`.
     */
    public sample(distance: number, position: Float64Array, tangent: Float64Array, offset: number): void {
        const total = this.totalLength;
        const d = distance < 0 ? 0 : distance > total ? total : distance;

        let lo = 0;
        let hi = this.vertexCount - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (this.lengths[mid] <= d) lo = mid;
            else hi = mid;
        }
        const span = this.lengths[hi] - this.lengths[lo];
        const k = span > 1e-9 ? (d - this.lengths[lo]) / span : 0;

        const p = this.points;
        let tx = p[hi * 3] - p[lo * 3];
        let ty = p[hi * 3 + 1] - p[lo * 3 + 1];
        let tz = p[hi * 3 + 2] - p[lo * 3 + 2];
        position[offset] = p[lo * 3] + tx * k;
        position[offset + 1] = p[lo * 3 + 1] + ty * k;
        position[offset + 2] = p[lo * 3 + 2] + tz * k;

        const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (len > 1e-9) {
            tx /= len;
            ty /= len;
            tz /= len;
        } else {
            tx = 0;
            ty = 0;
            tz = -1;
        }
        tangent[offset] = tx;
        tangent[offset + 1] = ty;
        tangent[offset + 2] = tz;
    }
}

/** One axis of a uniform Catmull-Rom curve between p1 and p2. */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

/**
 * The first fraction (0 to 1) along the path a to b at which a point comes within `radius` of the circle centre c
 * (all on one plane), or -1 if it never does. 0 when the path starts inside the circle.
 */
export function sweptCircleHit(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, radius: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const fx = ax - cx;
    const fz = az - cz;
    const c = fx * fx + fz * fz - radius * radius;
    if (c <= 0) return 0;

    const a = dx * dx + dz * dz;
    if (a < 1e-12) return -1;
    const b = fx * dx + fz * dz;
    const discriminant = b * b - a * c;
    if (b >= 0 || discriminant < 0) return -1;
    const t = (-b - Math.sqrt(discriminant)) / a;
    return t <= 1 ? t : -1;
}

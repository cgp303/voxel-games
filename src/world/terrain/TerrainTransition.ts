/** How a TerrainTransition is shaped. Speeds are units per second along the scroll direction. */
export interface ITerrainTransitionOptions {
    /** Normal scroll speed: the floor, and what the ground eases back to. */
    baseSpeed: number;
    /** Fastest the ground may go. */
    maxSpeed: number;
    /** Seconds from now by which the new terrain should have arrived. */
    seconds: number;
    /** Seconds to accelerate up to the boosted speed. */
    rampUpSeconds: number;
    /** Seconds to ease back to the base speed, finishing at the deadline. */
    rampDownSeconds: number;
    /** Speed the ground is moving at now (a retargeted transition continues smoothly). Defaults to baseSpeed. */
    startSpeed?: number;
}

/** Steps used to integrate the remaining speed profile; the profile is piecewise linear so this is plenty. */
const INTEGRATION_STEPS = 48;

/**
 * Decides how fast the ground scrolls so that new terrain, some distance away, reaches its destination by a deadline.
 *
 * The boost is shaped like a trapezoid: ramp up, hold, ease back to the base speed exactly at the deadline. Each
 * frame the hold speed is solved again from the distance that is really left, so hitches and slower frames are
 * absorbed. When even maxSpeed cannot make the deadline the ground simply goes at maxSpeed until it arrives, then
 * eases back, so the terrain lands a little late rather than the ground rushing past.
 *
 * Pure maths (no rendering types); PlayField feeds it the remaining distance.
 */
export class TerrainTransition {
    private readonly options: ITerrainTransitionOptions;
    private elapsed = 0;
    private current: number;
    private arrived = false;
    private finished = false;

    constructor(options: ITerrainTransitionOptions) {
        this.options = options;
        this.current = options.startSpeed ?? options.baseSpeed;
    }

    /** Speed returned by the latest update (or the start speed before the first). */
    public get speed(): number {
        return this.current;
    }

    /** True once the terrain has arrived and the ground is back to its base speed. */
    public get done(): boolean {
        return this.finished;
    }

    /** True once the terrain has arrived (the ground may still be easing back). */
    public get hasArrived(): boolean {
        return this.arrived;
    }

    /** Stops boosting: the ground eases back to its base speed from wherever it is. */
    public cancel(): void {
        this.arrived = true;
    }

    /**
     * Advances by `dt` seconds and returns the scroll speed to use for this frame.
     * `distanceLeft` is how far the new terrain still has to travel (<= 0 once it has arrived).
     */
    public update(dt: number, distanceLeft: number): number {
        const { baseSpeed, maxSpeed, rampUpSeconds, rampDownSeconds } = this.options;
        if (this.finished) return baseSpeed;
        this.elapsed += dt;
        if (distanceLeft <= 0) this.arrived = true;

        const target = this.arrived ? baseSpeed : this.targetSpeed(distanceLeft);

        // Never change speed faster than the ramps do at full boost, so retargets and the cap switching on stay smooth.
        const boost = Math.max(0, maxSpeed - baseSpeed);
        const up = boost / Math.max(rampUpSeconds, 1e-3);
        const down = boost / Math.max(rampDownSeconds, 1e-3);
        this.current = target >= this.current
            ? Math.min(target, this.current + up * dt)
            : Math.max(target, this.current - down * dt);

        if (this.arrived && Math.abs(this.current - baseSpeed) < 1e-6) {
            this.current = baseSpeed;
            this.finished = true;
        }
        return this.current;
    }

    private targetSpeed(distanceLeft: number): number {
        const { baseSpeed, maxSpeed, seconds } = this.options;
        const remaining = seconds - this.elapsed;

        // Base speed alone gets there in time.
        const extra = distanceLeft - baseSpeed * Math.max(remaining, 0);
        if (extra <= 0) return baseSpeed;
        // Past the deadline and still short: go flat out.
        if (remaining <= 0) return maxSpeed;

        const area = this.remainingShapeArea();
        const hold = area > 1e-6 ? baseSpeed + extra / area : Infinity;
        if (hold >= maxSpeed) {
            // Cannot make it: keep the ramp up but skip the ease back, so the ground does not slow while behind.
            return baseSpeed + (maxSpeed - baseSpeed) * this.rampUpFactor(this.elapsed);
        }
        return baseSpeed + (hold - baseSpeed) * this.shape(this.elapsed);
    }

    private rampUpFactor(t: number): number {
        const { rampUpSeconds } = this.options;
        return rampUpSeconds > 0 ? Math.min(1, Math.max(0, t / rampUpSeconds)) : 1;
    }

    private rampDownFactor(t: number): number {
        const { seconds, rampDownSeconds } = this.options;
        return rampDownSeconds > 0 ? Math.min(1, Math.max(0, (seconds - t) / rampDownSeconds)) : 1;
    }

    /** 0..1: how much of the boost is applied at time t (ramp up, hold, ease back). */
    private shape(t: number): number {
        return this.rampUpFactor(t) * this.rampDownFactor(t);
    }

    /** Integral of shape() from now to the deadline: the boost's area per unit of extra speed. */
    private remainingShapeArea(): number {
        const span = this.options.seconds - this.elapsed;
        if (span <= 0) return 0;
        const step = span / INTEGRATION_STEPS;
        let area = 0;
        for (let i = 0; i < INTEGRATION_STEPS; i++) {
            area += this.shape(this.elapsed + (i + 0.5) * step) * step;
        }
        return area;
    }
}

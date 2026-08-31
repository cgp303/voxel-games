/**
 * Frame timing helper. Tracks variable delta and elapsed time.
 * Fixed-step accumulation can be added later for deterministic gameplay.
 */
export class Time {
    /** Seconds since last frame (clamped) */
    public delta = 0;
    /** Seconds since engine start */
    public elapsed = 0;

    private lastMs = performance.now();
    private readonly maxDelta: number;

    constructor(maxDeltaSeconds = 0.1) {
        this.maxDelta = maxDeltaSeconds;
    }

    /** Call once at the start of each frame */
    public tick(nowMs: number = performance.now()): void {
        const raw = (nowMs - this.lastMs) / 1000;
        this.lastMs = nowMs;
        this.delta = Math.min(Math.max(raw, 0), this.maxDelta);
        this.elapsed += this.delta;
    }

    public reset(): void {
        this.lastMs = performance.now();
        this.delta = 0;
        this.elapsed = 0;
    }
}

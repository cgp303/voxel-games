import { Time } from './Time';

export type EngineTick = (time: Time) => void;

/**
 * Owns the single animation loop. Call start() once after wiring tick.
 * Renderer must not run a parallel rAF/setAnimationLoop.
 */
export class Engine {
    public readonly time = new Time();
    private running = false;
    private rafId: number | null = null;
    private tick: EngineTick | null = null;

    public setTick(tick: EngineTick): void {
        this.tick = tick;
    }

    public start(): void {
        if (this.running) return;
        this.running = true;
        this.time.reset();

        const frame = (now: number) => {
            if (!this.running) return;
            this.rafId = requestAnimationFrame(frame);
            this.time.tick(now);
            this.tick?.(this.time);
        };

        this.rafId = requestAnimationFrame(frame);
    }

    public stop(): void {
        this.running = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    public get isRunning(): boolean {
        return this.running;
    }
}

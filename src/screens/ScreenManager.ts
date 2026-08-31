import type { GameContext } from '../app/GameContext';
import type { Screen } from './Screen';

/**
 * Single active screen with exit → enter transitions.
 */
export class ScreenManager {
    private active: Screen | null = null;
    private ctx: GameContext | null = null;
    private transitioning = false;

    /** Bind shared context once App has built it */
    public setContext(ctx: GameContext): void {
        this.ctx = ctx;
    }

    public getActive(): Screen | null {
        return this.active;
    }

    public async set(screen: Screen): Promise<void> {
        if (!this.ctx) {
            throw new Error('ScreenManager: setContext() before set()');
        }
        if (this.transitioning) {
            console.warn('ScreenManager: transition already in progress');
            return;
        }

        this.transitioning = true;
        try {
            this.active?.exit();
            this.active = screen;
            await Promise.resolve(screen.enter(this.ctx));
        } finally {
            this.transitioning = false;
        }
    }

    public update(dt: number): void {
        this.active?.update(dt);
    }

    public resize(width: number, height: number): void {
        this.active?.resize?.(width, height);
    }
}

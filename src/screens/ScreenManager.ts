import type { IGameContext, IScreen } from '../config/interfaces/interfaces';

/**
 * Single active screen with exit → enter transitions.
 */
export class ScreenManager {
    private active: IScreen | null = null;
    private ctx: IGameContext | null = null;
    private transitioning = false;

    /** Bind shared context once App has built it */
    public setContext(ctx: IGameContext): void {
        this.ctx = ctx;
    }

    public getActive(): IScreen | null {
        return this.active;
    }

    public async set(screen: IScreen): Promise<void> {
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

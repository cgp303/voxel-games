/**
 * Keyboard (and later gamepad) state sampled each frame.
 * Phase 0: keys tracked; screens can poll isDown / wasPressed.
 */
export class Input {
    private down = new Set<string>();
    private pressed = new Set<string>();
    private released = new Set<string>();
    private listening = false;

    private readonly onKeyDown = (e: KeyboardEvent): void => {
        if (e.repeat) return;
        const key = e.key;
        if (!this.down.has(key)) {
            this.down.add(key);
            this.pressed.add(key);
        }
    };

    private readonly onKeyUp = (e: KeyboardEvent): void => {
        const key = e.key;
        this.down.delete(key);
        this.released.add(key);
    };

    public start(): void {
        if (this.listening) return;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        this.listening = true;
    }

    public stop(): void {
        if (!this.listening) return;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        this.listening = false;
        this.down.clear();
        this.pressed.clear();
        this.released.clear();
    }

    /** Clear edge-triggered state at end of frame (after screens update) */
    public endFrame(): void {
        this.pressed.clear();
        this.released.clear();
    }

    public isDown(key: string): boolean {
        return this.down.has(key);
    }

    public wasPressed(key: string): boolean {
        return this.pressed.has(key);
    }

    public wasReleased(key: string): boolean {
        return this.released.has(key);
    }

    /** Convenience: any of these keys pressed this frame */
    public wasAnyPressed(...keys: string[]): boolean {
        return keys.some((k) => this.pressed.has(k));
    }
}

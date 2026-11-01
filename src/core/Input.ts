/**
 * Keyboard state sampled each frame, plus analog movement and auto-fire from the mobileControlHud.
 * Screens poll isDown / wasPressed. A pointer tap (when tap listening is on) is reported as the key TAP_KEY.
 */
export class Input {
    private down = new Set<string>();
    private pressed = new Set<string>();
    private released = new Set<string>();
    private listening = false;
    private tapListening = false;

    /** Analog movement in -1..1 (x: +1 = screen right, z: +1 = forward / up the screen). Added to the keyboard axes. */
    private analog = { x: 0, z: 0 };
    /** True while the play screen has the ship under control (the joystick is shown and auto-fire may run). */
    private playControls = false;
    private autoFireEnabled = false;

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

    private readonly onPointerDown = (): void => {
        this.pressed.add(TAP_KEY);
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
        this.setTapListening(false);
        this.listening = false;
        this.down.clear();
        this.pressed.clear();
        this.released.clear();
        this.setAnalog(0, 0);
    }

    /** Reports any pointer press as a TAP_KEY press (used for tap-to-start on touch devices). */
    public setTapListening(on: boolean): void {
        if (on === this.tapListening) return;
        if (on) window.addEventListener('pointerdown', this.onPointerDown);
        else window.removeEventListener('pointerdown', this.onPointerDown);
        this.tapListening = on;
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

    public setAnalog(x: number, z: number): void {
        this.analog.x = x;
        this.analog.z = z;
    }

    public get analogX(): number {
        return this.analog.x;
    }

    public get analogZ(): number {
        return this.analog.z;
    }

    /** Set by the play screen on enter / exit. Turning it off also centres the analog stick. */
    public setPlayControls(active: boolean): void {
        this.playControls = active;
        if (!active) this.setAnalog(0, 0);
    }

    public get playControlsActive(): boolean {
        return this.playControls;
    }

    /** Whether auto-fire is available at all (mobile controls with autoFire on); it only fires while play controls are active. */
    public setAutoFireEnabled(enabled: boolean): void {
        this.autoFireEnabled = enabled;
    }

    public get autoFire(): boolean {
        return this.autoFireEnabled && this.playControls;
    }
}

/** Pseudo-key reported by wasPressed when a pointer tap happens (see Input.setTapListening). */
export const TAP_KEY = 'Tap';

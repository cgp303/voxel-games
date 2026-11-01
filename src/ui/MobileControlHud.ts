import type { Input } from '../core/Input';
import type { IMobileControlsConfig, IMobileLayout } from '../config/interfaces/interfaces';

/**
 * The mobileControlHud: an on-screen circular joystick for touch devices. The vector from the joystick's centre to
 * the touch point (normalised by the radius, with a dead zone) is written to Input as analog movement; screen up is
 * forward (+Z). Only one pointer drives it at a time. It is active only while Input.playControlsActive is set
 * (the play screen); otherwise it is dimmed and lets touches through.
 */
export class MobileControlHud {
    private readonly root: HTMLDivElement;
    private readonly knob: HTMLDivElement;
    private readonly input: Input;
    private readonly config: IMobileControlsConfig;

    private pointerId: number | null = null;
    private active = false;
    private mode: IMobileLayout['mode'] = 'side';

    constructor(input: Input, config: IMobileControlsConfig) {
        this.input = input;
        this.config = config;

        this.root = document.createElement('div');
        this.root.id = 'mobile-control-hud';
        const base = document.createElement('div');
        base.className = 'mch-base';
        this.knob = document.createElement('div');
        this.knob.className = 'mch-knob';
        const knobPercent = config.knobFraction * 100;
        this.knob.style.width = `${knobPercent}%`;
        this.knob.style.height = `${knobPercent}%`;
        this.root.append(base, this.knob);
        document.body.appendChild(this.root);

        this.root.addEventListener('pointerdown', this.onPointerDown);
        this.root.addEventListener('pointermove', this.onPointerMove);
        this.root.addEventListener('pointerup', this.onPointerEnd);
        this.root.addEventListener('pointercancel', this.onPointerEnd);
        this.root.addEventListener('lostpointercapture', this.onPointerEnd);
        this.applyState();
    }

    /** Positions the joystick (CSS px, window-relative). */
    public layout(layout: IMobileLayout): void {
        const { joystick } = layout;
        this.root.style.left = `${joystick.left}px`;
        this.root.style.top = `${joystick.top}px`;
        this.root.style.width = `${joystick.width}px`;
        this.root.style.height = `${joystick.height}px`;
        this.mode = layout.mode;
        this.applyState();
    }

    /** Call once per frame: follows Input.playControlsActive. */
    public update(): void {
        const active = this.input.playControlsActive;
        if (active === this.active) return;
        this.active = active;
        if (!active) this.release();
        this.applyState();
    }

    public dispose(): void {
        this.release();
        this.root.removeEventListener('pointerdown', this.onPointerDown);
        this.root.removeEventListener('pointermove', this.onPointerMove);
        this.root.removeEventListener('pointerup', this.onPointerEnd);
        this.root.removeEventListener('pointercancel', this.onPointerEnd);
        this.root.removeEventListener('lostpointercapture', this.onPointerEnd);
        this.root.remove();
    }

    private applyState(): void {
        this.root.classList.toggle('mch-active', this.active);
        this.root.classList.toggle('mch-overlay', this.mode === 'overlay');
        this.root.style.opacity = this.mode === 'overlay' ? String(this.config.overlayOpacity) : '';
    }

    private readonly onPointerDown = (e: PointerEvent): void => {
        if (!this.active || this.pointerId !== null) return;
        e.preventDefault();
        this.pointerId = e.pointerId;
        this.root.setPointerCapture(e.pointerId);
        this.track(e);
    };

    private readonly onPointerMove = (e: PointerEvent): void => {
        if (e.pointerId !== this.pointerId) return;
        e.preventDefault();
        this.track(e);
    };

    private readonly onPointerEnd = (e: PointerEvent): void => {
        if (e.pointerId !== this.pointerId) return;
        this.release();
    };

    /** Converts the touch point to a movement vector and moves the knob to match. */
    private track(e: PointerEvent): void {
        const rect = this.root.getBoundingClientRect();
        const radius = rect.width / 2;
        if (radius <= 0) return;
        let dx = (e.clientX - (rect.left + radius)) / radius;
        let dy = (e.clientY - (rect.top + radius)) / radius;
        const length = Math.hypot(dx, dy);
        if (length > 1) {
            dx /= length;
            dy /= length;
        }
        const reach = Math.min(length, 1);

        const knobTravel = radius * (1 - this.config.knobFraction);
        this.setKnob(dx * knobTravel, dy * knobTravel);

        const { deadZone, responseExponent, response, diagonalSectorDeg } = this.config;
        if (reach <= deadZone) {
            this.input.setAnalog(0, 0);
            return;
        }
        // Unit direction. Screen-down is +clientY, so up the screen (forward, +Z) is -dy.
        const ux = dx / reach;
        const uz = -dy / reach;

        switch (response) {
            case 'digital': {
                // An axis is on when the direction is more than half a diagonal sector away from the other axis.
                const sectorDeg = Math.min(90, Math.max(0, diagonalSectorDeg));
                const threshold = Math.sin(((90 - sectorDeg) / 2) * (Math.PI / 180));
                this.input.setAnalog(
                    Math.abs(ux) > threshold ? Math.sign(ux) : 0,
                    Math.abs(uz) > threshold ? Math.sign(uz) : 0,
                );
                break;
            }
            case 'constant': {
                // Circle -> square: the larger axis is always 1, so a 45° push is (1, 1) like a keyboard diagonal.
                const scale = 1 / Math.max(Math.abs(ux), Math.abs(uz));
                this.input.setAnalog(ux * scale, uz * scale);
                break;
            }
            default: {
                const magnitude = Math.pow((reach - deadZone) / (1 - deadZone), responseExponent);
                this.input.setAnalog(ux * magnitude, uz * magnitude);
            }
        }
    }

    private release(): void {
        if (this.pointerId !== null && this.root.hasPointerCapture(this.pointerId)) {
            this.root.releasePointerCapture(this.pointerId);
        }
        this.pointerId = null;
        this.setKnob(0, 0);
        this.input.setAnalog(0, 0);
    }

    private setKnob(x: number, y: number): void {
        this.knob.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    }
}

import { Vector3 } from 'three';
import { FORMATION } from '../data/constants';
import type { EntrySide, FormationConfig, FormationSlot } from '../app/types';

/**
 * Logical flock root + slot grid.
 * Invaders read live homes each frame (root may move). Scene meshes stay under
 * PlayField.invaderRoot; this controller does not own Three.js objects.
 */
export class FormationController {
    private config: FormationConfig = { ...FORMATION };
    private readonly rootPosition = new Vector3();
    private readonly rootVelocity = new Vector3();
    /** Hover Y baked at setup (absolute). */
    private hoverY = 0;
    private centerSideToggle: EntrySide = 'left';
    private ready = false;

    /**
     * @param terrainHeight PlayField.bounds.height used when config.hoverY is null
     * @param configOverride partial overrides of FORMATION defaults
     */
    public setup(
        terrainHeight = 0,
        configOverride: Partial<FormationConfig> = {},
    ): void {
        this.config = { ...FORMATION, ...configOverride };
        this.hoverY =
            this.config.hoverY ?? terrainHeight + this.config.hoverPadding;

        this.rootPosition.set(
            this.config.originX,
            this.hoverY,
            this.config.originZ,
        );
        this.rootVelocity.set(
            this.config.rootVelocityX,
            0,
            this.config.rootVelocityZ,
        );
        this.centerSideToggle = 'left';
        this.ready = true;
    }

    public update(dt: number): void {
        if (!this.ready || dt === 0) return;
        this.rootPosition.x += this.rootVelocity.x * dt;
        this.rootPosition.y += this.rootVelocity.y * dt;
        this.rootPosition.z += this.rootVelocity.z * dt;
    }

    public getConfig(): Readonly<FormationConfig> {
        return this.config;
    }

    public getRootPosition(): Readonly<Vector3> {
        return this.rootPosition;
    }

    public getRootVelocity(): Readonly<Vector3> {
        return this.rootVelocity;
    }

    /** Centerline X for mirrored entry paths (formation root X). */
    public getCenterX(): number {
        return this.rootPosition.x;
    }

    public getHoverY(): number {
        return this.hoverY;
    }

    public get cols(): number {
        return this.config.cols;
    }

    public get rows(): number {
        return this.config.rows;
    }

    public isReady(): boolean {
        return this.ready;
    }

    /** Slot offset relative to formation root (y is 0 — height is on root). */
    public slotOffset(col: number, row: number, out = new Vector3()): Vector3 {
        const { cols, rows, spacing } = this.config;
        const x = (col - (cols - 1) / 2) * spacing;
        const z = (row - (rows - 1) / 2) * spacing;
        return out.set(x, 0, z);
    }

    public getWorldHome(col: number, row: number, out = new Vector3()): Vector3 {
        this.slotOffset(col, row, out);
        out.x += this.rootPosition.x;
        out.y += this.rootPosition.y;
        out.z += this.rootPosition.z;
        return out;
    }

    public getWorldHomeSlot(slot: FormationSlot, out = new Vector3()): Vector3 {
        return this.getWorldHome(slot.col, slot.row, out);
    }

    // public getSlot(col: number, row: number): FormationSlot {
    //     return { col, row };
    // }

    public isCenterCol(col: number): boolean {
        const { cols } = this.config;
        return cols % 2 === 1 && col === Math.floor(cols / 2);
    }

    public mirrorSlot(slot: FormationSlot): FormationSlot {
        return {
            col: this.config.cols - 1 - slot.col,
            row: slot.row,
        };
    }

    /**
     * Left-half slots for pair spawn (excludes center column when cols is odd).
     * Order: top → bottom (high row / +Z first), then col 0..(half-1) within each row.
     */
    public leftHalfSlots(): FormationSlot[] {
        const slots: FormationSlot[] = [];
        const half = Math.floor(this.config.cols / 2);
        for (let row = this.config.rows - 1; row >= 0; row--) {
            for (let col = 0; col < half; col++) {
                slots.push({ col, row });
            }
        }
        return slots;
    }

    /** Center-column slots only (odd col counts). Empty when cols is even. Top → bottom. */
    public centerColumnSlots(): FormationSlot[] {
        if (this.config.cols % 2 === 0) return [];
        const col = Math.floor(this.config.cols / 2);
        const slots: FormationSlot[] = [];
        for (let row = this.config.rows - 1; row >= 0; row--) {
            slots.push({ col, row });
        }
        return slots;
    }

    public forEachSlot(fn: (slot: FormationSlot) => void): void {
        for (let row = this.config.rows - 1; row >= 0; row--) {
            for (let col = 0; col < this.config.cols; col++) {
                fn({ col, row });
            }
        }
    }

    /**
     * Next spawn side for an odd center-column solo entry; alternates each call.
     */
    public nextCenterSide(): EntrySide {
        const side = this.centerSideToggle;
        this.centerSideToggle = side === 'left' ? 'right' : 'left';
        return side;
    }

    /** Debug / tests: force root velocity without re-setup. */
    public setRootVelocity(x: number, z: number, y = 0): void {
        this.rootVelocity.set(x, y, z);
    }

    /** Debug / tests: teleport root (homes move immediately). */
    public setRootPosition(x: number, y: number, z: number): void {
        this.rootPosition.set(x, y, z);
    }
}

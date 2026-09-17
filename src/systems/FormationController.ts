import { Vector3 } from 'three';
import { FORMATION } from '../data/constants';
import type { FormationConfig, FormationSlot } from '../app/types';
import { FormationDescriptor } from '../app/types';
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
    private ready = false;
    private descriptor: FormationDescriptor | null = null;
    private _maxCol: number = 0;
    private _maxRow: number = 0;


    public setup(terrainHeight: number, descriptor: FormationDescriptor): void {
        this.descriptor = descriptor;

        // keep root motion config
        this.hoverY = terrainHeight + this.config.hoverPadding;

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
        this._maxCol = this.descriptor!.maxCol;
        this._maxRow = this.descriptor!.maxRow;
        this.ready = true;
    }

    public get maxCol(): number {
        return this._maxCol;
    }

    public get maxRow(): number {
        return this._maxRow;
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

    public isReady(): boolean {
        return this.ready;
    }

    public slotOffset(col: number, row: number, out = new Vector3()): Vector3 {
        const key = `${col},${row}`;
        const s = this.descriptor!.map.get(key);
        if (!s) {
            throw new Error(`FormationController: missing slot offset for key ${key}`);
        }
        return out.set(s.x, 0, s.z);
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

    public getSpawnOrder(): string[][] {
        return this.descriptor!.spawnOrder;
    }

    public getSpawnType(): FormationDescriptor["spawnType"] {
        return this.descriptor!.spawnType;
    }


    // public getSlot(col: number, row: number): FormationSlot {
    //     return { col, row };
    // }


    /** Debug / tests: force root velocity without re-setup. */
    public setRootVelocity(x: number, z: number, y = 0): void {
        this.rootVelocity.set(x, y, z);
    }

    /** Debug / tests: teleport root (homes move immediately). */
    public setRootPosition(x: number, y: number, z: number): void {
        this.rootPosition.set(x, y, z);
    }
}

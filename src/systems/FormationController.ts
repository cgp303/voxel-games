import { Vector3 } from 'three';
import { FORMATION } from '../config/data/constants';
import type { IFormationSlot, IFormationConfig, IFormationDescriptor, IPathPattern } from '../config/interfaces/interfaces';

/**
 * Logical flock root + slot grid.
 * Invaders read live homes each frame (root may move). Scene meshes stay under
 * PlayField.invaderRoot; this controller does not own Three.js objects.
 */
export class FormationController {

    private config: IFormationConfig = { ...FORMATION };
    private readonly rootPosition = new Vector3();
    private readonly rootVelocity = new Vector3();
    /** Hover Y baked at setup (absolute). */
    private hoverY = 0;
    private ready = false;
    private descriptor: IFormationDescriptor | null = null;
    private _maxCol: number = 0;
    private _maxRow: number = 0;

    private pattern: IPathPattern | null = null;
    private patternT = 0;

    private tempVec3 = new Vector3();


    public setup(terrainHeight: number, descriptor: IFormationDescriptor): void {
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

        if (this.pattern) {
            this.patternT += dt / this.pattern.duration;
            this.pattern.samplePosition(this.patternT, this.rootPosition);
            if (this.patternT >= 1) {
                this.patternT -= 1;  // or use modulo: this.patternT %= 1
            }
        } else {
            // Linear velocity as fallback
            this.rootPosition.x += this.rootVelocity.x * dt;
            this.rootPosition.y += this.rootVelocity.y * dt;
            this.rootPosition.z += this.rootVelocity.z * dt;
        }
    }

    public setPattern(pattern: IPathPattern): void {
        this.pattern = pattern;
        this.patternT = 0;
    }

    // Predicts the world position of a slot at the time of docking based on the current pattern and dive duration.
    public getPredictedEndPosition(col: number, row: number, diveDuration: number, out = new Vector3()): Vector3 {
        if (!this.pattern) {
            return this.getWorldHomeSlot({ col, row }, out);
        }

        const patternDuration = this.pattern.duration;
        const tLanding = (this.patternT + diveDuration / patternDuration) % 1;
        const centerAtLanding = this.pattern.samplePosition(tLanding, this.tempVec3);
        const offset = this.slotOffset(col, row);
        return out.copy(centerAtLanding).add(offset);
    }

    public getAdjustedPositionForGroupReturn(groupCenterPosition: Vector3, attackDuration: number, out = new Vector3()): Vector3 {
        if (!this.pattern) {
            return out.copy(groupCenterPosition);
        }

        // Store current formation center
        const currentFormationCenter = new Vector3().copy(this.rootPosition);

        // Predict where formation center will be after attackDuration
        const tLanding = (this.patternT + attackDuration / this.pattern.duration) % 1;
        const futureFormationCenter = this.pattern.samplePosition(tLanding, new Vector3());

        // Calculate how far formation moved
        const offset = futureFormationCenter.sub(currentFormationCenter);

        // Apply offset to group center position
        return out.copy(groupCenterPosition).add(offset);
    }

    public getConfig(): Readonly<IFormationConfig> {
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

    //
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

    public getWorldHomeSlot(slot: IFormationSlot, out = new Vector3()): Vector3 {
        return this.getWorldHome(slot.col, slot.row, out);
    }

    public getSpawnOrder(): string[][] {
        return this.descriptor!.spawnOrder;
    }

    public getSpawnType(): IFormationDescriptor["spawnType"] {
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

import { Vector3, Line3 } from 'three';
import {
    sampleCubic,
    sampleCubicDerivative,
} from '../../path/cubicBezier';
import type { IPathSegment, ICubicBezierControls } from '../../../config/interfaces/interfaces';

export class BasePathSegment implements IPathSegment {
    public readonly controls: ICubicBezierControls;
    private spinRate = 0;
    private _allowInversion = false;
    private orientationSmoothing = 1;

    constructor(controls: Line3 | ICubicBezierControls,
        spinRate: number = 0,
        allowInversion: boolean = false,
        orientationSmoothing: number = 1
    ) {
        this.controls = controls;
        this.spinRate = spinRate;
        this._allowInversion = allowInversion;
        this.orientationSmoothing = orientationSmoothing;
    }

    public sampleOrientationSmoothing(): number {
        return this.orientationSmoothing;
    }

    public sampleSpinRate(t: number): number {
        return this.spinRate;
    }

    public get allowInversion(): boolean {
        return this._allowInversion;
    }

    public samplePosition(t: number, out: Vector3): Vector3 {
        const { p0, p1, p2, p3 } = this.controls;
        return sampleCubic(p0, p1, p2, p3, t, out);
    }

    public sampleTangent(t: number, out: Vector3): Vector3 {
        const { p0, p1, p2, p3 } = this.controls;
        return sampleCubicDerivative(p0, p1, p2, p3, t, out);
    }

    public sampleTargetSpin(t: number): number {
        return t * this.spinRate;
    }
}

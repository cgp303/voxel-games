import { Vector3 } from 'three';
import {
    sampleCubic,
    sampleCubicDerivative,
    type CubicBezierControls,
} from '../../path/cubicBezier';
import { BasePathSegment } from './BasePathSegment';

export class CubicBezierSegment extends BasePathSegment {
    public readonly controls: CubicBezierControls;


    constructor(controls: CubicBezierControls, spinRate: number = 0, allowInversion: boolean = false, orientationSmoothing: number = 1) {
        super(controls, spinRate, allowInversion, orientationSmoothing);
        this.controls = controls;

    }

    public samplePosition(t: number, out: Vector3): Vector3 {
        const { p0, p1, p2, p3 } = this.controls;
        return sampleCubic(p0, p1, p2, p3, t, out);
    }

    public sampleTangent(t: number, out: Vector3): Vector3 {
        const { p0, p1, p2, p3 } = this.controls;
        return sampleCubicDerivative(p0, p1, p2, p3, t, out);
    }
}

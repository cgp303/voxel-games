import { Vector3 } from 'three';
import {
    sampleCubic,
    sampleCubicDerivative,
    type CubicBezierControls,
} from '../../path/cubicBezier';
import type { PathSegment } from '../interfaces';

export class CubicBezierSegment implements PathSegment {
    public readonly controls: CubicBezierControls;

    private readonly posScratch = new Vector3();
    private readonly tanScratch = new Vector3();
    private spinRate = 0;

    constructor(controls: CubicBezierControls, spinRate: number = 0) {
        this.controls = controls;
        this.spinRate = spinRate;
    }

    public sampleSpinRate(t: number): number {
        return this.spinRate;
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

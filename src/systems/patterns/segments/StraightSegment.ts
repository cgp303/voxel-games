import { BasePathSegment } from './BasePathSegment';
import type { Line3 } from 'three';
import { Vector3 } from 'three';

export class StraightSegment extends BasePathSegment {
    private a: Vector3;
    private b: Vector3;

    constructor(line: Line3, spinRate: number = 0, allowInversion: boolean = false) {
        super(line, spinRate, allowInversion);
        this.a = line.start;
        this.b = line.end;
    }

    samplePosition(t: number, out: Vector3): Vector3 {
        out.copy(this.a).lerp(this.b, t);
        return out;
    }

    sampleTangent(t: number, out: Vector3): Vector3 {
        out.subVectors(this.b, this.a).normalize();
        return out;
    }

    // public sampleSpinRate(t: number): number {
    //     return this.spinRate;
    // }

    // public get allowInversion(): boolean {
    //     return this._allowInversion;
    // }
}

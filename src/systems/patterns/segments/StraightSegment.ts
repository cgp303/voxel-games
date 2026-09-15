import { PathSegment } from "../interfaces";
import { Vector3 } from 'three';

export class StraightSegment implements PathSegment {
    private a: Vector3;
    private b: Vector3;
    private spinRate: number;

    constructor(a: Vector3, b: Vector3, spinRate: number = 0) {
        this.a = a;
        this.b = b;
        this.spinRate = spinRate;
    }

    samplePosition(t: number, out: Vector3): Vector3 {
        out.copy(this.a).lerp(this.b, t);
        return out;
    }

    sampleTangent(t: number, out: Vector3): Vector3 {
        out.subVectors(this.b, this.a).normalize();
        return out;
    }

    public sampleSpinRate(t: number): number {
        return this.spinRate;
    }
}

import { PathSegment } from "../interfaces";
import { Vector3 } from 'three';

export class StraightSegment implements PathSegment {
    private a: Vector3;
    private b: Vector3;

    constructor(a: Vector3, b: Vector3) {
        this.a = a;
        this.b = b;
    }

    samplePosition(t, out) {
        out.copy(this.a).lerp(this.b, t);
        return out;
    }

    sampleTangent(t, out) {
        out.subVectors(this.b, this.a).normalize();
        return out;
    }
}

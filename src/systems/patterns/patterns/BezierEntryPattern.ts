import { Vector3 } from 'three';
import type { PathPattern } from '../interfaces';
import type { PathSegment } from '../interfaces';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';

export class BezierEntryPattern implements PathPattern {
    public readonly duration: number;
    private readonly segment: PathSegment;

    private readonly posScratch = new Vector3();
    private readonly tanScratch = new Vector3();

    constructor(segment: CubicBezierSegment, duration: number) {
        this.segment = segment;
        this.duration = duration;
    }

    public samplePosition(t: number, out: Vector3): Vector3 {
        return this.segment.samplePosition(t, out);
    }

    public sampleTangent(t: number, out: Vector3): Vector3 {
        return this.segment.sampleTangent(t, out);
    }
}

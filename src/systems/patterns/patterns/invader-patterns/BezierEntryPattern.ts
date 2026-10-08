import { Vector3 } from 'three';
import type { IPathPattern } from '../../../../config/interfaces/interfaces';
import type { IPathSegment } from '../../../../config/interfaces/interfaces';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';

export class BezierEntryPattern implements IPathPattern {
    public readonly duration: number;
    private readonly segment: IPathSegment;

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

    public sampleSpinRate(t: number): number {
        return this.segment.sampleSpinRate(t);
    }

    public sampleTargetSpin(t: number): number {
        return this.segment.sampleTargetSpin(t);
    }

    public allowInversion(t: number): boolean {
        return this.segment.allowInversion;
    }

    public sampleOrientationSmoothing(t: number): number {

        return this.segment.sampleOrientationSmoothing();
    }

}

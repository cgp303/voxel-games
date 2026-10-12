import { Vector3 } from 'three';
import type { IPathPattern, IPathSegment } from '../../../config/interfaces/interfaces';
import type { AttackPatternId } from '../../../config/types/types';

export class MultiSegmentPattern implements IPathPattern {
    public readonly duration: number;
    public readonly durationOverlap: number;
    public readonly id?: AttackPatternId;
    private readonly segments: IPathSegment[];
    private readonly ranges: { start: number; end: number }[];

    constructor(
        segments: IPathSegment[],
        ranges: { start: number; end: number }[],
        duration: number,
        durationOverlap: number = 0,
        id?: AttackPatternId
    ) {
        this.segments = segments;
        this.ranges = ranges;
        this.duration = duration;
        this.durationOverlap = durationOverlap; // or set it to an appropriate value based on your logic
        this.id = id;
    }

    public getSegmentIndex(t: number): number {
        return this.findSegmentIndex(t);
    }

    private findSegmentIndex(t: number): number {
        for (let i = 0; i < this.ranges.length; i++) {
            const r = this.ranges[i];
            if (t >= r.start && t < r.end) return i;
        }
        return this.ranges.length - 1;
    }

    private remapToLocalT(t: number, index: number): number {
        const r = this.ranges[index];
        return (t - r.start) / (r.end - r.start);
    }

    public samplePosition(t: number, out: Vector3): Vector3 {
        const idx = this.findSegmentIndex(t);
        const lt = this.remapToLocalT(t, idx);
        return this.segments[idx].samplePosition(lt, out);
    }

    public sampleTangent(t: number, out: Vector3): Vector3 {
        const idx = this.findSegmentIndex(t);
        const lt = this.remapToLocalT(t, idx);
        return this.segments[idx].sampleTangent(lt, out);
    }

    public sampleSpinRate(t: number): number {
        const segIndex = this.findSegmentIndex(t);
        const seg = this.segments[segIndex];
        const localT = this.remapToLocalT(t, segIndex);
        return seg.sampleSpinRate(localT);
    }

    public sampleTargetSpin(t: number): number {
        const segIndex = this.findSegmentIndex(t);
        const seg = this.segments[segIndex];
        const localT = this.remapToLocalT(t, segIndex);
        return seg.sampleTargetSpin(localT);
    }

    public allowInversion(t: number): boolean {
        const segIndex = this.findSegmentIndex(t);
        const seg = this.segments[segIndex];
        return seg.allowInversion;
    }
    public sampleOrientationSmoothing(t: number): number {
        const segIndex = this.findSegmentIndex(t);
        const seg = this.segments[segIndex];
        return seg.sampleOrientationSmoothing();
    }
}

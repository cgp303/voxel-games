import { Vector3 } from 'three';
import type { PathPattern, PathSegment } from '../interfaces';

export class MultiSegmentPattern implements PathPattern {
    public readonly duration: number;
    private readonly segments: PathSegment[];
    private readonly ranges: { start: number; end: number }[];

    constructor(
        segments: PathSegment[],
        ranges: { start: number; end: number }[],
        duration: number,
    ) {
        this.segments = segments;
        this.ranges = ranges;
        this.duration = duration;
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
}

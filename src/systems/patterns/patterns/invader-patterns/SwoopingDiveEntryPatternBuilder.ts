import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../../patterns/MultiSegmentPattern';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

/**
 * Swooping dive: aggressive downward dive then recovery into formation.
 * Two segments: dive phase and recovery phase.
 */
export class SwoopingDiveEntryPatternBuilder implements IPatternBuilder {
    private static readonly SPIN_RATES = [Math.PI * 3, Math.PI * 2];
    private static readonly RANGES = [
        { start: 0, end: 0.5 },
        { start: 0.5, end: 1 },
    ];
    private static readonly ALLOW_INVERSION = [false, false];
    private static readonly ORIENTATION_SMOOTHING = [7, 7];
    private static readonly DURATION = 2.8;
    private static readonly OVERLAP = 0;

    duration(): number {
        return SwoopingDiveEntryPatternBuilder.DURATION;
    }

    overlap(): number {
        return SwoopingDiveEntryPatternBuilder.OVERLAP;
    }

    build(origin: Vector3, side: number, endPosition: Vector3, _path: number = 0): MultiSegmentPattern {
        const start = origin.clone();
        const end = endPosition.clone();
        const segments: CubicBezierSegment[] = [];

        const diveDepth = 25;
        const midpoint = new Vector3().lerpVectors(start, end, 0.5);
        midpoint.y -= diveDepth; // Dive downward at midpoint

        // Segment 1: Dive down
        const p0_seg1 = start.clone();
        const p1_seg1 = new Vector3().lerpVectors(start, midpoint, 0.3);
        const p2_seg1 = new Vector3().lerpVectors(start, midpoint, 0.7);
        const p3_seg1 = midpoint.clone();

        const seg1 = new CubicBezierSegment(
            { p0: p0_seg1, p1: p1_seg1, p2: p2_seg1, p3: p3_seg1 },
            SwoopingDiveEntryPatternBuilder.SPIN_RATES[0],
            SwoopingDiveEntryPatternBuilder.ALLOW_INVERSION[0],
            SwoopingDiveEntryPatternBuilder.ORIENTATION_SMOOTHING[0]
        );

        // Segment 2: Recovery up to formation
        const p0_seg2 = midpoint.clone();
        const p1_seg2 = new Vector3().lerpVectors(midpoint, end, 0.3);
        const p2_seg2 = new Vector3().lerpVectors(midpoint, end, 0.7);
        const p3_seg2 = end.clone();

        const seg2 = new CubicBezierSegment(
            { p0: p0_seg2, p1: p1_seg2, p2: p2_seg2, p3: p3_seg2 },
            SwoopingDiveEntryPatternBuilder.SPIN_RATES[1],
            SwoopingDiveEntryPatternBuilder.ALLOW_INVERSION[1],
            SwoopingDiveEntryPatternBuilder.ORIENTATION_SMOOTHING[1]
        );

        segments.push(seg1, seg2);

        return new MultiSegmentPattern(
            segments,
            SwoopingDiveEntryPatternBuilder.RANGES,
            SwoopingDiveEntryPatternBuilder.DURATION,
            SwoopingDiveEntryPatternBuilder.OVERLAP,
            'entrySwoopingDive'
        );
    }
}
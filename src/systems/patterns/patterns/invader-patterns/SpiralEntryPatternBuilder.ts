import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../../patterns/MultiSegmentPattern';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

/**
 * Spiral entry: invader spirals around the centerline as it enters.
 * Split into multiple segments (full spirals) for granular weapon control.
 */
export class SpiralEntryPatternBuilder implements IPatternBuilder {
    private static readonly SPIN_RATES = [Math.PI * 2, Math.PI * 2, Math.PI * 2];
    private static readonly RANGES = [
        { start: 0, end: 0.33 },
        { start: 0.33, end: 0.67 },
        { start: 0.67, end: 1 },
    ];
    private static readonly ALLOW_INVERSION = [false, false, false];
    private static readonly ORIENTATION_SMOOTHING = [6, 6, 6];
    private static readonly DURATION = 3.0;
    private static readonly OVERLAP = 0;

    duration(): number {
        return SpiralEntryPatternBuilder.DURATION;
    }

    overlap(): number {
        return SpiralEntryPatternBuilder.OVERLAP;
    }

    build(origin: Vector3, side: number, endPosition: Vector3, _path: number = 0): MultiSegmentPattern {
        const start = origin.clone();
        const end = endPosition.clone();
        const segments: CubicBezierSegment[] = [];

        const spiralTurns = 1.5;
        const radiusAtStart = 20;
        const sideSign = side === 1 ? 1 : -1;
        const centerX = 0;

        // Create 3 segments for the spiral
        for (let seg = 0; seg < 3; seg++) {
            const tStart = seg / 3;
            const tEnd = (seg + 1) / 3;

            // Position along the entry path
            const pos1 = new Vector3().lerpVectors(start, end, tStart);
            const pos2 = new Vector3().lerpVectors(start, end, tEnd);

            // Spiral radius decreases over time
            const radiusAtTStart = radiusAtStart * (1 - tStart);
            const radiusAtTEnd = radiusAtStart * (1 - tEnd);

            // Angles around the spiral
            const angle1 = tStart * spiralTurns * Math.PI * 2;
            const angle2 = tEnd * spiralTurns * Math.PI * 2;

            // Offset from center line
            const offset1 = Math.cos(angle1) * radiusAtTStart;
            const offset2 = Math.cos(angle2) * radiusAtTEnd;

            pos1.x += offset1;
            pos2.x += offset2;

            // Create bezier curve for this segment
            const p0 = seg === 0 ? start.clone() : new Vector3().lerpVectors(start, end, tStart);
            const p3 = seg === 2 ? end.clone() : new Vector3().lerpVectors(start, end, tEnd);

            // Control points guide the spiral
            const p1 = new Vector3().copy(p0).add(new Vector3(offset1 * 0.5, 0, 2));
            const p2 = new Vector3().copy(p3).add(new Vector3(offset2 * 0.5, 0, -2));

            const controls: ICubicBezierControls = { p0, p1, p2, p3 };

            const segment = new CubicBezierSegment(
                controls,
                SpiralEntryPatternBuilder.SPIN_RATES[seg],
                SpiralEntryPatternBuilder.ALLOW_INVERSION[seg],
                SpiralEntryPatternBuilder.ORIENTATION_SMOOTHING[seg]
            );

            segments.push(segment);
        }

        return new MultiSegmentPattern(
            segments,
            SpiralEntryPatternBuilder.RANGES,
            SpiralEntryPatternBuilder.DURATION,
            SpiralEntryPatternBuilder.OVERLAP,
            'entrySpiral'
        );
    }
}
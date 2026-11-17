import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../MultiSegmentPattern';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

/**
 * Standard entry: bottom-heavy bulge, smooth arc into formation.
 * Single segment (or treat as 1 segment for weapon targeting).
 */
export class FromAboveEntryPattern implements IPatternBuilder {
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 150, 600),
            p1: new Vector3(0, 75, 150),
            p2: new Vector3(0, 50, 0),
            p3: new Vector3(0, 20, -170)
        },
        {
            p0: new Vector3(0, 20, -170),
            p1: new Vector3(0, 20, -170),
            p2: new Vector3(0, 20, -170),
            p3: new Vector3(0, 20, -170)
        },
        {
            p0: new Vector3(0, 20, -170),
            p1: new Vector3(0, 20, -110),
            p2: new Vector3(0, 20, -50),
            p3: new Vector3(0, 20, -0)
        },
        {
            p0: new Vector3(0, 20, 0),
            p1: new Vector3(0, 20, 50),
            p2: new Vector3(0, 20, 50),
            p3: new Vector3(0, 20, 0)
        }
    ];
    private static readonly SPIN_RATES = [0, 0, Math.PI, Math.PI];
    private static readonly RANGES = [
        { start: 0, end: 0.2 }, { start: 0.2, end: 0.66 }, { start: 0.66, end: 0.83 }, { start: 0.83, end: 1 },
    ];
    private static readonly DURATION = 9.0; // example duration in seconds
    private static readonly OVERLAP = 2;

    duration(): number {
        return FromAboveEntryPattern.DURATION;
    }

    overlap(): number {
        return FromAboveEntryPattern.OVERLAP;
    }

    build(origin: Vector3, side: number, endPosition: Vector3, path: number = 0): MultiSegmentPattern {
        const start = origin.clone();
        const end = endPosition.clone();
        const last = FromAboveEntryPattern.SEGMENTS.length - 1;
        const xMultiplier = side === 0 ? -1 : 1;


        const segments = FromAboveEntryPattern.SEGMENTS.map((canonical, i) => {
            // side 1 = canonical (right); side 0 = mirrored across the formation centerline (x=0)
            const controls = {
                p0: canonical.p0.clone(),
                p1: canonical.p1.clone(),
                p2: canonical.p2.clone(),
                p3: canonical.p3.clone(),
            }

            if (i == 0) {
                // controls.p0.x = start.x * 0.25 * xMultiplier;
                controls.p1.x = start.x * 0.1;
                controls.p2.x = start.x * 0.2;
                controls.p3.x = start.x * 0.3;
            }

            if (i == 1 || i == 2) {
                controls.p0.x = 25 * xMultiplier;
                controls.p1.x = 65 * xMultiplier;
                controls.p2.x = 65 * xMultiplier;
                controls.p3.x = 25 * xMultiplier;
            }

            if (i === 3) {
                controls.p0.x = 25 * xMultiplier;
                controls.p1.x = -65 * xMultiplier;
                controls.p2.x = -65 * xMultiplier;
                // controls.p3.x = 45 * xMultiplier;
            }

            // if (i === 3) {
            //     controls.p0.x = end.x * 0.45;
            //     controls.p1.x = end.x * 0.5;
            //     controls.p2.x = end.x * 0.55;
            //     controls.p3.x = end.x * 0.6;
            // }

            // if (i === 0) controls.p0.copy(start);       // live spawn point, not a mirrored via-point
            if (i === last) controls.p3.copy(end); // live dock point, not a mirrored via-point

            return new CubicBezierSegment(controls, FromAboveEntryPattern.SPIN_RATES[i], false);
        });

        return new MultiSegmentPattern(
            segments,
            FromAboveEntryPattern.RANGES,
            FromAboveEntryPattern.DURATION,
            FromAboveEntryPattern.OVERLAP,
            'entryFromAbove'
        );
    }
}
import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../../patterns/MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../../path/cubicBezier';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

export class ColumnDivesPatternBuilder implements IPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        { p0: new Vector3(0, 0, 0), p1: new Vector3(0.69, 20, 49.71), p2: new Vector3(-0.34, 20, 194.54), p3: new Vector3(40.25, 20, 179.06) },
        { p0: new Vector3(40.25, 20, 179.06), p1: new Vector3(77.06, 20, 162.2), p2: new Vector3(80.16, 20, 50.4), p3: new Vector3(80.16, 20, -0.17) },
        { p0: new Vector3(80.16, 20, -0.17), p1: new Vector3(79.12, 20, -40.08), p2: new Vector3(79.12, 20, -89.96), p3: new Vector3(45.41, 20, -89.62) },
        { p0: new Vector3(45.41, 20, -89.62), p1: new Vector3(31.99, 20, -88.93), p2: new Vector3(10.32, 20, -82.39), p3: new Vector3(0, 0, 0) },
    ];
    private static readonly SPIN_RATES = [0, Math.PI, Math.PI, 0];
    private static readonly RANGES = [
        { start: 0, end: 0.27 }, { start: 0.27, end: 0.54 }, { start: 0.54, end: 0.8 }, { start: 0.8, end: 1 },
    ];
    private static readonly DURATION = 5; // example duration in seconds

    duration(): number {
        return ColumnDivesPatternBuilder.DURATION;
    }

    build(origin: Vector3, side: number, endPosition: Vector3): MultiSegmentPattern {
        const start = origin.clone();
        const last = ColumnDivesPatternBuilder.SEGMENTS.length - 1;

        const segments = ColumnDivesPatternBuilder.SEGMENTS.map((canonical, i) => {
            // side 1 = canonical (right); side 0 = mirrored across the formation centerline (x=0)
            const controls = side === 1
                ? {
                    p0: canonical.p0.clone(),
                    p1: canonical.p1.clone(),
                    p2: canonical.p2.clone(),
                    p3: canonical.p3.clone(),
                }
                : mirrorCubicControlsX(canonical, 0);

            if (i === 0) controls.p0.copy(start);       // live spawn point, not a mirrored via-point
            if (i === last) controls.p3.copy(endPosition); // live dock point, not a mirrored via-point

            return new CubicBezierSegment(controls, ColumnDivesPatternBuilder.SPIN_RATES[i], false);
        });

        return new MultiSegmentPattern(segments, ColumnDivesPatternBuilder.RANGES, ColumnDivesPatternBuilder.DURATION);
    }
}
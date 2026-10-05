import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../path/cubicBezier';
import type { IPatternBuilder, ICubicBezierControls } from '../../../config/interfaces/interfaces';

export class FigureEightPatternBuilder implements IPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 0, 0),
            p1: new Vector3(19.83, 20, 69.57),
            p2: new Vector3(117.66, 20, 61.02),
            p3: new Vector3(88.49, 20, 0.2)
        },
        {
            p0: new Vector3(88.49, 20, 0.2),
            p1: new Vector3(42.33, 20, -4.56),
            p2: new Vector3(-32.82, 20, -47.48),
            p3: new Vector3(40.78, 20, -74.08)
        },
        {
            p0: new Vector3(40.78, 20, -74.08),
            p1: new Vector3(89.72, 20, -76.8),
            p2: new Vector3(127.78, 20, -8.25),
            p3: new Vector3(0, 0, 0)
        }
    ];
    private static readonly SPIN_RATES = [0, 0, 0];
    private static readonly RANGES = [
        { start: 0, end: 0.3 }, { start: 0.3, end: 0.7 }, { start: 0.7, end: 1 },
    ];
    private static readonly ALLOW_INVERSION = [
        false, false, false,
    ];
    private static readonly ORIENTATION_SMOOTHING = [1, 1, 1,];
    private static readonly DURATION = 4;
    private static readonly DURATION_OVERLAP = 1;

    build(origin: Vector3, side: number): MultiSegmentPattern {
        const start = origin.clone();
        const last = FigureEightPatternBuilder.SEGMENTS.length - 1;

        const segments = FigureEightPatternBuilder.SEGMENTS.map((canonical, i) => {
            // side 1 = canonical (right); side 0 = mirrored across the formation centerline (x=0)
            const controls = side === 1
                ? {
                    p0: canonical.p0.clone(),
                    p1: canonical.p1.clone(),
                    p2: canonical.p2.clone(),
                    p3: canonical.p3.clone(),
                }
                : mirrorCubicControlsX(canonical, 0);

            if (i === 0) controls.p0.copy(start);   // live spawn point, not a mirrored via-point
            if (i === last) controls.p3.copy(start); // live dock point, not a mirrored via-point

            return new CubicBezierSegment(controls,
                FigureEightPatternBuilder.SPIN_RATES[i],
                FigureEightPatternBuilder.ALLOW_INVERSION[i],
                FigureEightPatternBuilder.ORIENTATION_SMOOTHING[i],
            );
        });

        return new MultiSegmentPattern(
            segments,
            FigureEightPatternBuilder.RANGES,
            FigureEightPatternBuilder.DURATION,
            FigureEightPatternBuilder.DURATION_OVERLAP
        );
    }
}
import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../../path/cubicBezier';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

export class LazerBAttackPatternBuilder implements IPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 0, 0),
            p1: new Vector3(0, 30, 80),
            p2: new Vector3(100, 25, 80),
            p3: new Vector3(100, 20, 0),
        },
        {
            p0: new Vector3(100, 20, 0),
            p1: new Vector3(100, 20, -60),
            p2: new Vector3(100, 20, -80),
            p3: new Vector3(70, 20, -80),
        },
        {
            p0: new Vector3(70, 20, -80),
            p1: new Vector3(0, 20, -80),
            p2: new Vector3(0, 20, -80),
            p3: new Vector3(-70, 20, -80),
        },
        {
            p0: new Vector3(-70, 20, -80),
            p1: new Vector3(-100, 20, -80),
            p2: new Vector3(-50, 20, -20),
            p3: new Vector3(0, 0, 0)
        },
    ];
    private static readonly SPIN_RATES = [0, 0, 0, 0];
    private static readonly RANGES = [
        { start: 0, end: 0.25 }, { start: 0.25, end: 0.45 }, { start: 0.45, end: 0.8 }, { start: 0.8, end: 1 },
    ];
    private static readonly DURATION = 5; // example duration in seconds
    private static readonly OVERLAP = 4;

    duration(): number {
        return LazerBAttackPatternBuilder.DURATION;
    }

    overlap(): number {
        return LazerBAttackPatternBuilder.OVERLAP;
    }

    build(origin: Vector3, side: number, endPosition: Vector3, path: number = 0): MultiSegmentPattern {
        const start = origin.clone();
        const last = LazerBAttackPatternBuilder.SEGMENTS.length - 1;

        const segments = LazerBAttackPatternBuilder.SEGMENTS.map((canonical, i) => {
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

            return new CubicBezierSegment(controls, LazerBAttackPatternBuilder.SPIN_RATES[i], false);
        });

        return new MultiSegmentPattern(segments, LazerBAttackPatternBuilder.RANGES, LazerBAttackPatternBuilder.DURATION, LazerBAttackPatternBuilder.OVERLAP, 'lazerBAttack');
    }
}
import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../path/cubicBezier';
import type { CubicBezierControls } from '../../path/cubicBezier';
import type { PatternBuilder } from '../interfaces';

export class GroupAttackPattern2Builder implements PatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: CubicBezierControls[] = [
        {
            p0: new Vector3(0, 0, 0),
            p1: new Vector3(48.37, 20, 204.94),
            p2: new Vector3(114.05, 20, -150.97),
            p3: new Vector3(6.62, 20, -163.7),
        },
        {
            p0: new Vector3(6.62, 20, -163.7),
            p1: new Vector3(-96.78, 20, -152.44),
            p2: new Vector3(14.15, 20, -13.2),
            p3: new Vector3(0, 0, 0),
        },
    ];
    private static readonly SPIN_RATES = [0, Math.PI * 4];
    private static readonly RANGES = [
        { start: 0, end: 0.5 }, { start: 0.5, end: 1 },
    ];
    private static readonly ALLOW_INVERSION = [false, false];
    private static readonly ORIENTATION_SMOOTHING = [1, 1];

    build(origin: Vector3, side: number): MultiSegmentPattern {
        const start = origin.clone();
        const last = GroupAttackPattern2Builder.SEGMENTS.length - 1;

        const segments = GroupAttackPattern2Builder.SEGMENTS.map((canonical, i) => {
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

            return new CubicBezierSegment(
                controls,
                GroupAttackPattern2Builder.SPIN_RATES[i],
                GroupAttackPattern2Builder.ALLOW_INVERSION[i],
                GroupAttackPattern2Builder.ORIENTATION_SMOOTHING[i]
            );
        });

        return new MultiSegmentPattern(segments, GroupAttackPattern2Builder.RANGES, 6, 0);
    }

}
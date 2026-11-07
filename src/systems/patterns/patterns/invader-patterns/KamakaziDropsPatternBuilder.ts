import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../../path/cubicBezier';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

export class KamakaziDropsPatternBuilder implements IPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 0, 0),
            p1: new Vector3(0, 20, 0),
            p2: new Vector3(0, 20, -100),
            p3: new Vector3(0, 20, -180)
        },
        {
            p0: new Vector3(0, 20, -180),
            p1: new Vector3(0, 20, -100),
            p2: new Vector3(0, 20, 0),
            p3: new Vector3(0, 20, -0.17)
        }
    ];
    private static readonly SPIN_RATES = [0, Math.PI];
    private static readonly RANGES = [
        { start: 0, end: 0.4 }, { start: 0.4, end: 1 },
    ];
    private static readonly DURATION = 3.5; // example duration in seconds
    private static readonly OVERLAP = 2;

    duration(): number {
        return KamakaziDropsPatternBuilder.DURATION;
    }

    overlap(): number {
        return KamakaziDropsPatternBuilder.OVERLAP;
    }

    build(origin: Vector3, side: number, endPosition: Vector3, path: number = 0): MultiSegmentPattern {
        const start = origin.clone();
        const last = KamakaziDropsPatternBuilder.SEGMENTS.length - 1;

        const segments = KamakaziDropsPatternBuilder.SEGMENTS.map((canonical, i) => {
            // side 1 = canonical (right); side 0 = mirrored across the formation centerline (x=0)
            const controls = {
                p0: canonical.p0.clone(),
                p1: canonical.p1.clone(),
                p2: canonical.p2.clone(),
                p3: canonical.p3.clone(),
            }

            if (i <= last) {
                controls.p0.x = start.x;
                controls.p1.x = start.x - 30;
                controls.p2.x = start.x + 30;
                controls.p3.x = start.x;
            }

            if (i === 0) controls.p0.copy(start);       // live spawn point, not a mirrored via-point
            if (i === last) controls.p3.copy(endPosition); // live dock point, not a mirrored via-point

            return new CubicBezierSegment(controls, KamakaziDropsPatternBuilder.SPIN_RATES[i], false);
        });

        return new MultiSegmentPattern(segments, KamakaziDropsPatternBuilder.RANGES, KamakaziDropsPatternBuilder.DURATION, KamakaziDropsPatternBuilder.OVERLAP, 'kamakaziDrops');
    }
}
import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../MultiSegmentPattern';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

export class SimpleLoopFormationPatternBuilder implements IPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 20, 78),
            p1: new Vector3(20, 20, 38),
            p2: new Vector3(20, 20, 118),
            p3: new Vector3(0, 20, 78),
        },
        {
            p0: new Vector3(0, 20, 78),
            p1: new Vector3(-20, 20, 118),
            p2: new Vector3(-20, 20, -38),
            p3: new Vector3(0, 20, 78),
        },
    ];
    private static readonly SPIN_RATES = [0, 0];
    private static readonly RANGES = [
        { start: 0, end: 0.5 }, { start: 0.5, end: 1 },
    ];
    private static readonly DURATION = 30; // example duration in seconds

    duration(): number {
        return SimpleLoopFormationPatternBuilder.DURATION;
    }

    build(origin: Vector3, side: number, endPosition: Vector3 = new Vector3(0, 0, 0)): MultiSegmentPattern {
        const start = origin.clone();
        const last = SimpleLoopFormationPatternBuilder.SEGMENTS.length - 1;

        const segments = SimpleLoopFormationPatternBuilder.SEGMENTS.map((canonical, i) => {
            // side 1 = canonical (right); side 0 = mirrored across the formation centerline (x=0)
            const controls = {
                p0: canonical.p0.clone(),
                p1: canonical.p1.clone(),
                p2: canonical.p2.clone(),
                p3: canonical.p3.clone(),
            }

            return new CubicBezierSegment(controls, SimpleLoopFormationPatternBuilder.SPIN_RATES[i], false);
        });

        return new MultiSegmentPattern(segments, SimpleLoopFormationPatternBuilder.RANGES, SimpleLoopFormationPatternBuilder.DURATION);
    }
}
import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../MultiSegmentPattern';
import type { ICubicBezierControls, IFormationPatternBuilder } from '../../../../config/interfaces/interfaces';

export class Level4LoopFormationPatternBuilder implements IFormationPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 20, 100),
            p1: new Vector3(30, 20, 150),
            p2: new Vector3(60, 20, 200),
            p3: new Vector3(90, 20, 250),
        },
        {
            p0: new Vector3(90, 20, 250),
            p1: new Vector3(60, 20, 200),
            p2: new Vector3(30, 20, 150),
            p3: new Vector3(0, 20, 100),
        },
        {
            p0: new Vector3(0, 20, 100),
            p1: new Vector3(60, 20, 0),
            p2: new Vector3(60, 20, 0),
            p3: new Vector3(0, 20, -50),
        },
        {
            p0: new Vector3(0, 20, -50),
            p1: new Vector3(-60, 20, 0),
            p2: new Vector3(-60, 20, 0),
            p3: new Vector3(0, 20, 100),
        },
    ];
    private static readonly SPIN_RATES = [0, 0];
    private static readonly RANGES = [
        { start: 0, end: 0.25 }, { start: 0.25, end: 0.5 }, { start: 0.5, end: 0.75 }, { start: 0.75, end: 1 },
    ];
    private static readonly DURATION = 10; // example duration in seconds
    private static readonly OVERLAP = 0;

    duration(): number {
        return Level4LoopFormationPatternBuilder.DURATION;
    }
    overlap(): number {
        return Level4LoopFormationPatternBuilder.OVERLAP;
    }

    build(): MultiSegmentPattern {

        const segments = Level4LoopFormationPatternBuilder.SEGMENTS.map((canonical, i) => {
            // side 1 = canonical (right); side 0 = mirrored across the formation centerline (x=0)
            const controls = {
                p0: canonical.p0.clone(),
                p1: canonical.p1.clone(),
                p2: canonical.p2.clone(),
                p3: canonical.p3.clone(),
            }

            return new CubicBezierSegment(controls, Level4LoopFormationPatternBuilder.SPIN_RATES[i], false);
        });

        return new MultiSegmentPattern(segments, Level4LoopFormationPatternBuilder.RANGES, Level4LoopFormationPatternBuilder.DURATION, Level4LoopFormationPatternBuilder.OVERLAP);
    }
}
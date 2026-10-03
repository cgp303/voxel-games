import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';
//import { mirrorCubicControlsX } from '../../path/cubicBezier';
import type { CubicBezierControls } from '../../path/cubicBezier';
import type { PatternBuilder } from '../interfaces';

export class ColumnVerticalPatternBuilder implements PatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: CubicBezierControls[] = [
        {
            p0: new Vector3(0, 0, 0),
            p1: new Vector3(0, 20, 120),
            p2: new Vector3(0, 25, 120),
            p3: new Vector3(0, 30, 120),
        },
        {
            p0: new Vector3(0, 30, 120),
            p1: new Vector3(0, 35, 110),
            p2: new Vector3(0, 35, 100),
            p3: new Vector3(0, 30, 60),
        },
        {
            p0: new Vector3(0, 30, 60),
            p1: new Vector3(0, 20, 20),
            p2: new Vector3(0, 20, 20),
            p3: new Vector3(0, 20, -70),
        },
        {
            p0: new Vector3(0, 20, -70),
            p1: new Vector3(0, 0, 0),
            p2: new Vector3(-140, 20, -20),
            p3: new Vector3(0, 0, 0),
        },
    ];
    private static readonly SPIN_RATES = [0, 0, 0, 0];
    private static readonly RANGES = [
        { start: 0, end: 0.15 }, { start: 0.15, end: 0.3 }, { start: 0.3, end: 0.6 }, { start: 0.6, end: 1 },
    ];
    private static readonly ALLOW_INVERSION = [
        true, true, false, false,
    ];
    private static readonly ORIENTATION_SMOOTHING = [1, 1, 0.4, 1,];

    build(origin: Vector3, side: number): MultiSegmentPattern {

        const start = origin.clone();
        const last = ColumnVerticalPatternBuilder.SEGMENTS.length - 1;
        let prevControls: CubicBezierControls;

        const segments = ColumnVerticalPatternBuilder.SEGMENTS.map((canonical, i) => {

            let controls;
            if (i < last) {
                controls = {
                    p0: canonical.p0.clone(),
                    p1: canonical.p1.clone(),
                    p2: canonical.p2.clone(),
                    p3: canonical.p3.clone(),
                };
                this.updateXValue(controls, start);
            }

            if (i === last) {
                controls = {
                    p0: new Vector3(start.x, canonical.p0.y, canonical.p0.z),
                    p1: this.smoothSegmentJoins(prevControls),
                    p2: new Vector3(side === 0 ? -140 : 140, canonical.p2.y, canonical.p2.z),
                    p3: start.clone(),
                };
            }

            if (i === 0) controls.p0.copy(start);   // live spawn point, not a mirrored via-point
            if (i === last) controls.p3.copy(start); // live dock point, not a mirrored via-point

            prevControls = controls;

            return new CubicBezierSegment(controls,
                ColumnVerticalPatternBuilder.SPIN_RATES[i],
                ColumnVerticalPatternBuilder.ALLOW_INVERSION[i],
                ColumnVerticalPatternBuilder.ORIENTATION_SMOOTHING[i],
            );
        });

        return new MultiSegmentPattern(segments, ColumnVerticalPatternBuilder.RANGES, 5, 1);
    }

    updateXValue(controls, start) {
        controls.p0.x = start.x;
        controls.p1.x = start.x;
        controls.p2.x = start.x;
        controls.p3.x = start.x;
    }

    smoothSegmentJoins(prevSegment) {
        const arrivalVector = prevSegment.p3.clone().sub(prevSegment.p2);

        const nextP0 = prevSegment.p3.clone();
        const tamingScale = 0.6;
        const arrivalVectorLength = arrivalVector.length() * tamingScale;
        const nextP1 = nextP0.clone().add(
            arrivalVector.clone().normalize().multiplyScalar(arrivalVectorLength),
        );
        return nextP1;
    }
}

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../../patterns/MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../../path/cubicBezier';
//import type { CubicBezierControls } from '../../path/cubicBezier';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

export class GroupAttackPattern1Builder implements IPatternBuilder {
    // Canonical RIGHT-side path; must be real Vector3 instances (mirror helpers need .clone()/.set()).
    private static readonly SEGMENTS: ICubicBezierControls[] = [
        {
            p0: new Vector3(0, 0, 0),
            p1: new Vector3(50.69, 30, 190.84),
            p2: new Vector3(90.01, 30, 190.02),
            p3: new Vector3(150.85, 20, 50),
        },
        {
            p0: new Vector3(150.85, 20, 50),
            p1: new Vector3(0, 0, 0),
            p2: new Vector3(30, 20, 25),
            p3: new Vector3(-150.85, 20, 0),
        },
        {
            p0: new Vector3(-150.85, 20, 0),
            p1: new Vector3(0, 0, 0),
            p2: new Vector3(0, 20, -45),
            p3: new Vector3(150.85, 20, -50),
        },
        {
            p0: new Vector3(150.85, 20, -50),
            p1: new Vector3(0, 0, 0),
            p2: new Vector3(0, 20, -70),
            p3: new Vector3(-150, 20, 0),
        },
        {
            p0: new Vector3(-150, 20, 0),
            p1: new Vector3(0, 0, 0),
            p2: new Vector3(0, 20, 0),
            p3: new Vector3(0, 0, 0),
        },
    ];
    private static readonly SPIN_RATES = [0, 0, 0, 0, Math.PI * 4];
    private static readonly RANGES = [
        { start: 0, end: 0.2 }, { start: 0.2, end: 0.4 }, { start: 0.4, end: 0.6 }, { start: 0.6, end: 0.8 }, { start: 0.8, end: 1 },
    ];
    private static readonly ALLOW_INVERSION = [false, false, false, false, false];
    private static readonly ORIENTATION_SMOOTHING = [1, 1, 1, 1, 1];
    private static readonly DURATION = 9.5; // example duration in seconds

    duration(): number {
        return GroupAttackPattern1Builder.DURATION;
    }

    build(origin: Vector3, side: number, endPosition: Vector3): MultiSegmentPattern {
        const start = origin.clone();
        const last = GroupAttackPattern1Builder.SEGMENTS.length - 1;
        let prevControls: ICubicBezierControls;


        const segments = GroupAttackPattern1Builder.SEGMENTS.map((canonical, i) => {
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
            if (i > 0) controls.p1.copy(this.smoothSegmentJoins(prevControls));
            if (i === last) controls.p3.copy(endPosition); // live dock point, not a mirrored via-point

            prevControls = controls;

            return new CubicBezierSegment(
                controls,
                GroupAttackPattern1Builder.SPIN_RATES[i],
                GroupAttackPattern1Builder.ALLOW_INVERSION[i],
                GroupAttackPattern1Builder.ORIENTATION_SMOOTHING[i]
            );
        });

        return new MultiSegmentPattern(segments, GroupAttackPattern1Builder.RANGES, GroupAttackPattern1Builder.DURATION);
    }

    smoothSegmentJoins(prevSegment) {
        const arrivalVector = prevSegment.p3.clone().sub(prevSegment.p2);

        const nextP0 = prevSegment.p3.clone();
        const tamingScale = 0.4;
        const arrivalVectorLength = arrivalVector.length() * tamingScale;
        const nextP1 = nextP0.clone().add(
            arrivalVector.clone().normalize().multiplyScalar(arrivalVectorLength),
        );

        return nextP1;

    }
}
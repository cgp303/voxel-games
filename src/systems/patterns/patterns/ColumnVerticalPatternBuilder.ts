// systems/patterns/patterns/ColumnVerticalPatternBuilder.ts

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';

export class ColumnVerticalPatternBuilder {

    private debugBezier;

    constructor(scene) {

    }

    build(invader, side): MultiSegmentPattern {
        const start = invader.position.clone();
        const spinRate = Math.PI * 2;
        const orientationSmoothing = 0.4;
        const noSmoothing = 1;

        const pAsegment1 = new CubicBezierSegment({
            p0: new Vector3(start.x, start.y, start.z),
            p1: new Vector3(start.x, 20, 120),
            p2: new Vector3(start.x, 25, 120),
            p3: new Vector3(start.x, 30, 120),
        }, 0, true, noSmoothing);

        const pAsegment2 = new CubicBezierSegment({
            p0: new Vector3(start.x, 30, 120),
            p1: new Vector3(start.x, 35, 110),
            p2: new Vector3(start.x, 35, 100),
            p3: new Vector3(start.x, 30, 60),
        }, 0, true, noSmoothing);

        const pAsegment3 = new CubicBezierSegment({
            p0: new Vector3(start.x, 30, 60),
            p1: new Vector3(start.x, 20, 20),
            p2: new Vector3(start.x, 20, 20),
            p3: new Vector3(start.x, 20, -70),
        }, 0, false, orientationSmoothing);

        const pAsegment4 = new CubicBezierSegment({
            p0: new Vector3(start.x, 20, -70),
            p1: this.smoothSegmentJoins(pAsegment3),
            p2: new Vector3(-140, 20, -20),
            p3: new Vector3(start.x, start.y, start.z),
        }, 0, false, noSmoothing);

        const pBsegment4 = new CubicBezierSegment({
            p0: new Vector3(start.x, 20, -70),
            p1: this.smoothSegmentJoins(pAsegment3),
            p2: new Vector3(140, 20, -20),
            p3: new Vector3(start.x, start.y, start.z),
        }, 0, false, noSmoothing);


        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2, pAsegment3, pAsegment4],
            [{ start: 0, end: 0.15 }, { start: 0.15, end: 0.3 }, { start: 0.3, end: 0.6 }, { start: 0.6, end: 1 }],
            4,
            1
        )

        const patternB = new MultiSegmentPattern(
            [pAsegment1, pAsegment2, pAsegment3, pBsegment4],
            [{ start: 0, end: 0.15 }, { start: 0.15, end: 0.3 }, { start: 0.3, end: 0.6 }, { start: 0.6, end: 1 }],
            4,
            1
        )


        return (side === 0) ? patternA : patternB;
    }

    smoothSegmentJoins(prevSegment) {
        const arrivalVector = prevSegment.controls.p3.clone().sub(prevSegment.controls.p2);

        const nextP0 = prevSegment.controls.p3.clone();
        const tamingScale = 0.6;
        const arrivalVectorLength = arrivalVector.length() * tamingScale;
        const nextP1 = nextP0.clone().add(
            arrivalVector.clone().normalize().multiplyScalar(arrivalVectorLength),
        );


        return nextP1;

    }

}

// systems/patterns/patterns/GroupAttackPatternBuilder.ts

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from './MultiSegmentPattern';

export class GroupAttackPattern1Builder {

    constructor() {

    }

    build(centralPosition: Vector3, side): MultiSegmentPattern {

        const start = centralPosition.clone();

        const spinRate = Math.PI * 4;

        const pAsegment1 = new CubicBezierSegment({
            p0: new Vector3(start.x, start.y, start.z),
            p1: new Vector3(50.69, 20, 190.84),
            p2: new Vector3(90.01, 20, 190.02),
            p3: new Vector3(150.85, 20, 50),
        }, 0);

        const pAsegment2 = new CubicBezierSegment({
            p0: new Vector3(150.85, 20, 50),
            p1: this.smoothSegmentJoins(pAsegment1),
            p2: new Vector3(30, 20, 25),
            p3: new Vector3(-150.85, 20, 0),
        }, 0);

        const pAsegment3 = new CubicBezierSegment({
            p0: new Vector3(-150.85, 20, 0),
            p1: this.smoothSegmentJoins(pAsegment2),
            p2: new Vector3(0, 20, -45),
            p3: new Vector3(150.85, 20, -50),
        }, 0);

        const pAsegment4 = new CubicBezierSegment({
            p0: new Vector3(150.85, 20, -50),
            p1: this.smoothSegmentJoins(pAsegment3),
            p2: new Vector3(0, 20, -70),
            p3: new Vector3(-150, 20, -90),
        }, 0);


        const pAsegment5 = new CubicBezierSegment({
            p0: new Vector3(-150, 20, -90),
            p1: this.smoothSegmentJoins(pAsegment4),
            p2: new Vector3(0, 20, 0),
            p3: new Vector3(start.x, start.y, start.z),
        }, spinRate);

        const pBsegment1 = new CubicBezierSegment({
            p0: new Vector3(start.x, start.y, start.z),
            p1: new Vector3(-50.69, 20, 190.84),
            p2: new Vector3(-70.01, 20, 190.02),
            p3: new Vector3(-150.85, 20, 50),
        }, 0);

        const pBsegment2 = new CubicBezierSegment({
            p0: new Vector3(-150.85, 20, 50),
            p1: this.smoothSegmentJoins(pBsegment1),
            p2: new Vector3(0, 20, 25),
            p3: new Vector3(150.85, 20, 0),
        }, 0);

        const pBsegment3 = new CubicBezierSegment({
            p0: new Vector3(150.85, 20, 0),
            p1: this.smoothSegmentJoins(pBsegment2),
            p2: new Vector3(0, 20, -45),
            p3: new Vector3(-150.85, 20, -50),
        }, 0);

        const pBsegment4 = new CubicBezierSegment({
            p0: new Vector3(-150.85, 20, -50),
            p1: this.smoothSegmentJoins(pBsegment3),
            p2: new Vector3(0, 20, -70),
            p3: new Vector3(150, 20, -90),
        }, 0);

        const pBsegment5 = new CubicBezierSegment({
            p0: new Vector3(150, 20, -90),
            p1: this.smoothSegmentJoins(pBsegment4),
            p2: new Vector3(0, 20, 0),
            p3: new Vector3(start.x, start.y, start.z),
        }, spinRate);

        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2, pAsegment3, pAsegment4, pAsegment5],
            [{ start: 0, end: 0.2 }, { start: 0.2, end: 0.4 }, { start: 0.4, end: 0.6 }, { start: 0.6, end: 0.8 }, { start: 0.8, end: 1 }],
            9.5,
            0,
        )

        const patternB = new MultiSegmentPattern(
            [pBsegment1, pBsegment2, pBsegment3, pBsegment4, pBsegment5],
            [{ start: 0, end: 0.2 }, { start: 0.2, end: 0.4 }, { start: 0.4, end: 0.6 }, { start: 0.6, end: 0.8 }, { start: 0.8, end: 1 }],
            9.5,
            0,
        )

        return (side === 0) ? patternB : patternA;
    }

    smoothSegmentJoins(prevSegment) {
        const arrivalVector = prevSegment.controls.p3.clone().sub(prevSegment.controls.p2);

        const nextP0 = prevSegment.controls.p3.clone();
        const tamingScale = 0.4;
        const arrivalVectorLength = arrivalVector.length() * tamingScale;
        const nextP1 = nextP0.clone().add(
            arrivalVector.clone().normalize().multiplyScalar(arrivalVectorLength),
        );

        return nextP1;

    }

}



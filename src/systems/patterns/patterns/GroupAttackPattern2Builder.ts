// systems/patterns/patterns/GroupAttackPatternBuilder.ts

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from './MultiSegmentPattern';

export class GroupAttackPattern2Builder {

    constructor() {
    }

    build(centralPosition: Vector3, side): MultiSegmentPattern {

        const start = centralPosition.clone();

        const spinRate = Math.PI * 4;

        const pAsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: 48.37, y: 20, z: 204.94 },
            p2: { x: 114.05, y: 20, z: -150.97 },
            p3: { x: 6.62, y: 20, z: -163.7 },
        }, 0);

        const pAsegment2 = new CubicBezierSegment({
            p0: { x: 6.62, y: 20, z: -163.7 },
            p1: { x: -96.78, y: 20, z: -152.44 },
            p2: { x: 14.15, y: 20, z: -13.2 },
            p3: { x: start.x, y: start.y, z: start.z },
        }, spinRate);

        const pBsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: -48.37, y: 20, z: 204.94 },
            p2: { x: -114.05, y: 20, z: -150.97 },
            p3: { x: -6.62, y: 20, z: -163.7 },
        }, 0);

        const pBsegment2 = new CubicBezierSegment({
            p0: { x: -6.62, y: 20, z: -163.7 },
            p1: { x: 96.78, y: 20, z: -152.44 },
            p2: { x: -14.15, y: 20, z: -13.2 },
            p3: { x: start.x, y: start.y, z: start.z },
        }, spinRate);

        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2],
            [{ start: 0, end: 0.5 }, { start: 0.5, end: 1 }],
            6,
            0,
        )

        const patternB = new MultiSegmentPattern(
            [pBsegment1, pBsegment2],
            [{ start: 0, end: 0.5 }, { start: 0.5, end: 1 }],
            6,
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



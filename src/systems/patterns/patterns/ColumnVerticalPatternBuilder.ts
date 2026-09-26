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

        const pAsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: start.x, y: 20, z: 120 },
            p2: { x: start.x, y: 25, z: 120 },
            p3: { x: start.x, y: 30, z: 120 },
        }, 0);

        const pAsegment2 = new CubicBezierSegment({
            p0: { x: start.x, y: 30, z: 120 },
            p1: { x: start.x, y: 35, z: 110 },
            p2: { x: start.x, y: 35, z: 100 },
            p3: { x: start.x, y: 40, z: 90 },
        }, 0);


        // const pAsegment2 = new CubicBezierSegment({
        //     p0: { x: 40.25, y: 20, z: 179.06 },
        //     p1: { x: 77.06, y: 20, z: 162.2 },
        //     p2: { x: 80.16, y: 20, z: 50.4 },
        //     p3: { x: 80.16, y: 20, z: -0.17 },
        // }, spinRate);

        // const pAsegment3 = new CubicBezierSegment({
        //     p0: { x: 80.16, y: 20, z: -0.17 },
        //     p1: { x: 79.12, y: 20, z: -40.08 },
        //     p2: { x: 79.12, y: 20, z: -89.96 },
        //     p3: { x: 45.41, y: 20, z: -89.62 },
        // }, spinRate);


        // const pAsegment4 = new CubicBezierSegment({
        //     p0: { x: 45.41, y: 20, z: -89.62 },
        //     p1: { x: 31.99, y: 20, z: -88.93 },
        //     p2: { x: 10.32, y: 20, z: -82.39 },
        //     p3: { x: start.x, y: start.y, z: start.z },
        // }, 0);

        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2],
            [{ start: 0, end: 0.5 }, { start: 0.5, end: 1 }],
            1,
        )

        // const pBsegment1 = new CubicBezierSegment({
        //     p0: { x: start.x, y: start.y, z: start.z },
        //     p1: { x: -0.69, y: 20, z: 49.71 },
        //     p2: { x: 0.34, y: 20, z: 194.54 },
        //     p3: { x: -40.25, y: 20, z: 179.06 },
        // }, 0);


        // const pBsegment2 = new CubicBezierSegment({
        //     p0: { x: -40.25, y: 20, z: 179.06 },
        //     p1: { x: -77.06, y: 20, z: 162.2 },
        //     p2: { x: -80.16, y: 20, z: 50.4 },
        //     p3: { x: -80.16, y: 20, z: -0.17 },
        // }, spinRate);

        // const pBsegment3 = new CubicBezierSegment({
        //     p0: { x: -80.16, y: 20, z: -0.17 },
        //     p1: { x: -79.12, y: 20, z: -40.08 },
        //     p2: { x: -79.12, y: 20, z: -89.96 },
        //     p3: { x: -45.41, y: 20, z: -89.62 },
        // }, spinRate);


        // const pBsegment4 = new CubicBezierSegment({
        //     p0: { x: -45.41, y: 20, z: -89.62 },
        //     p1: { x: -31.99, y: 20, z: -88.93 },
        //     p2: { x: -10.32, y: 20, z: -82.39 },
        //     p3: { x: start.x, y: start.y, z: start.z },
        // }, 0);

        // const patternB = new MultiSegmentPattern(
        //     [pBsegment1],
        //     [{ start: 0, end: 1 }],
        //     6,
        // )

        return patternA;
    }

}

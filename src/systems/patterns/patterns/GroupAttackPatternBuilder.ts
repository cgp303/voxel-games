// systems/patterns/patterns/GroupAttackPatternBuilder.ts

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';

export class GroupAttackPatternBuilder {

    private debugBezier;

    constructor(scene) {
        //this.debugBezier = new BezierDebugRenderer(scene);
    }

    build(invader, side): MultiSegmentPattern {
        const start = invader.position.clone();
        const spinRate = Math.PI * 2;

        // const pAsegment1 = new CubicBezierSegment({
        //     p0: { x: start.x, y: start.y, z: start.z },
        //     p1: { x: start.x - 1.72, y: 20, z: start.z + 97.87 },
        //     p2: { x: start.x - 20.99, y: 20, z: start.z + 97.53 },
        //     p3: { x: start.x - 55.98, y: 20, z: start.z + 86.16 },
        // }, 0);


        // const pAsegment2 = new CubicBezierSegment({
        //     p0: { x: start.x - 55.98, y: 20, z: start.z + 86.16 },
        //     p1: { x: start.x - 88.07, y: 20, z: start.z + 63.82 },
        //     p2: { x: start.x - 85.32, y: 20, z: start.z + 4.99 },
        //     p3: { x: start.x - 60.99, y: 20, z: start.z - 32.68 },
        // }, spinRate);

        // const pAsegment3 = new CubicBezierSegment({
        //     p0: { x: start.x - 60.99, y: 20, z: start.z - 32.68 },
        //     p1: { x: start.x - 50.35, y: 20, z: start.z - 49.57 },
        //     p2: { x: start.x + 31.59, y: 20, z: start.z - 51.13 },
        //     p3: { x: start.x + 79.75, y: 20, z: start.z - 79.28 },
        // }, spinRate);


        // const pAsegment4 = new CubicBezierSegment({
        //     p0: { x: start.x + 79.75, y: 20, z: start.z - 79.28 },
        //     p1: { x: start.x + 125.71, y: 20, z: start.z - 96.78 },
        //     p2: { x: start.x + 146.52, y: 20, z: start.z - 142.57 },
        //     p3: { x: start.x - 70.76, y: 20, z: start.z - 78.47 },
        // }, 0);

        // const pAsegment5 = new CubicBezierSegment({
        //     p0: { x: start.x - 70.76, y: 20, z: start.z - 78.47 },
        //     p1: { x: start.x - 153.6, y: 20, z: start.z - 56.4 },
        //     p2: { x: start.x - 156.1, y: 20, z: start.z - 18.52 },
        //     p3: { x: start.x, y: start.y, z: start.z },
        // }, 0);

        // const patternA = new MultiSegmentPattern(
        //     [pAsegment1, pAsegment2, pAsegment3, pAsegment4, pAsegment5],
        //     [{ start: 0, end: 0.2 }, { start: 0.2, end: 0.4 }, { start: 0.4, end: 0.6 }, { start: 0.6, end: 0.8 }, { start: 0.8, end: 1 }],
        //     8,
        // )

        // const pBsegment1 = new CubicBezierSegment({
        //     p0: { x: start.x, y: start.y, z: start.z },
        //     p1: { x: start.x + 1.72, y: 20, z: start.z + 97.87 },
        //     p2: { x: start.x + 20.99, y: 20, z: start.z + 97.53 },
        //     p3: { x: start.x + 55.98, y: 20, z: start.z + 86.16 },
        // }, 0);


        // const pBsegment2 = new CubicBezierSegment({
        //     p0: { x: start.x + 55.98, y: 20, z: start.z + 86.16 },
        //     p1: { x: start.x + 88.07, y: 20, z: start.z + 63.82 },
        //     p2: { x: start.x + 85.32, y: 20, z: start.z + 4.99 },
        //     p3: { x: start.x + 60.99, y: 20, z: start.z - 32.68 },
        // }, spinRate);

        // const pBsegment3 = new CubicBezierSegment({
        //     p0: { x: start.x + 60.99, y: 20, z: start.z - 32.68 },
        //     p1: { x: start.x + 50.35, y: 20, z: start.z - 49.57 },
        //     p2: { x: start.x - 31.59, y: 20, z: start.z - 51.13 },
        //     p3: { x: start.x - 79.75, y: 20, z: start.z - 79.28 },
        // }, spinRate);


        // const pBsegment4 = new CubicBezierSegment({
        //     p0: { x: start.x - 79.75, y: 20, z: start.z - 79.28 },
        //     p1: { x: start.x - 125.71, y: 20, z: start.z - 96.78 },
        //     p2: { x: start.x - 146.52, y: 20, z: start.z - 142.57 },
        //     p3: { x: start.x + 70.76, y: 20, z: start.z - 78.47 },
        // }, 0);

        // const pBsegment5 = new CubicBezierSegment({
        //     p0: { x: start.x + 70.76, y: 20, z: start.z - 78.47 },
        //     p1: { x: start.x + 153.6, y: 20, z: start.z - 56.4 },
        //     p2: { x: start.x + 156.1, y: 20, z: start.z - 18.52 },
        //     p3: { x: start.x, y: start.y, z: start.z },
        // }, 0);

        // const patternB = new MultiSegmentPattern(
        //     [pBsegment1, pBsegment2, pBsegment3, pBsegment4, pBsegment5],
        //     [{ start: 0, end: 0.2 }, { start: 0.2, end: 0.4 }, { start: 0.4, end: 0.6 }, { start: 0.6, end: 0.8 }, { start: 0.8, end: 1 }],
        //     8,
        // )
        const pAsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: start.x + 2.61, y: 20, z: start.z + 46.44 },
            p2: { x: start.x + 60.81, y: 20, z: start.z + 46.44 },
            p3: { x: start.x + 61.84, y: 20, z: start.z - 8.85 },
        }, 0);

        const pAsegment2 = new CubicBezierSegment({
            p0: { x: start.x + 61.84, y: 20, z: start.z - 8.85 },
            p1: { x: start.x + 60.89, y: 20, z: start.z - 34.98 },
            p2: { x: start.x + 60.89, y: 20, z: start.z - 58.02 },
            p3: { x: start.x + 60.41, y: 20, z: start.z - 82.01 },
        }, spinRate);

        const pAsegment3 = new CubicBezierSegment({
            p0: { x: start.x + 60.41, y: 20, z: start.z - 82.01 },
            p1: { x: start.x + 59.23, y: 20, z: start.z - 124.05 },
            p2: { x: start.x + 47.11, y: 20, z: start.z - 152.56 },
            p3: { x: start.x - 0.16, y: 20, z: start.z - 152.56 },
        }, 0);

        const pAsegment4 = new CubicBezierSegment({
            p0: { x: start.x - 0.16, y: 20, z: start.z - 152.56 },
            p1: { x: start.x - 48.61, y: 20, z: start.z - 151.61 },
            p2: { x: start.x - 57.88, y: 20, z: start.z - 125.24 },
            p3: { x: start.x - 60.49, y: 20, z: start.z - 83.91 },
        }, 0);

        const pAsegment5 = new CubicBezierSegment({
            p0: { x: start.x - 60.49, y: 20, z: start.z - 83.91 },
            p1: { x: start.x - 60.96, y: 20, z: start.z - 58.73 },
            p2: { x: start.x - 61.2, y: 20, z: start.z - 33.08 },
            p3: { x: start.x - 60.49, y: 20, z: start.z - 8.38 },
        }, spinRate);

        const pAsegment6 = new CubicBezierSegment({
            p0: { x: start.x - 60.49, y: 20, z: start.z - 8.38 },
            p1: { x: start.x - 58.27, y: 20, z: start.z + 45.05 },
            p2: { x: start.x - 3.14, y: 20, z: start.z + 45.83 },
            p3: { x: start.x, y: start.y, z: start.z },
        }, spinRate);

        const pBsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: start.x - 2.61, y: 20, z: start.z + 46.44 },
            p2: { x: start.x - 60.81, y: 20, z: start.z + 46.44 },
            p3: { x: start.x - 61.84, y: 20, z: start.z - 8.85 },
        }, spinRate);

        const pBsegment2 = new CubicBezierSegment({
            p0: { x: start.x - 61.84, y: 20, z: start.z - 8.85 },
            p1: { x: start.x - 60.89, y: 20, z: start.z - 34.98 },
            p2: { x: start.x - 60.89, y: 20, z: start.z - 58.02 },
            p3: { x: start.x - 60.41, y: 20, z: start.z - 82.01 },
        }, 0);

        const pBsegment3 = new CubicBezierSegment({
            p0: { x: start.x - 60.41, y: 20, z: start.z - 82.01 },
            p1: { x: start.x - 59.23, y: 20, z: start.z - 124.05 },
            p2: { x: start.x - 47.11, y: 20, z: start.z - 152.56 },
            p3: { x: start.x + 0.16, y: 20, z: start.z - 152.56 },
        }, spinRate);

        const pBsegment4 = new CubicBezierSegment({
            p0: { x: start.x + 0.16, y: 20, z: start.z - 152.56 },
            p1: { x: start.x + 48.61, y: 20, z: start.z - 151.61 },
            p2: { x: start.x + 57.88, y: 20, z: start.z - 125.24 },
            p3: { x: start.x + 60.49, y: 20, z: start.z - 83.91 },
        }, 0);

        const pBsegment5 = new CubicBezierSegment({
            p0: { x: start.x + 60.49, y: 20, z: start.z - 83.91 },
            p1: { x: start.x + 60.96, y: 20, z: start.z - 58.73 },
            p2: { x: start.x + 61.2, y: 20, z: start.z - 33.08 },
            p3: { x: start.x + 60.49, y: 20, z: start.z - 8.38 },
        }, spinRate);

        const pBsegment6 = new CubicBezierSegment({
            p0: { x: start.x + 60.49, y: 20, z: start.z - 8.38 },
            p1: { x: start.x + 58.27, y: 20, z: start.z + 45.05 },
            p2: { x: start.x + 3.14, y: 20, z: start.z + 45.83 },
            p3: { x: start.x, y: start.y, z: start.z },
        }, spinRate);

        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2, pAsegment3, pAsegment4, pAsegment5, pAsegment6],
            [{ start: 0, end: 0.17 }, { start: 0.17, end: 0.33 }, { start: 0.33, end: 0.5 }, { start: 0.5, end: 0.67 }, { start: 0.67, end: 0.83 }, { start: 0.83, end: 1 }],
            6,
        )

        const patternB = new MultiSegmentPattern(
            [pBsegment1, pBsegment2, pBsegment3, pBsegment4, pBsegment5, pBsegment6],
            [{ start: 0, end: 0.17 }, { start: 0.17, end: 0.33 }, { start: 0.33, end: 0.5 }, { start: 0.5, end: 0.67 }, { start: 0.67, end: 0.83 }, { start: 0.83, end: 1 }],
            6,
        )
        return (side === 0) ? patternB : patternA;
    }

}

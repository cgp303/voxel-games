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

        const pAsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: 0.69, y: 20, z: 49.71 },
            p2: { x: -0.34, y: 20, z: 194.54 },
            p3: { x: 40.25, y: 20, z: 179.06 },
        }, 0);


        const pAsegment2 = new CubicBezierSegment({
            p0: { x: 40.25, y: 20, z: 179.06 },
            p1: { x: 77.06, y: 20, z: 162.2 },
            p2: { x: 80.16, y: 20, z: 50.4 },
            p3: { x: 80.16, y: 20, z: -0.17 },
        }, spinRate);

        const pAsegment3 = new CubicBezierSegment({
            p0: { x: 80.16, y: 20, z: -0.17 },
            p1: { x: 79.12, y: 20, z: -40.08 },
            p2: { x: 79.12, y: 20, z: -89.96 },
            p3: { x: 45.41, y: 20, z: -89.62 },
        }, spinRate);


        const pAsegment4 = new CubicBezierSegment({
            p0: { x: 45.41, y: 20, z: -89.62 },
            p1: { x: 31.99, y: 20, z: -88.93 },
            p2: { x: 10.32, y: 20, z: -82.39 },
            p3: { x: start.x, y: start.y, z: start.z },
        }, 0);

        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2, pAsegment3, pAsegment4],
            [{ start: 0, end: 0.27 }, { start: 0.27, end: 0.54 }, { start: 0.54, end: 0.8 }, { start: 0.8, end: 1 }],
            4.2,
        )

        const pBsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: -0.69, y: 20, z: 49.71 },
            p2: { x: 0.34, y: 20, z: 194.54 },
            p3: { x: -40.25, y: 20, z: 179.06 },
        }, 0);


        const pBsegment2 = new CubicBezierSegment({
            p0: { x: -40.25, y: 20, z: 179.06 },
            p1: { x: -77.06, y: 20, z: 162.2 },
            p2: { x: -80.16, y: 20, z: 50.4 },
            p3: { x: -80.16, y: 20, z: -0.17 },
        }, spinRate);

        const pBsegment3 = new CubicBezierSegment({
            p0: { x: -80.16, y: 20, z: -0.17 },
            p1: { x: -79.12, y: 20, z: -40.08 },
            p2: { x: -79.12, y: 20, z: -89.96 },
            p3: { x: -45.41, y: 20, z: -89.62 },
        }, spinRate);


        const pBsegment4 = new CubicBezierSegment({
            p0: { x: -45.41, y: 20, z: -89.62 },
            p1: { x: -31.99, y: 20, z: -88.93 },
            p2: { x: -10.32, y: 20, z: -82.39 },
            p3: { x: start.x, y: start.y, z: start.z },
        }, 0);

        const patternB = new MultiSegmentPattern(
            [pBsegment1, pBsegment2, pBsegment3, pBsegment4],
            [{ start: 0, end: 0.27 }, { start: 0.27, end: 0.54 }, { start: 0.54, end: 0.8 }, { start: 0.8, end: 1 }],
            4.2,
        )

        return (side === 0) ? patternB : patternA;
    }

}

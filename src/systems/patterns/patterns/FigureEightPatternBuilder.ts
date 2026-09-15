// systems/patterns/patterns/FigureEightPatternBuilder.ts

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';
import type { CubicBezierControls } from '../../path/cubicBezier';
import { BezierDebugRenderer } from '../../path/pathVisulizer/BezierDebugRenderer';

const CFG = {
    duration: 3.0,

    // Forward/back dominant (Z), gentle sway (X)
    segmentA: {
        swayX1: -160,
        forwardZ1: 240,

        swayX2: -160,
        forwardZ2: 30,

        endOffsetX: 0,
        endOffsetZ: 0,

        startY: 20

    },

    segmentB: {
        swayX1: 15,
        diveZ1: -80,

        swayX2: 25,
        diveZ2: -80,

        swayX3: 35,
        diveZ3: -40,

        diveY: 1
    },

    segmentC: {
        returnSwayX1: 15,
        returnZ1: 80,

        returnSwayX2: 25,
        returnZ2: 150,

        endOffsetZ: 0,
        returnY: 0
    }

} as const;

// export class FigureEightPatternBuilder {

//     private debugBezier;

//     constructor(scene) {
//         this.debugBezier = new BezierDebugRenderer(scene);
//     }

//     build(invader, rowParity): MultiSegmentPattern {
//         const start = invader.position.clone();
//         const side = (rowParity === 0) ? +1 : -1;

//         // Use absolute anchor instead of start.x/start.z
//         const baseX = 20;
//         const baseZ = -20;

//         // Segment A
//         const A0 = new Vector3(start.x, CFG.segmentA.startY, start.z);
//         const A1 = new Vector3(side * CFG.segmentA.swayX1, CFG.segmentA.startY, baseZ + CFG.segmentA.forwardZ1);
//         const A2 = new Vector3(side * CFG.segmentA.swayX2, CFG.segmentA.startY, baseZ + CFG.segmentA.forwardZ2);
//         const A3 = new Vector3(0, CFG.segmentA.startY, baseZ + CFG.segmentA.endOffsetZ);

//         const segmentA = new CubicBezierSegment({ p0: A0, p1: A1, p2: A2, p3: A3 });

//         // Segment B
//         const B0 = A3.clone();
//         const B1 = new Vector3(baseX + side * CFG.segmentB.swayX1, start.y, baseZ + CFG.segmentB.diveZ1);
//         const B2 = new Vector3(baseX + side * CFG.segmentB.swayX2, start.y, baseZ + CFG.segmentB.diveZ2);
//         //const B3 = new Vector3(baseX + side * CFG.segmentB.swayX3, start.y, baseZ + CFG.segmentB.diveZ3);
//         const B3 = new Vector3(start.x, 5, start.z);

//         const segmentB = new CubicBezierSegment({ p0: B0, p1: B1, p2: B2, p3: B3 });

//         // Segment C
//         const C0 = B3.clone();
//         const C1 = new Vector3(baseX - side * CFG.segmentC.returnSwayX1, start.y, baseZ + CFG.segmentC.returnZ1);
//         const C2 = new Vector3(baseX - side * CFG.segmentC.returnSwayX2, start.y, baseZ + CFG.segmentC.returnZ2);
//         const C3 = start.clone(); // new Vector3(baseX, start.y, baseZ + CFG.segmentC.endOffsetZ);

//         const segmentC = new CubicBezierSegment({ p0: C0, p1: C1, p2: C2, p3: C3 });

//         // return new MultiSegmentPattern(
//         //     [segmentA, segmentB, segmentC],
//         //     [
//         //         { start: 0.0, end: 0.33 },
//         //         { start: 0.33, end: 0.66 },
//         //         { start: 0.66, end: 1.0 },
//         //     ],
//         //     CFG.duration
//         // );
//         const thePattern = new MultiSegmentPattern(
//             [segmentA],
//             [
//                 { start: 0.0, end: 1.0 }
//             ],
//             CFG.duration
//         );

//         this.debugBezier.drawMultiSegmentPattern(thePattern);
//         // return new MultiSegmentPattern(
//         //     [segmentA, segmentB],
//         //     [
//         //         { start: 0.0, end: 0.5 },
//         //         { start: 0.5, end: 1.0 }
//         //     ],
//         //     CFG.duration
//         // );
//         return thePattern;
//     }

export class FigureEightPatternBuilder {

    private debugBezier;

    constructor(scene) {
        //this.debugBezier = new BezierDebugRenderer(scene);
    }

    build(invader, rowParity): MultiSegmentPattern {
        const start = invader.position.clone();

        const pAsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: 19.83, y: 20, z: 69.57 },
            p2: { x: 117.66, y: 20, z: 61.02 },
            p3: { x: 88.49, y: 20, z: 0.2 },
        });
        const pAsegment2 = new CubicBezierSegment({
            p0: { x: 88.49, y: 20, z: 0.2 },
            p1: { x: 42.33, y: 20, z: -4.56 },
            p2: { x: -32.82, y: 20, z: -47.48 },
            p3: { x: 40.78, y: 20, z: -74.08 },
        });
        const pAsegment3 = new CubicBezierSegment({
            p0: { x: 40.78, y: 20, z: -74.08 },
            p1: { x: 89.72, y: 20, z: -76.8 },
            p2: { x: 127.78, y: 20, z: -8.25 },
            p3: { x: start.x, y: start.y, z: start.z },
        });

        const patternA = new MultiSegmentPattern(
            [pAsegment1, pAsegment2, pAsegment3],
            [{ start: 0, end: 0.3 }, { start: 0.3, end: 0.7 }, { start: 0.7, end: 1 }],
            4,
        )

        const pBsegment1 = new CubicBezierSegment({
            p0: { x: start.x, y: start.y, z: start.z },
            p1: { x: -19.83, y: 20, z: 69.57 },
            p2: { x: -117.66, y: 20, z: 61.02 },
            p3: { x: -88.49, y: 20, z: 0.2 },
        });
        const pBsegment2 = new CubicBezierSegment({
            p0: { x: -88.49, y: 20, z: 0.2 },
            p1: { x: -42.33, y: 20, z: -4.56 },
            p2: { x: 32.82, y: 20, z: -47.48 },
            p3: { x: -40.78, y: 20, z: -74.08 },
        });
        const pBsegment3 = new CubicBezierSegment({
            p0: { x: -40.78, y: 20, z: -74.08 },
            p1: { x: -89.72, y: 20, z: -76.8 },
            p2: { x: -127.78, y: 20, z: -8.25 },
            p3: { x: start.x, y: start.y, z: start.z },
        });

        const patternB = new MultiSegmentPattern(
            [pBsegment1, pBsegment2, pBsegment3],
            [{ start: 0, end: 0.3 }, { start: 0.3, end: 0.7 }, { start: 0.7, end: 1 }],
            4,
        )

        return (rowParity === 0) ? patternB : patternA;
    }


    // build(invader, rowParity: number): MultiSegmentPattern {
    //     const start = invader.position.clone();

    //     // Mirror left/right based on row parity
    //     const side = (rowParity === 0) ? +1 : -1;

    //     //
    //     // Segment A — forward loop
    //     //
    //     const A0 = start.clone();
    //     const A1 = new Vector3(
    //         start.x + side * CFG.segmentA.swayX1,
    //         start.y + CFG.segmentA.startY,
    //         start.z + CFG.segmentA.forwardZ1
    //     );
    //     const A2 = new Vector3(
    //         start.x + side * CFG.segmentA.swayX2,
    //         start.y + CFG.segmentA.startY,
    //         start.z + CFG.segmentA.forwardZ2
    //     );
    //     const A3 = new Vector3(
    //         start.x + side * CFG.segmentA.endOffsetX,
    //         start.y + CFG.segmentA.startY,
    //         start.z + CFG.segmentA.endOffsetZ
    //     );

    //     const segmentA = new CubicBezierSegment({
    //         p0: A0, p1: A1, p2: A2, p3: A3
    //     });

    //     //
    //     // Segment B — backward dive loop
    //     //
    //     const B0 = A3.clone();
    //     const B1 = new Vector3(
    //         A3.x + side * CFG.segmentB.swayX1,
    //         A3.y + CFG.segmentB.diveY,
    //         A3.z + CFG.segmentB.diveZ1
    //     );
    //     const B2 = new Vector3(
    //         A3.x + side * CFG.segmentB.swayX2,
    //         A3.y + CFG.segmentB.diveY,
    //         A3.z + CFG.segmentB.diveZ2
    //     );
    //     const B3 = new Vector3(
    //         A3.x + side * CFG.segmentB.swayX3,
    //         A3.y + CFG.segmentB.diveY,
    //         A3.z + CFG.segmentB.diveZ3
    //     );

    //     const segmentB = new CubicBezierSegment({
    //         p0: B0, p1: B1, p2: B2, p3: B3
    //     });

    //     //
    //     // Segment C — return loop
    //     //
    //     const C0 = B3.clone();
    //     const C1 = new Vector3(
    //         B3.x - side * CFG.segmentC.returnSwayX1,
    //         B3.y + CFG.segmentC.returnY,
    //         B3.z + CFG.segmentC.returnZ1
    //     );
    //     const C2 = new Vector3(
    //         B3.x - side * CFG.segmentC.returnSwayX2,
    //         B3.y + CFG.segmentC.returnY,
    //         B3.z + CFG.segmentC.returnZ2
    //     );
    //     const C3 = new Vector3(
    //         A3.x,
    //         A3.y + CFG.segmentC.returnY,
    //         A3.z + CFG.segmentC.endOffsetZ
    //     );

    //     const segmentC = new CubicBezierSegment({
    //         p0: C0, p1: C1, p2: C2, p3: C3
    //     });

    //     //
    //     // Multi‑segment pattern
    //     //
    //     return new MultiSegmentPattern(
    //         [segmentA, segmentB, segmentC],
    //         [
    //             { start: 0.0, end: 0.1 },
    //             { start: 0.1, end: 0.55 },
    //             { start: 0.55, end: 1.0 },

    //         ],
    //         CFG.duration
    //     );
    // }
}

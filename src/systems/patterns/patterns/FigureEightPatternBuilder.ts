// systems/patterns/patterns/FigureEightPatternBuilder.ts

import { Vector3 } from 'three';
import { CubicBezierSegment } from '../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/MultiSegmentPattern';
import type { CubicBezierControls } from '../../path/cubicBezier';

const CFG = {
    duration: 8.0,

    // Forward/back dominant (Z), gentle sway (X)
    segmentA: {
        swayX1: 10,
        forwardZ1: 60,

        swayX2: 20,
        forwardZ2: 40,

        endOffsetX: 25,
        endOffsetZ: 20,

        startY: 3
    },

    segmentB: {
        swayX1: 15,
        diveZ1: -80,

        swayX2: 25,
        diveZ2: -450,

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

export class FigureEightPatternBuilder {

    constructor() { }

    build(invader, rowParity): MultiSegmentPattern {
        const start = invader.position.clone();
        const side = (rowParity === 0) ? +1 : -1;

        // Use absolute anchor instead of start.x/start.z
        const baseX = 20;
        const baseZ = -100;

        // Segment A
        const A0 = start.clone(); // still start at invader's position
        const A1 = new Vector3(baseX + side * CFG.segmentA.swayX1, start.y, baseZ + CFG.segmentA.forwardZ1);
        const A2 = new Vector3(baseX + side * CFG.segmentA.swayX2, start.y, baseZ + CFG.segmentA.forwardZ2);
        const A3 = new Vector3(baseX + side * CFG.segmentA.endOffsetX, start.y, baseZ + CFG.segmentA.endOffsetZ);

        const segmentA = new CubicBezierSegment({ p0: A0, p1: A1, p2: A2, p3: A3 });

        // Segment B
        const B0 = A3.clone();
        const B1 = new Vector3(baseX + side * CFG.segmentB.swayX1, start.y, baseZ + CFG.segmentB.diveZ1);
        const B2 = new Vector3(baseX + side * CFG.segmentB.swayX2, start.y, baseZ + CFG.segmentB.diveZ2);
        const B3 = new Vector3(baseX + side * CFG.segmentB.swayX3, start.y, baseZ + CFG.segmentB.diveZ3);

        const segmentB = new CubicBezierSegment({ p0: B0, p1: B1, p2: B2, p3: B3 });

        // Segment C
        const C0 = B3.clone();
        const C1 = new Vector3(baseX - side * CFG.segmentC.returnSwayX1, start.y, baseZ + CFG.segmentC.returnZ1);
        const C2 = new Vector3(baseX - side * CFG.segmentC.returnSwayX2, start.y, baseZ + CFG.segmentC.returnZ2);
        const C3 = start.clone(); // new Vector3(baseX, start.y, baseZ + CFG.segmentC.endOffsetZ);

        const segmentC = new CubicBezierSegment({ p0: C0, p1: C1, p2: C2, p3: C3 });

        return new MultiSegmentPattern(
            [segmentA, segmentB, segmentC],
            [
                { start: 0.0, end: 0.33 },
                { start: 0.33, end: 0.66 },
                { start: 0.66, end: 1.0 },
            ],
            CFG.duration
        );
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

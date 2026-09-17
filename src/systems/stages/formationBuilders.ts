// formationBuilders.ts

// () => makeVFormation(10, 6, 12)
// () => makeCircleFormation(60, 50)
// () => makeDiamondFormation(10, 6, 12)
// () => makeStaggeredFormation(10, 6, 12)
// () => makeGridFormation(10, 6, 12)  

import { FormationDescriptor } from '../../app/types';

export type SlotOffset = { x: number; z: number };
export type SlotMap = Map<string, SlotOffset>;

/**
 * Utility: make a "col,row" key
 */
function key(col: number, row: number): string {
    return `${col},${row}`;
}

/**
 * 1. Standard centered grid formation
 */
export function makeGridFormation(
    cols: number,
    rows: number,
    spacing: number
): FormationDescriptor {

    const midX = (cols - 1) / 2;
    const midZ = (rows - 1) / 2;

    const map: SlotMap = new Map();

    // Build grid slot offsets (unchanged)
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = (col - midX) * spacing;
            const z = (row - midZ) * spacing;
            map.set(`${col},${row}`, { x, z });
        }
    }

    // Build spawnOrder (LeftRightPairs)
    const spawnOrder: string[][] = [];
    const maxCol = cols - 1;
    const maxRow = rows - 1;

    for (let row = maxRow; row >= 0; row--) {
        for (let colLeft = 0; colLeft <= maxCol / 2; colLeft++) {
            const colRight = maxCol - colLeft;

            const leftKey = `${colLeft},${row}`;
            const rightKey = `${colRight},${row}`;

            if (map.has(leftKey) && map.has(rightKey)) {
                spawnOrder.push([leftKey, rightKey]);
            }
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}


/**
 * 2. X‑shape formation
 * Rows bend inward toward the center.
 */
export function makeXFormation(
    cols: number,
    rows: number,
    spacing: number,
    spreadFactor = spacing * 0.8
): FormationDescriptor {

    const midX = (cols - 1) / 2;
    const midZ = (rows - 1) / 2;

    const map: SlotMap = new Map();

    // Build slot offsets (unchanged)
    for (let row = 0; row < rows; row++) {
        const dist = row - midZ;
        const spread = Math.abs(dist) * spreadFactor;

        for (let col = 0; col < cols; col++) {
            const baseX = (col - midX) * spacing;
            const direction = (col < midX) ? -1 : (col > midX) ? 1 : 0;
            const x = baseX + direction * spread;
            const z = (row - midZ) * spacing;

            map.set(`${col},${row}`, { x, z });
        }
    }

    // Build spawnOrder (LeftRightPairs)
    const spawnOrder: string[][] = [];
    const maxCol = cols - 1;
    const maxRow = rows - 1;

    for (let row = maxRow; row >= 0; row--) {
        for (let colLeft = 0; colLeft <= maxCol / 2; colLeft++) {
            const colRight = maxCol - colLeft;

            const leftKey = `${colLeft},${row}`;
            const rightKey = `${colRight},${row}`;

            if (map.has(leftKey) && map.has(rightKey)) {
                spawnOrder.push([leftKey, rightKey]);
            }
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}


/**
 * 2. V‑shape formation
 * Rows spread outward from the apex at the top.
 */
export function makeVFormation(
    cols: number,
    rows: number,
    spacing: number,
    spreadFactor = spacing * 0.8
): FormationDescriptor {
    const midX = (cols - 1) / 2;

    const map: SlotMap = new Map();
    const spawnOrder: string[][] = [];
    const spawnType = "LeftRightPairs";
    const maxCol = cols - 1;
    const maxRow = rows - 1;

    for (let row = 0; row < rows; row++) {
        // Apex is row 0
        const dist = row; // distance from apex

        // Spread grows as you move down
        const spread = dist * spreadFactor;
        const _maxCol = cols - 1;
        const _maxRow = rows - 1;
        for (let col = 0; col < cols; col++) {
            const baseX = (col - midX) * spacing;

            const direction =
                col < midX ? -1 :
                    col > midX ? 1 :
                        0;

            const x = baseX + direction * spread;
            const z = row * spacing;

            map.set(`${col},${row}`, { x, z });

            if (col < _maxCol / 2) {
                const releasePair = [`${col},${_maxRow - row}`, `${_maxCol - col},${_maxRow - row}`];
                spawnOrder.push(releasePair);
            }


        }
    }
    return { map, spawnOrder, spawnType, maxCol, maxRow };
}


export function makeCircleFormation(
    count: number,
    radius: number
): FormationDescriptor {

    const map: SlotMap = new Map();

    // Build circle slot offsets
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;

        // flatten into row 0
        map.set(`${i},0`, { x, z });
    }

    // Build spawnOrder (LeftRightPairs)
    const spawnOrder: string[][] = [];
    const maxCol = count - 1;
    const maxRow = 0; // circle has only one abstract row

    for (let colLeft = 0; colLeft <= maxCol / 2; colLeft++) {
        const colRight = maxCol - colLeft;

        const leftKey = `${colLeft},0`;
        const rightKey = `${colRight},0`;

        if (map.has(leftKey) && map.has(rightKey)) {
            spawnOrder.push([leftKey, rightKey]);
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}


/**
 * 4. Diamond formation
 * Rows shrink toward the top and bottom.
 */
export function makeDiamondFormation(
    cols: number,
    rows: number,
    spacing: number
): FormationDescriptor {

    const midX = (cols - 1) / 2;
    const midZ = (rows - 1) / 2;

    const map: SlotMap = new Map();

    for (let row = 0; row < rows; row++) {
        const distFromCenter = Math.abs(row - midZ);

        // FIX: integer shrink
        const shrink = Math.floor(distFromCenter);

        const minCol = shrink;
        const maxCol = cols - 1 - shrink;

        for (let col = minCol; col <= maxCol; col++) {
            const x = (col - midX) * spacing;
            const z = (row - midZ) * spacing;
            map.set(`${col},${row}`, { x, z });
        }
    }

    // Build spawnOrder (LeftRightPairs)
    const spawnOrder: string[][] = [];
    const maxCol = cols - 1;
    const maxRow = rows - 1;

    for (let row = maxRow; row >= 0; row--) {
        for (let colLeft = 0; colLeft <= maxCol / 2; colLeft++) {
            const colRight = maxCol - colLeft;

            const leftKey = `${colLeft},${row}`;
            const rightKey = `${colRight},${row}`;

            if (map.has(leftKey) && map.has(rightKey)) {
                spawnOrder.push([leftKey, rightKey]);
            }
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}



/**
 * 5. Staggered rows formation
 * Every other row is offset horizontally.
 */
export function makeStaggeredFormation(
    cols: number,
    rows: number,
    spacing: number,
    staggerAmount: number = spacing * 0.5
): FormationDescriptor {

    const midX = (cols - 1) / 2;
    const midZ = (rows - 1) / 2;

    const map: SlotMap = new Map();

    // Build staggered slot offsets
    for (let row = 0; row < rows; row++) {
        // Even rows centered, odd rows shifted right
        const stagger = (row % 2 === 1) ? staggerAmount : 0;

        for (let col = 0; col < cols; col++) {
            const x = (col - midX) * spacing + stagger;
            const z = (row - midZ) * spacing;

            map.set(`${col},${row}`, { x, z });
        }
    }

    // Build spawnOrder (LeftRightPairs)
    const spawnOrder: string[][] = [];
    const maxCol = cols - 1;
    const maxRow = rows - 1;

    for (let row = maxRow; row >= 0; row--) {
        for (let colLeft = 0; colLeft <= maxCol / 2; colLeft++) {
            const colRight = maxCol - colLeft;

            const leftKey = `${colLeft},${row}`;
            const rightKey = `${colRight},${row}`;

            if (map.has(leftKey) && map.has(rightKey)) {
                spawnOrder.push([leftKey, rightKey]);
            }
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}


export function makeThreeRingCircleFormation(
    innerCount: number,
    middleCount: number,
    outerCount: number,
    innerRadius: number,
    middleRadius: number,
    outerRadius: number
): FormationDescriptor {

    const map: SlotMap = new Map();

    // --- Ring 0: Inner ---
    for (let i = 0; i < innerCount; i++) {
        const a = (i / innerCount) * Math.PI * 2;
        const x = Math.cos(a) * innerRadius;
        const z = Math.sin(a) * innerRadius;
        map.set(`${i},0`, { x, z });
    }

    // --- Ring 1: Middle ---
    for (let i = 0; i < middleCount; i++) {
        const a = (i / middleCount) * Math.PI * 2;
        const x = Math.cos(a) * middleRadius;
        const z = Math.sin(a) * middleRadius;
        map.set(`${i},1`, { x, z });
    }

    // --- Ring 2: Outer ---
    for (let i = 0; i < outerCount; i++) {
        const a = (i / outerCount) * Math.PI * 2;
        const x = Math.cos(a) * outerRadius;
        const z = Math.sin(a) * outerRadius;
        map.set(`${i},2`, { x, z });
    }

    // --- Build spawnOrder (LeftRightPairs per ring) ---
    const spawnOrder: string[][] = [];

    const ringCounts = [innerCount, middleCount, outerCount];
    const maxRow = 2;
    const maxCol = Math.max(innerCount - 1, middleCount - 1, outerCount - 1);

    for (let row = 0; row <= maxRow; row++) {
        const count = ringCounts[row];
        const lastCol = count - 1;

        for (let colLeft = 0; colLeft <= lastCol / 2; colLeft++) {
            const colRight = lastCol - colLeft;

            const leftKey = `${colLeft},${row}`;
            const rightKey = `${colRight},${row}`;

            if (map.has(leftKey) && map.has(rightKey)) {
                spawnOrder.push([leftKey, rightKey]);
            }
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}


export function makeSpiralFormation(
    count: number,
    radiusStep: number,
    angleStep: number
): FormationDescriptor {

    const map: SlotMap = new Map();

    // Build spiral slot offsets
    for (let i = 0; i < count; i++) {
        const radius = i * radiusStep;
        const angle = i * angleStep;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // flatten into row 0
        map.set(`${i},0`, { x, z });
    }

    // Build spawnOrder (LeftRightPairs)
    const spawnOrder: string[][] = [];
    const maxCol = count - 1;
    const maxRow = 0;

    for (let colLeft = 0; colLeft <= maxCol / 2; colLeft++) {
        const colRight = maxCol - colLeft;

        const leftKey = `${colLeft},0`;
        const rightKey = `${colRight},0`;

        if (map.has(leftKey) && map.has(rightKey)) {
            spawnOrder.push([leftKey, rightKey]);
        }
    }

    return {
        map,
        spawnOrder,
        spawnType: "LeftRightPairs",
        maxCol,
        maxRow
    };
}

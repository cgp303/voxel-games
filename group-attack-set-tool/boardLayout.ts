/** World-space position of a slot: x runs across the screen, z runs from front (bottom) to back (top). */
export interface BoardPoint {
    key: string;
    x: number;
    z: number;
}

export interface BoardBox {
    left: number;
    top: number;
    size: number;
    fontSize: number;
}

export interface BoardLayout {
    width: number;
    height: number;
    boxes: Map<string, BoardBox>;
}

const MAX_CELL = 56;
const MIN_CELL = 16;
const MAX_SCALE = 8;
/** Fraction of the nearest-neighbour gap a square may fill, leaving a visible gap. */
const SPACING_FILL = 0.85;

/**
 * Places each slot at its real builder position, scaled to fit the board and
 * centred. Square size follows the tightest gap in the formation so neighbours
 * never overlap, which keeps curved shapes such as circles readable.
 */
export function layoutBoard(points: BoardPoint[], availableWidth: number, availableHeight: number): BoardLayout {
    const width = Math.max(availableWidth, MAX_CELL * 2);
    const height = Math.max(availableHeight, MAX_CELL * 2);
    const boxes = new Map<string, BoardBox>();
    if (points.length === 0) {
        return { width, height, boxes };
    }

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minZ = Math.min(...points.map((p) => p.z));
    const maxZ = Math.max(...points.map((p) => p.z));
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;

    // The half-cell margin keeps the outermost squares on the board.
    const fitX = spanX > 0 ? (width - MAX_CELL) / spanX : Infinity;
    const fitZ = spanZ > 0 ? (height - MAX_CELL) / spanZ : Infinity;
    const scale = Math.min(fitX, fitZ, MAX_SCALE);

    const gap = nearestGap(points);
    const size = Math.min(MAX_CELL, Math.max(MIN_CELL, gap * scale * SPACING_FILL));
    const fontSize = Math.max(7, Math.min(12, (size - 6) / 2.6));

    const left0 = (width - spanX * scale) / 2;
    const top0 = (height - spanZ * scale) / 2;
    for (const point of points) {
        const cx = left0 + (point.x - minX) * scale;
        // Row 0 is nearest the camera (lowest z), so it is drawn at the bottom of the board.
        const cy = top0 + (maxZ - point.z) * scale;
        boxes.set(point.key, { left: cx - size / 2, top: cy - size / 2, size, fontSize });
    }

    return { width, height, boxes };
}

function nearestGap(points: BoardPoint[]): number {
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dx = points[i].x - points[j].x;
            const dz = points[i].z - points[j].z;
            best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
        }
    }
    return best;
}

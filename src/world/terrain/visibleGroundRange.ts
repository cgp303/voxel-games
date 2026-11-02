import type { IViewFrustum, IZRange } from '../../config/interfaces/interfaces.ts';

/** Columns of the screen sampled for the ground footprint, left edge to right edge. */
const SCREEN_SAMPLES = 9;

/**
 * World Z range of the ground slab y in [groundMinY, groundMaxY] that can be seen: inside the view frustum and
 * no deeper than `maxDepth` along the view direction (fog hides everything deeper; three.js fog uses that depth).
 * Returns null when no ground is in view.
 *
 * Ray v(cx, cy) = forward + cx * tanX * right + cy * tanY * up for screen position (cx, cy) in [-1, 1]. It hits
 * height g after t = (origin.y - g) / -v.y, and t is also its depth. Both planes of the slab are walked along
 * a handful of screen columns; the hit's Z is monotonic in cy, so the ends of the visible stretch are enough.
 */
export function visibleGroundRange(
    view: IViewFrustum,
    groundMinY: number,
    groundMaxY: number,
    maxDepth: number,
): IZRange | null {
    const { origin, right, up, forward } = view;
    if (origin.y <= groundMaxY) {
        return { min: origin.z - maxDepth, max: origin.z + maxDepth };
    }

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < SCREEN_SAMPLES; i++) {
        const cx = -1 + (2 * i) / (SCREEN_SAMPLES - 1);
        const ay = forward.y + cx * view.tanHalfFovX * right.y;
        const az = forward.z + cx * view.tanHalfFovX * right.z;
        const by = view.tanHalfFovY * up.y;
        const bz = view.tanHalfFovY * up.z;

        for (let plane = 0; plane < 2; plane++) {
            const g = plane === 0 ? groundMaxY : groundMinY;
            // The ray must hit height g within maxDepth: v.y <= limit.
            const limit = -(origin.y - g) / maxDepth;
            let lo = -1;
            let hi = 1;
            if (Math.abs(by) < 1e-9) {
                if (ay > limit) continue;
            } else if (by > 0) {
                hi = Math.min(1, (limit - ay) / by);
            } else {
                lo = Math.max(-1, (limit - ay) / by);
            }
            if (lo > hi) continue;

            for (let end = 0; end < 2; end++) {
                const cy = end === 0 ? lo : hi;
                const vy = ay + by * cy;
                const z = origin.z + ((origin.y - g) / -vy) * (az + bz * cy);
                if (z < min) min = z;
                if (z > max) max = z;
            }
        }
    }
    return min <= max ? { min, max } : null;
}

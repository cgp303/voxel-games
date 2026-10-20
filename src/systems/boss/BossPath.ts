import { Vector3 } from 'three';
import type { IBossPathDef } from '../../config/interfaces/interfaces';
import { CubicBezierSegment } from '../patterns/segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../patterns/patterns/MultiSegmentPattern';

/**
 * Builds the looping path a boss flies from its path definition: one cubic Bezier per segment, each taking an equal
 * share of `durationSec`, all at the fixed height `y`. Throws when the pieces do not join up or the loop is open,
 * since a boss would jump at the seam.
 */
export function buildBossPath(def: IBossPathDef, y: number, durationSec: number, name = 'boss path'): MultiSegmentPattern {
    const { segments } = def;
    if (segments.length === 0) throw new Error(`${name}: needs at least one segment`);
    const near = (a: Vector3, b: Vector3): boolean =>
        Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
    segments.forEach((segment, i) => {
        const next = segments[(i + 1) % segments.length];
        if (!near(segment.p3, next.p0)) {
            const at = (v: Vector3): string => `(${v.x}, ${v.z})`;
            throw new Error(`${name}: segment ${i} ends at ${at(segment.p3)} but segment ${(i + 1) % segments.length} starts at ${at(next.p0)}`);
        }
    });

    // Only X and Z are read from the path; the height is the boss's configured `y`.
    const point = (p: Vector3): Vector3 => new Vector3(p.x, y, p.z);
    const pieces = segments.map(
        (s) => new CubicBezierSegment({ p0: point(s.p0), p1: point(s.p1), p2: point(s.p2), p3: point(s.p3) }),
    );
    const ranges = segments.map((_, i) => ({ start: i / segments.length, end: (i + 1) / segments.length }));
    return new MultiSegmentPattern(pieces, ranges, durationSec);
}

import { Vector3 } from 'three';
import type { EntryConfig, EntrySide } from '../../app/types';

/** Cubic Bezier control polygon in world space. */
export interface CubicBezierControls {
    p0: Vector3;
    p1: Vector3;
    p2: Vector3;
    p3: Vector3;
}

function mix(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * B(t) = (1-t)³ P0 + 3(1-t)² t P1 + 3(1-t) t² P2 + t³ P3
 */
export function sampleCubic(
    p0: Vector3,
    p1: Vector3,
    p2: Vector3,
    p3: Vector3,
    t: number,
    out = new Vector3(),
): Vector3 {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    out.set(0, 0, 0);
    out.addScaledVector(p0, uuu);
    out.addScaledVector(p1, 3 * uu * t);
    out.addScaledVector(p2, 3 * u * tt);
    out.addScaledVector(p3, ttt);
    return out;
}

/**
 * B'(t) = 3(1-t)² (P1-P0) + 6(1-t)t (P2-P1) + 3t² (P3-P2)
 * Used for path-facing orientation.
 */
export function sampleCubicDerivative(
    p0: Vector3,
    p1: Vector3,
    p2: Vector3,
    p3: Vector3,
    t: number,
    out = new Vector3(),
): Vector3 {
    const u = 1 - t;
    const d1x = p1.x - p0.x;
    const d1y = p1.y - p0.y;
    const d1z = p1.z - p0.z;
    const d2x = p2.x - p1.x;
    const d2y = p2.y - p1.y;
    const d2z = p2.z - p1.z;
    const d3x = p3.x - p2.x;
    const d3y = p3.y - p2.y;
    const d3z = p3.z - p2.z;

    const w0 = 3 * u * u;
    const w1 = 6 * u * t;
    const w2 = 3 * t * t;

    out.set(
        w0 * d1x + w1 * d2x + w2 * d3x,
        w0 * d1y + w1 * d2y + w2 * d3y,
        w0 * d1z + w1 * d2z + w2 * d3z,
    );
    return out;
}

/** Reflect a point across the vertical plane x = centerX. */
export function mirrorPointX(
    p: Vector3,
    centerX: number,
    out = new Vector3(),
): Vector3 {
    return out.set(2 * centerX - p.x, p.y, p.z);
}

/**
 * Mirror a full left-side control polygon to the right (or vice versa).
 * p3 is typically overwritten each frame with the live home; still mirrored here
 * for convenience when baking a static snapshot.
 */
export function mirrorCubicControlsX(
    controls: CubicBezierControls,
    centerX: number,
    out?: CubicBezierControls,
): CubicBezierControls {
    const target =
        out ??
        ({
            p0: new Vector3(),
            p1: new Vector3(),
            p2: new Vector3(),
            p3: new Vector3(),
        } satisfies CubicBezierControls);

    mirrorPointX(controls.p0, centerX, target.p0);
    mirrorPointX(controls.p1, centerX, target.p1);
    mirrorPointX(controls.p2, centerX, target.p2);
    mirrorPointX(controls.p3, centerX, target.p3);
    return target;
}

export interface BuildEntryControlsArgs {
    spawn: Vector3;
    /** Usually live formation home; may be updated later by caller */
    home: Vector3;
    centerX: number;
    /** Side the path starts from (determines center-approach sign) */
    sideSign: 1 | -1;
    bulgeDepth: number;
    bulgeSignZ: number;
    centerApproachX: number;
}

/**
 * Standard v1 entry Bezier (left or right via sideSign).
 *
 * P0 = spawn (off-screen)
 * P1 = pull inward + bottom-heavy Z bulge
 * P2 = almost centerline (same side), lighter bulge, then home
 * P3 = home (formation slot — re-assign each frame if root moves)
 *
 * sideSign: -1 = left (spawn x < center), +1 = right
 */
export function buildEntryControls(args: BuildEntryControlsArgs): CubicBezierControls {
    const {
        spawn,
        home,
        centerX,
        sideSign,
        bulgeDepth,
        bulgeSignZ,
        centerApproachX,
    } = args;

    const bulge = bulgeSignZ * bulgeDepth;

    const p0 = spawn.clone();
    const p3 = home.clone();

    const p1 = new Vector3(
        mix(spawn.x, centerX, 0.65),
        mix(spawn.y, home.y, 0.3),
        mix(spawn.z, home.z, 0.2) + bulge,
    );

    // Near center, stay on the spawn side by at least centerApproachX
    const p2x = centerX + sideSign * centerApproachX;
    const p2 = new Vector3(
        p2x,
        mix(spawn.y, home.y, 0.7),
        mix(spawn.z, home.z, 0.55) + bulge * 0.35,
    );

    return { p0, p1, p2, p3 };
}

/**
 * Build entry controls from side + ENTRY-shaped config.
 */
export function buildEntryControlsFromConfig(
    spawn: Vector3,
    home: Vector3,
    centerX: number,
    // side: 'left' | 'right',
    side: EntrySide,
    entry: Pick<EntryConfig, 'bulgeDepth' | 'bulgeSignZ' | 'centerApproachX'>,
): CubicBezierControls {
    const sideSign: 1 | -1 = side === 'left' ? -1 : 1;
    return buildEntryControls({
        spawn,
        home,
        centerX,
        sideSign,
        bulgeDepth: entry.bulgeDepth,
        bulgeSignZ: entry.bulgeSignZ,
        centerApproachX: entry.centerApproachX,
    });
}

/**
 * Re-bind only the live end point (moving formation).
 * Prefer updating p3 in place each frame: controls.p3.copy(liveHome)
 */
export function setLiveHome(controls: CubicBezierControls, home: Vector3): void {
    controls.p3.copy(home);
}

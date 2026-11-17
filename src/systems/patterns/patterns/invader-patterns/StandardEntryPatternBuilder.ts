import { Vector3 } from 'three';
import { CubicBezierSegment } from '../../segments/CubicBezierSegment';
import { MultiSegmentPattern } from '../../patterns/MultiSegmentPattern';
import { mirrorCubicControlsX } from '../../../path/cubicBezier';
import type { IPatternBuilder, ICubicBezierControls } from '../../../../config/interfaces/interfaces';

/**
 * Standard entry: bottom-heavy bulge, smooth arc into formation.
 * Single segment (or treat as 1 segment for weapon targeting).
 */
export class StandardEntryPatternBuilder implements IPatternBuilder {
    private static readonly SPIN_RATES = [0];
    private static readonly RANGES = [{ start: 0, end: 1 }];
    private static readonly ALLOW_INVERSION = [false];
    private static readonly ORIENTATION_SMOOTHING = [8];
    private static readonly DURATION = 2.35;
    private static readonly OVERLAP = 0;

    duration(): number {
        return StandardEntryPatternBuilder.DURATION;
    }

    overlap(): number {
        return StandardEntryPatternBuilder.OVERLAP;
    }

    build(origin: Vector3, side: number, endPosition: Vector3, _path: number = 0): MultiSegmentPattern {
        const bulgeDepth = 54;
        const bulgeSignZ = -7;
        const centerApproachX = 2;

        const sideSign = side === 1 ? 1 : -1;
        const centerX = 0;

        // Build Bezier controls using the standard entry formula
        const spawn = origin.clone();
        const home = endPosition.clone();

        const bulge = bulgeSignZ * bulgeDepth;
        const mix = (a: number, b: number, t: number) => a + (b - a) * t;

        const p0 = spawn.clone();
        const p3 = home.clone();

        const p1 = new Vector3(
            mix(spawn.x, centerX, 0.65),
            mix(spawn.y, home.y, 0.3),
            mix(spawn.z, home.z, 0.2) + bulge,
        );

        const p2x = centerX + sideSign * centerApproachX;
        const p2 = new Vector3(
            p2x,
            mix(spawn.y, home.y, 0.7),
            mix(spawn.z, home.z, 0.55) + bulge * 0.35,
        );

        const controls: ICubicBezierControls = { p0, p1, p2, p3 };

        const segment = new CubicBezierSegment(
            controls,
            StandardEntryPatternBuilder.SPIN_RATES[0],
            StandardEntryPatternBuilder.ALLOW_INVERSION[0],
            StandardEntryPatternBuilder.ORIENTATION_SMOOTHING[0]
        );

        return new MultiSegmentPattern(
            [segment],
            StandardEntryPatternBuilder.RANGES,
            StandardEntryPatternBuilder.DURATION,
            StandardEntryPatternBuilder.OVERLAP,
            'entryStandardBezier'
        );
    }
}
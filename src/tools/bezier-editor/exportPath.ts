// tools/bezier-editor/exportPath.ts

import type { Vector3 } from 'three';
import type { PathDocument } from './PathDocument';

export type ExportMode = 'absolute' | 'relative';

export interface RelativeExportSettings {
    anchorX: number;
    anchorZ: number;
    side: 1 | -1;
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}

function vec3Literal(v: Vector3): string {
    return `{ x: ${round(v.x)}, y: ${round(v.y)}, z: ${round(v.z)} }`;
}

/** Plain {p0,p1,p2,p3} world-space points — drop-in CubicBezierControls per segment. */
export function exportAbsolute(doc: PathDocument): string {
    const blocks: string[] = [];
    for (let i = 0; i < doc.segmentCount; i++) {
        const [p0, p1, p2, p3] = doc.segmentPoints(i);
        blocks.push(
            `  segment${i + 1}: {\n` +
            `    p0: ${vec3Literal(p0)},\n` +
            `    p1: ${vec3Literal(p1)},\n` +
            `    p2: ${vec3Literal(p2)},\n` +
            `    p3: ${vec3Literal(p3)},\n` +
            `  },`,
        );
    }
    return `{\n${blocks.join('\n')}\n}`;
}

/** Anchor + side-mirrored offsets, matching the CFG.segmentA authoring style. */
export function exportRelative(doc: PathDocument, settings: RelativeExportSettings): string {
    const { anchorX, anchorZ, side } = settings;
    const rel = (p: Vector3) => ({
        swayX: round((p.x - anchorX) / side),
        forwardZ: round(p.z - anchorZ),
        y: round(p.y),
    });

    const blocks: string[] = [];
    for (let i = 0; i < doc.segmentCount; i++) {
        const [p0, p1, p2, p3] = doc.segmentPoints(i);
        const r0 = rel(p0);
        const r1 = rel(p1);
        const r2 = rel(p2);
        const r3 = rel(p3);
        blocks.push(
            `  segment${i + 1}: {\n` +
            `    side: ${side},\n` +
            `    anchor: { x: ${anchorX}, z: ${anchorZ} },\n` +
            `    startY: ${r0.y},\n` +
            `    swayX1: ${r1.swayX}, forwardZ1: ${r1.forwardZ},\n` +
            `    swayX2: ${r2.swayX}, forwardZ2: ${r2.forwardZ},\n` +
            `    endOffsetX: ${r3.swayX}, endOffsetZ: ${r3.forwardZ},\n` +
            `  },`,
        );
    }
    return `{\n${blocks.join('\n')}\n}`;
}

/** Ready-to-paste MultiSegmentPattern construction using normalized segment weights. */
export function exportMultiSegmentSnippet(doc: PathDocument): string {
    const ranges = doc
        .normalizedRanges()
        .map((r) => `{ start: ${round(r.start)}, end: ${round(r.end)} }`)
        .join(', ');
    const segNames = doc.segmentWeights.map((_, i) => `segment${i + 1}`).join(', ');
    return `new MultiSegmentPattern(\n  [${segNames}],\n  [${ranges}],\n  ${doc.totalDuration},\n)`;
}

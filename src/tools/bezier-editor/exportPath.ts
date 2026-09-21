// tools/bezier-editor/exportPath.ts

import { Vector3 } from 'three';
import type { PathDocument } from './PathDocument';

export type ExportMode = 'absolute' | 'relative' | 'relativeToStart';

export interface RelativeExportSettings {
    anchorX: number;
    anchorZ: number;
    side: 1 | -1;
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}

/** First/last points are the invader's own start position, so they're emitted symbolically. */
function pointLiteral(v: Vector3, forceStart: boolean): string {
    if (forceStart) return '{ x: start.x, y: start.y, z: start.z }';
    return `{ x: ${round(v.x)}, y: ${round(v.y)}, z: ${round(v.z)} }`;
}

/** `pA`/`pB`-prefixed CubicBezierSegment declarations; mirror negates X (pattern-B side). */
function segmentDeclarations(doc: PathDocument, prefix: 'pA' | 'pB', mirror: boolean): string {
    const blocks: string[] = [];
    for (let i = 0; i < doc.segmentCount; i++) {
        const [p0, p1, p2, p3] = doc.segmentPoints(i);
        const flip = (v: Vector3) => (mirror ? new Vector3(-v.x, v.y, v.z) : v);
        const isFirst = i === 0;
        const isLast = i === doc.segmentCount - 1;
        blocks.push(
            `const ${prefix}segment${i + 1} = new CubicBezierSegment({\n` +
            `    p0: ${pointLiteral(flip(p0), isFirst)},\n` +
            `    p1: ${pointLiteral(flip(p1), false)},\n` +
            `    p2: ${pointLiteral(flip(p2), false)},\n` +
            `    p3: ${pointLiteral(flip(p3), isLast)},\n` +
            `}, 0);`,
        );
    }
    return blocks.join('\n\n');
}

function patternDeclaration(doc: PathDocument, name: string, prefix: 'pA' | 'pB'): string {
    const ranges = doc
        .normalizedRanges()
        .map((r) => `{ start: ${round(r.start)}, end: ${round(r.end)} }`)
        .join(', ');
    const segNames = doc.segmentWeights.map((_, i) => `${prefix}segment${i + 1}`).join(', ');
    return (
        `const ${name} = new MultiSegmentPattern(\n` +
        `    [${segNames}],\n` +
        `    [${ranges}],\n` +
        `    ${doc.totalDuration},\n` +
        `)`
    );
}

/** Drop-in pA/pB segment + patternA/patternB declarations, matching GroupAttackPatternBuilder style. */
export function exportAbsolute(doc: PathDocument): string {
    const segmentsA = segmentDeclarations(doc, 'pA', false);
    const segmentsB = segmentDeclarations(doc, 'pB', true);
    const patternA = patternDeclaration(doc, 'patternA', 'pA');
    const patternB = patternDeclaration(doc, 'patternB', 'pB');
    return `${segmentsA}\n\n${segmentsB}\n\n${patternA}\n\n${patternB}`;
}

function offsetExpr(axisLiteral: string, offset: number): string {
    const r = round(offset);
    if (r === 0) return axisLiteral;
    return r > 0 ? `${axisLiteral} + ${r}` : `${axisLiteral} - ${Math.abs(r)}`;
}

/** X/Z as offsets from the path's own start point; mirror flips only the X offset's sign. */
function relativeToStartPointLiteral(v: Vector3, anchor: Vector3, forceStart: boolean, mirror: boolean): string {
    if (forceStart) return '{ x: start.x, y: start.y, z: start.z }';
    const offsetX = (mirror ? -1 : 1) * (v.x - anchor.x);
    const offsetZ = v.z - anchor.z;
    return `{ x: ${offsetExpr('start.x', offsetX)}, y: ${round(v.y)}, z: ${offsetExpr('start.z', offsetZ)} }`;
}

function segmentDeclarationsRelativeToStart(doc: PathDocument, prefix: 'pA' | 'pB', mirror: boolean): string {
    const anchor = doc.points[0];
    const blocks: string[] = [];
    for (let i = 0; i < doc.segmentCount; i++) {
        const [p0, p1, p2, p3] = doc.segmentPoints(i);
        const isFirst = i === 0;
        const isLast = i === doc.segmentCount - 1;
        blocks.push(
            `const ${prefix}segment${i + 1} = new CubicBezierSegment({\n` +
            `    p0: ${relativeToStartPointLiteral(p0, anchor, isFirst, mirror)},\n` +
            `    p1: ${relativeToStartPointLiteral(p1, anchor, false, mirror)},\n` +
            `    p2: ${relativeToStartPointLiteral(p2, anchor, false, mirror)},\n` +
            `    p3: ${relativeToStartPointLiteral(p3, anchor, isLast, mirror)},\n` +
            `}, 0);`,
        );
    }
    return blocks.join('\n\n');
}

/** Same drop-in shape as exportAbsolute, but X/Z are written as offsets from start.x/start.z. */
export function exportRelativeToStart(doc: PathDocument): string {
    const segmentsA = segmentDeclarationsRelativeToStart(doc, 'pA', false);
    const segmentsB = segmentDeclarationsRelativeToStart(doc, 'pB', true);
    const patternA = patternDeclaration(doc, 'patternA', 'pA');
    const patternB = patternDeclaration(doc, 'patternB', 'pB');
    return `${segmentsA}\n\n${segmentsB}\n\n${patternA}\n\n${patternB}`;
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

// tools/bezier-editor/importPath.ts

import * as ts from 'typescript';
import { Vector3 } from 'three';

export interface ParsedPath {
    points: Vector3[];
    segmentWeights: number[];
    totalDuration: number;
    warnings: string[];
}

interface RawSegment {
    p0: Vector3;
    p1: Vector3;
    p2: Vector3;
    p3: Vector3;
}

interface RawRange {
    start: number;
    end: number;
}

const JOINT_EPSILON = 0.05;

function propName(name: ts.PropertyName): string {
    return name.getText().replace(/^['"]|['"]$/g, '');
}

function numberFromExpression(expr: ts.Expression | undefined): number {
    if (!expr) return 0;
    if (ts.isNumericLiteral(expr)) {
        return Number(expr.text);
    }
    if (
        ts.isPrefixUnaryExpression(expr) &&
        expr.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(expr.operand)
    ) {
        return -Number(expr.operand.text);
    }
    // Non-literal expressions (start.x, foo(), identifiers, …) resolve to 0.
    return 0;
}

function pointFromObjectLiteral(obj: ts.ObjectLiteralExpression): Vector3 {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = propName(prop.name);
        if (name === 'x') x = numberFromExpression(prop.initializer);
        else if (name === 'y') y = numberFromExpression(prop.initializer);
        else if (name === 'z') z = numberFromExpression(prop.initializer);
    }
    return new Vector3(x, y, z);
}

function isSegmentControlsLiteral(obj: ts.ObjectLiteralExpression): boolean {
    const keys = new Set(
        obj.properties
            .filter((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p))
            .map((p) => propName(p.name)),
    );
    return ['p0', 'p1', 'p2', 'p3'].every((k) => keys.has(k));
}

function segmentFromObjectLiteral(obj: ts.ObjectLiteralExpression): RawSegment | null {
    let p0: Vector3 | null = null;
    let p1: Vector3 | null = null;
    let p2: Vector3 | null = null;
    let p3: Vector3 | null = null;

    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isObjectLiteralExpression(prop.initializer)) continue;
        const name = propName(prop.name);
        const point = pointFromObjectLiteral(prop.initializer);
        if (name === 'p0') p0 = point;
        else if (name === 'p1') p1 = point;
        else if (name === 'p2') p2 = point;
        else if (name === 'p3') p3 = point;
    }

    if (!p0 || !p1 || !p2 || !p3) return null;
    return { p0, p1, p2, p3 };
}

function rangeFromObjectLiteral(obj: ts.ObjectLiteralExpression): RawRange | null {
    let start: number | null = null;
    let end: number | null = null;
    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = propName(prop.name);
        if (name === 'start') start = numberFromExpression(prop.initializer);
        else if (name === 'end') end = numberFromExpression(prop.initializer);
    }
    if (start === null || end === null) return null;
    return { start, end };
}

/**
 * Parses pasted code into a joint-shared point array. Recognizes any
 * `{p0,p1,p2,p3}`-shaped object literal (bare, or wrapped in `new
 * CubicBezierSegment(...)`), in source order, plus an optional
 * `new MultiSegmentPattern([...], [{start,end},...], duration)` call used to
 * recover segment-weight ratios. Non-literal numeric fields (e.g. `start.x`)
 * resolve to 0. Purely static AST inspection — no code is ever executed.
 */
export function parseSegments(text: string): ParsedPath {
    const source = ts.createSourceFile('pasted.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    const rawSegments: RawSegment[] = [];
    let ranges: RawRange[] | null = null;
    let totalDuration: number | null = null;

    const visit = (node: ts.Node): void => {
        if (
            ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'MultiSegmentPattern' &&
            node.arguments &&
            node.arguments.length >= 3
        ) {
            const rangesArg = node.arguments[1];
            if (ts.isArrayLiteralExpression(rangesArg)) {
                const parsedRanges = rangesArg.elements
                    .filter((e): e is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(e))
                    .map(rangeFromObjectLiteral)
                    .filter((r): r is RawRange => r !== null);
                if (parsedRanges.length > 0) ranges = parsedRanges;
            }
            totalDuration = numberFromExpression(node.arguments[2]);
        }

        if (ts.isObjectLiteralExpression(node) && isSegmentControlsLiteral(node)) {
            const seg = segmentFromObjectLiteral(node);
            if (seg) rawSegments.push(seg);
        }

        ts.forEachChild(node, visit);
    };

    visit(source);

    const warnings: string[] = [];
    const points: Vector3[] = [];

    rawSegments.forEach((seg, i) => {
        if (i === 0) {
            points.push(seg.p0);
        } else {
            const prevP3 = points[points.length - 1];
            if (prevP3.distanceTo(seg.p0) > JOINT_EPSILON) {
                warnings.push(`Segment ${i + 1} p0 didn't match segment ${i} p3 — using segment ${i}'s p3.`);
            }
        }
        points.push(seg.p1, seg.p2, seg.p3);
    });

    let segmentWeights: number[];
    if (ranges && (ranges as RawRange[]).length === rawSegments.length && rawSegments.length > 0) {
        segmentWeights = (ranges as RawRange[]).map((r) => Math.max(r.end - r.start, 0.0001));
    } else {
        segmentWeights = rawSegments.map(() => 1);
        if (ranges && (ranges as RawRange[]).length !== rawSegments.length) {
            warnings.push('MultiSegmentPattern range count did not match segment count — using equal weights.');
        }
    }

    return {
        points,
        segmentWeights,
        totalDuration: totalDuration ?? 3.0,
        warnings,
    };
}

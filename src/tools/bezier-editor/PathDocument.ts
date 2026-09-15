// tools/bezier-editor/PathDocument.ts

import { Vector3 } from 'three';
import type { ParsedPath } from './importPath';

export type SegmentRange = { start: number; end: number };

/**
 * Ordered control points for a multi-segment cubic Bezier path.
 * points.length === 1 + 3 * segmentCount; segment i uses points[3i..3i+3].
 * Adjacent segments share the joint point (same array slot, no duplication),
 * so dragging a joint moves both connected curves at once.
 */
export class PathDocument {
    points: Vector3[] = [];
    segmentWeights: number[] = [];
    totalDuration = 3.0;

    constructor() {
        this.reset();
    }

    get segmentCount(): number {
        return this.segmentWeights.length;
    }

    reset(): void {
        // +Z is the formation/top; new points move toward -Z (down, toward the player).
        this.points = [
            new Vector3(0, 20, 0),
            new Vector3(-40, 20, -80),
            new Vector3(40, 20, -160),
            new Vector3(0, 20, -240),
        ];
        this.segmentWeights = [1];
        this.totalDuration = 3.0;
    }

    clear(): void {
        this.points = [new Vector3(0, 0, 0)];
        this.segmentWeights = [];
    }

    addSegment(): void {
        const last = this.points[this.points.length - 1];
        this.points.push(
            last.clone().add(new Vector3(-40, 0, -40)),
            last.clone().add(new Vector3(-40, 0, -80)),
            last.clone().add(new Vector3(0, 0, -120)),
        );
        this.segmentWeights.push(1);
    }

    removeLastSegment(): void {
        if (this.segmentCount === 0) return;
        this.points.splice(this.points.length - 3, 3);
        this.segmentWeights.pop();
    }

    /** Wholesale replace from a parsed import (see importPath.ts). */
    loadParsed(parsed: ParsedPath): void {
        this.points = parsed.points;
        this.segmentWeights = parsed.segmentWeights;
        this.totalDuration = parsed.totalDuration;
    }

    segmentPoints(i: number): [Vector3, Vector3, Vector3, Vector3] {
        const base = i * 3;
        return [this.points[base], this.points[base + 1], this.points[base + 2], this.points[base + 3]];
    }

    /** Duration ranges normalized from segmentWeights, for MultiSegmentPattern. */
    normalizedRanges(): SegmentRange[] {
        const total = this.segmentWeights.reduce((a, b) => a + b, 0) || 1;
        let acc = 0;
        const ranges: SegmentRange[] = [];
        for (const w of this.segmentWeights) {
            const start = acc / total;
            acc += w;
            ranges.push({ start, end: acc / total });
        }
        return ranges;
    }
}

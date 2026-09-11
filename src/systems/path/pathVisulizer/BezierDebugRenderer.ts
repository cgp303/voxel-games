import {
    BufferGeometry,
    LineBasicMaterial,
    Line,
    Points,
    PointsMaterial,
    Vector3,
    ArrowHelper,
    Color,
} from 'three';

import * as THREE from 'three';

export class BezierDebugRenderer {

    private scene;
    private items;

    constructor(scene) {
        this.scene = scene;
        this.items = [];
    }

    clear() {
        for (const obj of this.items) {
            obj.removeFromParent();
        }
        this.items.length = 0;
    }

    drawSegment(controls, color = 0xff0000, showTangents = false) {
        const { p0, p1, p2, p3 } = controls;

        // --- Draw curve ---
        const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
        const pts = curve.getPoints(60);

        const geom = new BufferGeometry().setFromPoints(pts);
        const mat = new LineBasicMaterial({ color });
        const line = new Line(geom, mat);
        this.scene.add(line);
        this.items.push(line);

        // --- Draw control polygon ---
        const polyGeom = new BufferGeometry().setFromPoints([p0, p1, p2, p3]);
        const polyMat = new LineBasicMaterial({ color: 0xffffff });
        const poly = new Line(polyGeom, polyMat);
        this.scene.add(poly);
        this.items.push(poly);

        // --- Draw control points ---
        const pointGeom = new BufferGeometry().setFromPoints([p0, p1, p2, p3]);
        const pointMat = new PointsMaterial({ color: 0xffffff, size: 0.8 });
        const points = new Points(pointGeom, pointMat);
        this.scene.add(points);
        this.items.push(points);

        // --- Draw tangents (optional) ---
        if (showTangents) {
            for (let i = 0; i <= 20; i++) {
                const t = i / 20;
                const pos = curve.getPoint(t);
                const tan = this.sampleDerivative(p0, p1, p2, p3, t).normalize();

                const arrow = new ArrowHelper(tan, pos, 2, color);
                this.scene.add(arrow);
                this.items.push(arrow);
            }
        }
    }

    drawMultiSegmentPattern(pattern, colors = [0xff0000, 0x00ff00, 0x0000ff]) {
        for (let i = 0; i < pattern.segments.length; i++) {
            const seg = pattern.segments[i];
            const color = colors[i % colors.length];
            this.drawSegment(seg.controls, color);
        }
    }

    // --- Cubic derivative sampler (same math as your engine) ---
    sampleDerivative(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const d = new Vector3();

        d.addScaledVector(p1.clone().sub(p0), 3 * mt * mt);
        d.addScaledVector(p2.clone().sub(p1), 6 * mt * t);
        d.addScaledVector(p3.clone().sub(p2), 3 * t * t);

        return d;
    }
}

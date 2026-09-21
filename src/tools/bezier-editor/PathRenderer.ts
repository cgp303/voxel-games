// tools/bezier-editor/PathRenderer.ts

import * as THREE from 'three';
import { BezierDebugRenderer } from '../../systems/path/pathVisulizer/BezierDebugRenderer';
import type { PathDocument } from './PathDocument';

const SEGMENT_COLORS = [0xff6060, 0x60ff60, 0x60a0ff, 0xffd060, 0xff60e0];
const HANDLE_COLOR = 0xffffff;
const JOINT_COLOR = 0x00ffff;
const SELECTED_COLOR = 0xffff00;

/** Redraws curves via BezierDebugRenderer and maintains pickable point-handle spheres. */
export class PathRenderer {
    readonly handles: THREE.Mesh[] = [];

    private readonly debug: BezierDebugRenderer;
    private readonly handleGroup: THREE.Group;
    private readonly handleGeom = new THREE.SphereGeometry(1.5, 12, 12);
    private readonly jointGeom = new THREE.SphereGeometry(2.5, 12, 12);

    constructor(scene: THREE.Scene) {
        this.debug = new BezierDebugRenderer(scene);
        this.handleGroup = new THREE.Group();
        this.handleGroup.name = 'PathHandles';
        scene.add(this.handleGroup);
    }

    redraw(doc: PathDocument, selectedIndex: number | null): void {
        this.debug.clear();
        for (let i = 0; i < doc.segmentCount; i++) {
            const [p0, p1, p2, p3] = doc.segmentPoints(i);
            this.debug.drawSegment({ p0, p1, p2, p3 }, SEGMENT_COLORS[i % SEGMENT_COLORS.length]);
        }
        this.rebuildHandles(doc, selectedIndex);
    }

    dispose(): void {
        this.debug.clear();
        for (const h of this.handles) h.removeFromParent();
        this.handleGroup.removeFromParent();
    }

    private rebuildHandles(doc: PathDocument, selectedIndex: number | null): void {
        for (const h of this.handles) h.removeFromParent();
        this.handles.length = 0;

        doc.points.forEach((p, idx) => {
            const isJoint = idx > 0 && idx < doc.points.length - 1 && idx % 3 === 0;
            const isSelected = idx === selectedIndex;
            const color = isSelected ? SELECTED_COLOR : isJoint ? JOINT_COLOR : HANDLE_COLOR;
            const geom = isSelected || isJoint ? this.jointGeom : this.handleGeom;
            const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color }));
            mesh.position.copy(p);
            mesh.userData.pointIndex = idx;
            this.handleGroup.add(mesh);
            this.handles.push(mesh);
        });
    }
}

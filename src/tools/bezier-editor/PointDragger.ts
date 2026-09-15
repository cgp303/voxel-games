// tools/bezier-editor/PointDragger.ts

import * as THREE from 'three';

/** Raycast-picks a handle on left pointerdown, then drags it on a horizontal plane. */
export class PointDragger {
    private readonly domElement: HTMLElement;
    private readonly camera: THREE.Camera;
    private readonly getHandles: () => THREE.Mesh[];
    private readonly onSelect: (index: number | null) => void;
    private readonly onDrag: (index: number, position: THREE.Vector3) => void;

    private dragging = false;
    private selectedIndex: number | null = null;
    private readonly raycaster = new THREE.Raycaster();
    private readonly ndc = new THREE.Vector2();
    private readonly dragPlane = new THREE.Plane();
    private readonly hitPoint = new THREE.Vector3();

    constructor(
        domElement: HTMLElement,
        camera: THREE.Camera,
        getHandles: () => THREE.Mesh[],
        onSelect: (index: number | null) => void,
        onDrag: (index: number, position: THREE.Vector3) => void,
    ) {
        this.domElement = domElement;
        this.camera = camera;
        this.getHandles = getHandles;
        this.onSelect = onSelect;
        this.onDrag = onDrag;

        this.domElement.addEventListener('pointerdown', this.onPointerDown);
        this.domElement.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
    }

    dispose(): void {
        this.domElement.removeEventListener('pointerdown', this.onPointerDown);
        this.domElement.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
    }

    private updateNdc(ev: PointerEvent): void {
        const rect = this.domElement.getBoundingClientRect();
        this.ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private onPointerDown = (ev: PointerEvent): void => {
        if (ev.button !== 0) return;
        this.updateNdc(ev);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hits = this.raycaster.intersectObjects(this.getHandles(), false);
        if (hits.length === 0) {
            this.selectedIndex = null;
            this.onSelect(null);
            return;
        }
        const hit = hits[0].object as THREE.Mesh;
        this.selectedIndex = hit.userData.pointIndex as number;
        this.onSelect(this.selectedIndex);
        this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.position);
        this.dragging = true;
        this.domElement.setPointerCapture(ev.pointerId);
    };

    private onPointerMove = (ev: PointerEvent): void => {
        if (!this.dragging || this.selectedIndex === null) return;
        this.updateNdc(ev);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint)) return;
        this.onDrag(this.selectedIndex, this.hitPoint);
    };

    private onPointerUp = (): void => {
        this.dragging = false;
    };
}

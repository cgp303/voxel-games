// tools/bezier-editor/EditorScene.ts

import * as THREE from 'three';

const INITIAL_VIEW_HALF_HEIGHT = 220;
const CAMERA_HEIGHT = 500;

/** Top-down ortho view: screen-up is world +Z, matching FORMATION's "forward". */
export class EditorScene {
    readonly scene = new THREE.Scene();
    readonly camera: THREE.OrthographicCamera;
    readonly renderer: THREE.WebGLRenderer;
    readonly domElement: HTMLCanvasElement;

    private viewHalfHeight = INITIAL_VIEW_HALF_HEIGHT;
    private readonly viewCenter = new THREE.Vector3(0, 0, 0);
    private panning = false;
    private lastPointer = { x: 0, y: 0 };

    constructor(container: HTMLElement) {
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.add(new THREE.GridHelper(1600, 160, 0x2a2a2a, 0x1a1a1a));
        this.scene.add(new THREE.AxesHelper(40));

        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
        this.camera.up.set(0, 0, 1);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.domElement = this.renderer.domElement;
        container.appendChild(this.domElement);

        this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
        this.domElement.addEventListener('pointerdown', this.onPointerDown);
        this.domElement.addEventListener('pointermove', this.onPointerMove);
        this.domElement.addEventListener('contextmenu', (ev) => ev.preventDefault());
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('resize', this.onResize);

        this.onResize();
    }

    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    dispose(): void {
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('pointerup', this.onPointerUp);
        this.renderer.dispose();
    }

    private onResize = (): void => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        this.applyFrustum(w / h);
    };

    private applyFrustum(aspect: number): void {
        this.camera.left = -this.viewHalfHeight * aspect;
        this.camera.right = this.viewHalfHeight * aspect;
        this.camera.top = this.viewHalfHeight;
        this.camera.bottom = -this.viewHalfHeight;
        this.updateCameraTransform();
    }

    private updateCameraTransform(): void {
        this.camera.position.set(this.viewCenter.x, CAMERA_HEIGHT, this.viewCenter.z);
        this.camera.lookAt(this.viewCenter);
        this.camera.updateProjectionMatrix();
    }

    private onWheel = (ev: WheelEvent): void => {
        ev.preventDefault();
        const factor = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
        this.viewHalfHeight = THREE.MathUtils.clamp(this.viewHalfHeight * factor, 20, 2000);
        this.applyFrustum(this.domElement.clientWidth / this.domElement.clientHeight);
    };

    private onPointerDown = (ev: PointerEvent): void => {
        if (ev.button !== 2) return;
        this.panning = true;
        this.lastPointer = { x: ev.clientX, y: ev.clientY };
    };

    private onPointerMove = (ev: PointerEvent): void => {
        if (!this.panning) return;
        const dx = ev.clientX - this.lastPointer.x;
        const dy = ev.clientY - this.lastPointer.y;
        this.lastPointer = { x: ev.clientX, y: ev.clientY };

        const worldPerPixel = (this.viewHalfHeight * 2) / this.domElement.clientHeight;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());

        this.viewCenter.addScaledVector(right, -dx * worldPerPixel);
        this.viewCenter.addScaledVector(up, dy * worldPerPixel);
        this.updateCameraTransform();
    };

    private onPointerUp = (): void => {
        this.panning = false;
    };
}

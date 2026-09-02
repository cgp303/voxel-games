import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameRenderer } from './Renderer';
import { VIEW } from '../data/constants';

export class GameCamera {
    public camera: THREE.PerspectiveCamera;
    public controls: OrbitControls;

    constructor(renderer: GameRenderer) {
        const aspect = VIEW.internalWidth / VIEW.internalHeight;

        this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 10000);

        this.controls = new OrbitControls(this.camera, renderer.renderer.domElement);
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
    }

    /**
     * Aspect is fixed to the design viewport (3:4). Safe to call on window resize;
     * only re-asserts projection — does not track window size.
     */
    public onWindowResize() {
        this.camera.aspect = VIEW.internalWidth / VIEW.internalHeight;
        this.camera.updateProjectionMatrix();
    }

    public update() {
        this.controls.update();
    }

    public lookAt(target: THREE.Vector3) {
        this.camera.lookAt(target);
        this.controls.target.copy(target);
        this.controls.update();
    }
}

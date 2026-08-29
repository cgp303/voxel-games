import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameRenderer } from './Renderer';

export class GameCamera {
    public camera: THREE.PerspectiveCamera;
    public controls: OrbitControls;

    constructor(renderer: GameRenderer) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        //  this.camera.position.set(550, 50, 1050);

        this.controls = new OrbitControls(this.camera, renderer.renderer.domElement);
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;

        window.addEventListener('resize', () => this.onWindowResize());
    }

    public onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
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

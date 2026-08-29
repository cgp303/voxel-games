import * as THREE from 'three';

export class GameScene {
    public scene: THREE.Scene;
    public ambientLight: THREE.AmbientLight;
    public directionalLight: THREE.DirectionalLight;
    public terrainDimensions: { w: number; h: number; d: number } | null = null;

    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 200, 1000);

        // Hemisphere light for natural ambient lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
        this.scene.add(hemiLight);





        // // Add ground plane to receive shadows
        // const groundGeometry = new THREE.PlaneGeometry(500, 500);
        // const groundMaterial = new THREE.MeshStandardMaterial({
        //     color: 0x005500,
        //     metalness: 0.0,
        //     roughness: 0.8
        // });
        // const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        // ground.rotation.x = -Math.PI / 2;
        // ground.position.y = -10;
        // ground.receiveShadow = true;
        // this.scene.add(ground);
    }

    public addTerrainMesh(mesh: THREE.Mesh, dims: { w: number; h: number; d: number }) {
        this.scene.add(mesh);
        this.terrainDimensions = dims;
    }

    public createLights() {
        // Directional light for shadows
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(0, 100, 200);
        this.directionalLight.target.position.set(0, 0, 0);

        this.directionalLight.castShadow = true;

        // Shadow setup
        this.directionalLight.shadow.mapSize.width = 1024;
        this.directionalLight.shadow.mapSize.height = 1024;
        this.directionalLight.shadow.camera.left = -this.terrainDimensions!.w / 1.5;
        this.directionalLight.shadow.camera.right = this.terrainDimensions!.w / 1.5;
        this.directionalLight.shadow.camera.top = this.terrainDimensions!.h * 4;
        this.directionalLight.shadow.camera.bottom = -this.terrainDimensions!.h * 3;
        this.directionalLight.shadow.camera.far = 350;
        this.directionalLight.shadow.bias = -0.001;

        this.scene.add(this.directionalLight);
        // this.scene.add(new THREE.CameraHelper(this.directionalLight.shadow.camera));
    }

    public clear() {
        // Remove all meshes from scene except lights
        const toRemove: THREE.Object3D[] = [];
        this.scene.traverse((object: THREE.Object3D) => {
        });
        toRemove.forEach((obj) => this.scene.remove(obj));
    }
}
